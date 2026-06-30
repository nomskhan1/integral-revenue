const prisma = require("../../../lib/db");
const { getSessionFromRequest } = require("../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (session.role === "SUPER_ADMIN") {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const url = new URL(req.url);
  const garageId = url.searchParams.get("garageId");
  const employeeId = url.searchParams.get("employeeId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let where = {};
  if (session.role === "EMPLOYEE") {
    where.employeeId = session.id;
  } else if (session.role === "GARAGE_MANAGER") {
    where.garageId = session.garageId || "__none__";
  }

  if (garageId && session.role === "ADMIN") where.garageId = garageId;
  if (employeeId && session.role !== "EMPLOYEE") where.employeeId = employeeId;
  if (from || to) {
    where.shiftDate = {};
    if (from) where.shiftDate.gte = from;
    if (to) where.shiftDate.lte = to;
  }

  const reports = await prisma.shiftReport.findMany({
    where,
    include: {
      garage: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true, username: true } },
      tickets: {
        where: { status: "COMPLETED" },
        select: { id: true, ticketNumber: true, feeAmount: true, apartmentNumber: true, paymentMethod: true, licensePlate: true, vehicleMake: true, vehicleModel: true, vehicleColor: true, checkInTime: true, checkOutTime: true, durationMinutes: true },
        orderBy: { checkOutTime: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return new Response(JSON.stringify(reports), { status: 200 });
}

function calcTotals(cash, credit, coupon, chargeBack, nc, loaner, other, adjustments) {
  // NC and Loaner are $0 complimentary categories — excluded from gross revenue.
  const gross = (cash||0)+(credit||0)+(coupon||0)+(chargeBack||0)+(other||0);
  const net = gross - (adjustments || 0);
  return { gross, net };
}

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Only employees and garage managers can file shift reports." }), { status: 403 });
  }
  if (!session.garageId) {
    return new Response(JSON.stringify({ error: "Your account isn't assigned to a garage." }), { status: 400 });
  }

  const body = await req.json();
  const { shiftDate, startTime, endTime, cashRevenue, creditCardRevenue, couponRevenue,
    chargeBackRevenue, ncRevenue, loanerRevenue, otherRevenue, otherDescription,
    adjustments, adjustmentsNote, notes, submit } = body || {};

  if (!shiftDate) {
    return new Response(JSON.stringify({ error: "Shift date is required." }), { status: 400 });
  }

  const cash = parseFloat(cashRevenue) || 0;
  const credit = parseFloat(creditCardRevenue) || 0;
  const coupon = parseFloat(couponRevenue) || 0;
  const chargeBack = parseFloat(chargeBackRevenue) || 0;
  const nc = parseFloat(ncRevenue) || 0;
  const loaner = parseFloat(loanerRevenue) || 0;
  const other = parseFloat(otherRevenue) || 0;
  const adj = parseFloat(adjustments) || 0;
  const { gross, net } = calcTotals(cash, credit, coupon, chargeBack, nc, loaner, other, adj);

  const report = await prisma.shiftReport.create({
    data: {
      garageId: session.garageId,
      employeeId: session.id,
      shiftDate,
      startTime: startTime || null,
      endTime: endTime || null,
      cashRevenue: cash,
      creditCardRevenue: credit,
      couponRevenue: coupon,
      chargeBackRevenue: chargeBack,
      ncRevenue: nc,
      loanerRevenue: loaner,
      otherRevenue: other,
      otherDescription: otherDescription || null,
      adjustments: adj,
      adjustmentsNote: adjustmentsNote || null,
      grossTotal: gross,
      netTotal: net,
      notes: notes || null,
      status: submit ? "SUBMITTED" : "DRAFT",
      submittedAt: submit ? new Date() : null,
    },
    include: { garage: { select: { name: true } }, employee: { select: { name: true } } },
  });

  return new Response(JSON.stringify(report), { status: 201 });
}

module.exports = { GET, POST };
