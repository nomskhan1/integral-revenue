const prisma = require("../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../lib/auth");
const { calculateFee } = require("../../../../../lib/pricing");

const VALID_METHODS = ["CASH", "CREDIT_CARD", "COUPON", "CHARGE_BACK", "NC", "LOANER"];
const ZERO_FEE_METHODS = ["NC", "LOANER"];
const METHOD_TO_FIELD = {
  CASH: "cashRevenue",
  CREDIT_CARD: "creditCardRevenue",
  COUPON: "couponRevenue",
  CHARGE_BACK: "chargeBackRevenue",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { paymentMethod, paymentNote, voucherCode } = body || {};

  if (!VALID_METHODS.includes(paymentMethod)) {
    return new Response(JSON.stringify({ error: "Please select a valid payment method." }), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { garage: true },
  });
  if (!ticket) return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });

  if (ticket.garageId !== session.garageId) {
    return new Response(JSON.stringify({ error: "That ticket belongs to a different garage." }), { status: 403 });
  }
  if (ticket.status !== "PARKED") {
    return new Response(JSON.stringify({ error: "This ticket has already been checked out or cancelled." }), { status: 409 });
  }

  // Validate voucher code if provided with N/C payment
  let voucher = null;
  if (paymentMethod === "NC" && voucherCode) {
    const code = voucherCode.trim().toUpperCase();
    voucher = await prisma.nCVoucher.findUnique({ where: { code } });
    if (!voucher) {
      return new Response(JSON.stringify({ error: "Voucher not found. Check the code and try again." }), { status: 400 });
    }
    if (voucher.status === "USED") {
      return new Response(JSON.stringify({ error: "This voucher has already been used." }), { status: 400 });
    }
    if (voucher.status === "CANCELLED") {
      return new Response(JSON.stringify({ error: "This voucher has been cancelled." }), { status: 400 });
    }
    if (voucher.garageId !== session.garageId) {
      return new Response(JSON.stringify({ error: `This voucher is only valid at ${ticket.garage.name}.` }), { status: 400 });
    }
  }

  const checkOutTime = new Date();
  const durationMinutes = Math.max(1, Math.round((checkOutTime - new Date(ticket.checkInTime)) / 60000));

  const isZeroFee = ZERO_FEE_METHODS.includes(paymentMethod);
  const feeAmount = isZeroFee ? 0 : (await calculateFee(ticket.garage, durationMinutes)).feeAmount;

  let shiftReport = await prisma.shiftReport.findFirst({
    where: { employeeId: session.id, garageId: session.garageId, shiftDate: todayStr(), status: "DRAFT" },
  });
  if (!shiftReport) {
    shiftReport = await prisma.shiftReport.create({
      data: { garageId: session.garageId, employeeId: session.id, shiftDate: todayStr(), status: "DRAFT" },
    });
  }

  if (!isZeroFee && METHOD_TO_FIELD[paymentMethod]) {
    const revenueField = METHOD_TO_FIELD[paymentMethod];
    const newRevenueValue = (shiftReport[revenueField] || 0) + feeAmount;
    const gross =
      (revenueField === "cashRevenue" ? newRevenueValue : shiftReport.cashRevenue || 0) +
      (revenueField === "creditCardRevenue" ? newRevenueValue : shiftReport.creditCardRevenue || 0) +
      (revenueField === "couponRevenue" ? newRevenueValue : shiftReport.couponRevenue || 0) +
      (revenueField === "chargeBackRevenue" ? newRevenueValue : shiftReport.chargeBackRevenue || 0) +
      (shiftReport.otherRevenue || 0);
    const net = gross - (shiftReport.adjustments || 0);

    await prisma.shiftReport.update({
      where: { id: shiftReport.id },
      data: { [revenueField]: newRevenueValue, grossTotal: gross, netTotal: net },
    });
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: {
      status: "COMPLETED",
      checkOutTime,
      durationMinutes,
      feeAmount,
      paymentMethod,
      paymentNote: paymentNote || null,
      checkedOutById: session.id,
      shiftReportId: shiftReport.id,
    },
    include: { garage: { select: { name: true } } },
  });

  // Mark voucher as used if one was provided
  if (voucher) {
    await prisma.nCVoucher.update({
      where: { id: voucher.id },
      data: { status: "USED", usedByTicketId: updatedTicket.id, usedAt: checkOutTime },
    });
  }

  return new Response(JSON.stringify(updatedTicket), { status: 200 });
}

module.exports = { POST };
