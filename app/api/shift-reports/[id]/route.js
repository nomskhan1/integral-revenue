const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

function calcTotals(cash, credit, coupon, chargeBack, nc, loaner, other, adjustments) {
  const gross = (cash||0)+(credit||0)+(coupon||0)+(chargeBack||0)+(nc||0)+(loaner||0)+(other||0);
  const net = gross - (adjustments || 0);
  return { gross, net };
}

async function PATCH(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;
  const report = await prisma.shiftReport.findUnique({ where: { id } });
  if (!report) return new Response(JSON.stringify({ error: "Report not found." }), { status: 404 });

  const isOwner = report.employeeId === session.id;
  const isManagerOfGarage = session.role === "GARAGE_MANAGER" && session.garageId === report.garageId;
  const isAdmin = session.role === "SUPER_ADMIN" || session.role === "ADMIN";

  if (!isOwner && !isManagerOfGarage && !isAdmin) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }
  if (report.status === "SUBMITTED" && !isAdmin) {
    return new Response(JSON.stringify({ error: "This report has already been submitted and is locked." }), { status: 403 });
  }

  const body = await req.json();
  const { shiftDate, startTime, endTime, cashRevenue, creditCardRevenue, couponRevenue,
    chargeBackRevenue, ncRevenue, loanerRevenue, otherRevenue, otherDescription,
    adjustments, adjustmentsNote, notes, submit } = body || {};

  const cash = cashRevenue !== undefined ? parseFloat(cashRevenue)||0 : report.cashRevenue;
  const credit = creditCardRevenue !== undefined ? parseFloat(creditCardRevenue)||0 : report.creditCardRevenue;
  const coupon = couponRevenue !== undefined ? parseFloat(couponRevenue)||0 : (report.couponRevenue||0);
  const chargeBack = chargeBackRevenue !== undefined ? parseFloat(chargeBackRevenue)||0 : (report.chargeBackRevenue||0);
  const nc = ncRevenue !== undefined ? parseFloat(ncRevenue)||0 : (report.ncRevenue||0);
  const loaner = loanerRevenue !== undefined ? parseFloat(loanerRevenue)||0 : (report.loanerRevenue||0);
  const other = otherRevenue !== undefined ? parseFloat(otherRevenue)||0 : report.otherRevenue;
  const adj = adjustments !== undefined ? parseFloat(adjustments)||0 : report.adjustments;
  const { gross, net } = calcTotals(cash, credit, coupon, chargeBack, nc, loaner, other, adj);

  const data = {
    cashRevenue: cash, creditCardRevenue: credit, couponRevenue: coupon,
    chargeBackRevenue: chargeBack, ncRevenue: nc, loanerRevenue: loaner,
    otherRevenue: other, adjustments: adj, grossTotal: gross, netTotal: net,
  };
  if (shiftDate !== undefined) data.shiftDate = shiftDate;
  if (startTime !== undefined) data.startTime = startTime || null;
  if (endTime !== undefined) data.endTime = endTime || null;
  if (otherDescription !== undefined) data.otherDescription = otherDescription || null;
  if (adjustmentsNote !== undefined) data.adjustmentsNote = adjustmentsNote || null;
  if (notes !== undefined) data.notes = notes || null;
  if (submit && report.status !== "SUBMITTED") {
    data.status = "SUBMITTED";
    data.submittedAt = new Date();
  }

  const updated = await prisma.shiftReport.update({
    where: { id },
    data,
    include: { garage: { select: { name: true } }, employee: { select: { name: true, username: true } } },
  });

  return new Response(JSON.stringify(updated), { status: 200 });
}

module.exports = { PATCH };
