const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");
const { calculateFee } = require("../../../../lib/pricing");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// GET ?checkoutId=...&ticketId=... — polls Square for the terminal checkout
// status and completes the ticket if payment was approved.
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const url = new URL(req.url);
  const checkoutId = url.searchParams.get("checkoutId");
  const ticketId = url.searchParams.get("ticketId");

  if (!checkoutId || !ticketId) {
    return new Response(JSON.stringify({ error: "checkoutId and ticketId required." }), { status: 400 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const squareRes = await fetch(`https://connect.squareup.com/v2/terminals/checkouts/${checkoutId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
    },
  });

  const squareData = await squareRes.json();
  const checkout = squareData.checkout;

  if (!checkout) {
    return new Response(JSON.stringify({ status: "UNKNOWN" }), { status: 200 });
  }

  const checkoutStatus = checkout.status; // PENDING, IN_PROGRESS, CANCEL_REQUESTED, CANCELLED, COMPLETED

  // If completed, finalize the ticket
  if (checkoutStatus === "COMPLETED") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { garage: true },
    });

    if (!ticket || ticket.status !== "PARKED") {
      // Already completed
      return new Response(JSON.stringify({ status: "COMPLETED", alreadyDone: true }), { status: 200 });
    }

    const checkOutTime = new Date();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - new Date(ticket.checkInTime)) / 60000));
    const { feeAmount } = await calculateFee(ticket.garage, durationMinutes);

    let shiftReport = await prisma.shiftReport.findFirst({
      where: { employeeId: session.id, garageId: ticket.garageId, shiftDate: todayStr(), status: "DRAFT" },
    });
    if (!shiftReport) {
      shiftReport = await prisma.shiftReport.create({
        data: { garageId: ticket.garageId, employeeId: session.id, shiftDate: todayStr(), status: "DRAFT" },
      });
    }

    const newCreditCard = (shiftReport.creditCardRevenue || 0) + feeAmount;
    const gross =
      (shiftReport.cashRevenue || 0) +
      newCreditCard +
      (shiftReport.couponRevenue || 0) +
      (shiftReport.chargeBackRevenue || 0) +
      (shiftReport.otherRevenue || 0);
    const net = gross - (shiftReport.adjustments || 0);

    await prisma.shiftReport.update({
      where: { id: shiftReport.id },
      data: { creditCardRevenue: newCreditCard, grossTotal: gross, netTotal: net },
    });

    const paymentId = checkout.payment_ids?.[0] || checkoutId;

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "COMPLETED",
        checkOutTime,
        durationMinutes,
        feeAmount,
        paymentMethod: "CREDIT_CARD",
        paymentNote: `Square Terminal: ${paymentId}`,
        checkedOutById: session.id,
        shiftReportId: shiftReport.id,
      },
    });

    return new Response(JSON.stringify({
      status: "COMPLETED",
      feeAmount,
      paymentId,
      ticketNumber: ticket.ticketNumber,
    }), { status: 200 });
  }

  if (checkoutStatus === "CANCELLED") {
    return new Response(JSON.stringify({ status: "CANCELLED" }), { status: 200 });
  }

  // Still in progress
  return new Response(JSON.stringify({ status: checkoutStatus }), { status: 200 });
}

module.exports = { GET };
