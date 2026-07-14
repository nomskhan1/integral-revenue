const prisma = require("../../../../lib/db");
const { calculateFee } = require("../../../../lib/pricing");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function POST(req) {
  const body = await req.json();
  const { ticketId, employeeId } = body || {};

  if (!ticketId || !employeeId) {
    return new Response(JSON.stringify({ error: "ticketId and employeeId are required." }), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { garage: true },
  });

  if (!ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });
  }

  if (ticket.status !== "PARKED") {
    return new Response(JSON.stringify({ ok: true, alreadyCompleted: true, ticketNumber: ticket.ticketNumber, feeAmount: ticket.feeAmount }), { status: 200 });
  }

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return new Response(JSON.stringify({ error: "Employee not found." }), { status: 404 });
  }

  const checkOutTime = new Date();
  const durationMinutes = Math.max(1, Math.round((checkOutTime - new Date(ticket.checkInTime)) / 60000));
  const { feeAmount } = await calculateFee(ticket.garage, durationMinutes);

  let shiftReport = await prisma.shiftReport.findFirst({
    where: { employeeId, garageId: ticket.garageId, shiftDate: todayStr(), status: "DRAFT" },
  });
  if (!shiftReport) {
    shiftReport = await prisma.shiftReport.create({
      data: { garageId: ticket.garageId, employeeId, shiftDate: todayStr(), status: "DRAFT" },
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
      checkedOutById: employeeId,
      shiftReportId: shiftReport.id,
    },
  });

  return new Response(JSON.stringify({ ok: true, ticketNumber: updatedTicket.ticketNumber, feeAmount }), { status: 200 });
}

module.exports = { POST };
