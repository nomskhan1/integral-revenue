const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");
const { calculateFee } = require("../../../../lib/pricing");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// POST { ticketId } — manually marks a ticket as paid by credit card.
// Used as a fallback when Square's callback doesn't fire automatically
// after a successful Tap to Pay transaction.
async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const body = await req.json();
  const { ticketId } = body || {};
  if (!ticketId) {
    return new Response(JSON.stringify({ error: "ticketId is required." }), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { garage: true },
  });

  if (!ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });
  }

  if (ticket.status !== "PARKED") {
    return new Response(JSON.stringify({ ok: true, alreadyCompleted: true }), { status: 200 });
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

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "COMPLETED",
      checkOutTime,
      durationMinutes,
      feeAmount,
      paymentMethod: "CREDIT_CARD",
      paymentNote: "Square Tap to Pay — manually confirmed",
      checkedOutById: session.id,
      shiftReportId: shiftReport.id,
    },
  });

  return new Response(JSON.stringify({ ok: true, ticketNumber: updatedTicket.ticketNumber, feeAmount }), { status: 200 });
}

module.exports = { POST };
