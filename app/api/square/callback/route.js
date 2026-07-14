const prisma = require("../../../../lib/db");
const { calculateFee } = require("../../../../lib/pricing");

const METHOD_TO_FIELD = {
  CASH: "cashRevenue",
  CREDIT_CARD: "creditCardRevenue",
  COUPON: "couponRevenue",
  CHARGE_BACK: "chargeBackRevenue",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Square redirects here after a payment attempt.
// Square POS API sends these query params back:
//   status           — "ok" (approved) or "cancel" (user cancelled)
//   transaction_id   — Square's transaction ID (only on success)
//   error_code       — error code if failed
//   data             — URL-encoded JSON with our original request data
//   request_metadata — sometimes used instead of data on Android
async function GET(req) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const transactionId = url.searchParams.get("transaction_id");
  const errorCode = url.searchParams.get("error_code");

  // Square returns our original data back - parse the customData we embedded in notes
  // We stored ticketId|employeeId in the notes field
  let customData = url.searchParams.get("request_metadata")
    || url.searchParams.get("data")
    || "";

  // If data is a JSON object, try to parse it
  try {
    const parsed = JSON.parse(decodeURIComponent(customData));
    if (parsed.notes) customData = parsed.notes;
  } catch {}

  // Extract from notes field format "ticketId|employeeId" 
  // or try the raw value directly
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://integral-revenue.vercel.app";
  const checkoutTab = `${dashboardUrl}/dashboard?tab=checkout`;

  // Log all params for debugging
  console.log("[square/callback] params:", Object.fromEntries(url.searchParams.entries()));

  const [ticketId, employeeId] = customData.split("|");

  if (!ticketId || !employeeId) {
    // Redirect to dashboard with all params visible for debugging
    return Response.redirect(`${checkoutTab}&square_error=invalid_data&raw=${encodeURIComponent(customData)}`, 302);
  }

  if (status !== "ok") {
    // Payment was cancelled or failed — redirect back with error, don't complete ticket
    return Response.redirect(
      `${checkoutTab}&square_error=${errorCode || "cancelled"}&ticket_id=${ticketId}`,
      302
    );
  }

  // Payment approved — complete the checkout
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { garage: true },
    });

    if (!ticket) {
      return Response.redirect(`${checkoutTab}&square_error=ticket_not_found`, 302);
    }
    if (ticket.status !== "PARKED") {
      // Already checked out (e.g. double callback) — just redirect cleanly
      return Response.redirect(`${checkoutTab}&square_success=1&ticket_number=${ticket.ticketNumber}`, 302);
    }

    const employee = await prisma.user.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return Response.redirect(`${checkoutTab}&square_error=employee_not_found`, 302);
    }

    const checkOutTime = new Date();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - new Date(ticket.checkInTime)) / 60000));
    const { feeAmount } = await calculateFee(ticket.garage, durationMinutes);

    // Find or create today's draft shift report for this employee
    let shiftReport = await prisma.shiftReport.findFirst({
      where: { employeeId, garageId: ticket.garageId, shiftDate: todayStr(), status: "DRAFT" },
    });
    if (!shiftReport) {
      shiftReport = await prisma.shiftReport.create({
        data: { garageId: ticket.garageId, employeeId, shiftDate: todayStr(), status: "DRAFT" },
      });
    }

    const revenueField = METHOD_TO_FIELD.CREDIT_CARD;
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
        paymentNote: `Square transaction: ${transactionId}`,
        checkedOutById: employeeId,
        shiftReportId: shiftReport.id,
      },
    });

    return Response.redirect(
      `${checkoutTab}&square_success=1&ticket_number=${updatedTicket.ticketNumber}&amount=${feeAmount}`,
      302
    );
  } catch (err) {
    console.error("[square/callback] error:", err.message);
    return Response.redirect(`${checkoutTab}&square_error=server_error`, 302);
  }
}

module.exports = { GET };
