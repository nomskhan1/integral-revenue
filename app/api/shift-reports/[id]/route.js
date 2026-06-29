const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

function calcTotals(cash, credit, other, adjustments) {
  const gross = (cash || 0) + (credit || 0) + (other || 0);
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

  // Once submitted, a report is locked. Only Super Admin/Admin can still
  // adjust it after the fact (e.g. to correct a genuine data-entry error),
  // everyone else is fully locked out — this matches the "locked from
  // further editing" requirement.
  if (report.status === "SUBMITTED" && !isAdmin) {
    return new Response(
      JSON.stringify({ error: "This report has already been submitted and is locked." }),
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    shiftDate,
    startTime,
    endTime,
    cashRevenue,
    creditCardRevenue,
    otherRevenue,
    otherDescription,
    adjustments,
    adjustmentsNote,
    notes,
    submit,
  } = body || {};

  const cash = cashRevenue !== undefined ? parseFloat(cashRevenue) || 0 : report.cashRevenue;
  const credit = creditCardRevenue !== undefined ? parseFloat(creditCardRevenue) || 0 : report.creditCardRevenue;
  const other = otherRevenue !== undefined ? parseFloat(otherRevenue) || 0 : report.otherRevenue;
  const adj = adjustments !== undefined ? parseFloat(adjustments) || 0 : report.adjustments;
  const { gross, net } = calcTotals(cash, credit, other, adj);

  const data = {
    cashRevenue: cash,
    creditCardRevenue: credit,
    otherRevenue: other,
    adjustments: adj,
    grossTotal: gross,
    netTotal: net,
  };
  if (shiftDate !== undefined) data.shiftDate = shiftDate;
  if (startTime !== undefined) data.startTime = startTime || null;
  if (endTime !== undefined) data.endTime = endTime || null;
  if (otherDescription !== undefined) data.otherDescription = otherDescription || null;
  if (adjustmentsNote !== undefined) data.adjustmentsNote = adjustmentsNote || null;
  if (notes !== undefined) data.notes = notes || null;

  // Submitting locks the report and time/user-stamps it.
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
