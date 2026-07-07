const prisma = require("../../../../lib/db");
const ExcelJS = require("exceljs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { Resend } = require("resend");

const PAYMENT_METHODS = [
  { key: "cashRevenue", label: "Cash" },
  { key: "creditCardRevenue", label: "Credit card" },
  { key: "couponRevenue", label: "Coupon" },
  { key: "chargeBackRevenue", label: "Charge back" },
  { key: "ncRevenue", label: "N/C" },
  { key: "loanerRevenue", label: "Loaner" },
  { key: "otherRevenue", label: "Other" },
];

function money(n) {
  return `$${(n || 0).toFixed(2)}`;
}

// Vercel Cron schedules run in UTC. This endpoint is meant to fire at
// 11:55pm US Central — adjust the cron expression in vercel.json (not this
// file) if your garages are in a different timezone.
function todayDateString() {
  const now = new Date();
  // Shift dates are stored as America/Chicago calendar days elsewhere in
  // the app (shiftDate is free-form YYYY-MM-DD) — mirror that here so the
  // backup lines up with the day staff actually mean.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function fetchData(dateStr) {
  const garages = await prisma.garage.findMany({ orderBy: { name: "asc" } });

  const reports = await prisma.shiftReport.findMany({
    where: { shiftDate: dateStr },
    include: { garage: true, employee: { select: { name: true } } },
    orderBy: [{ garageId: "asc" }],
  });

  // Tickets checked out today, used for the full-detail sheet/page.
  // -06:00 is US Central Standard Time. During Central Daylight Time
  // (spring–fall) this is technically off by an hour at the day's edges —
  // fine for a same-day backup, but flag it if you want exact DST handling.
  const dayStart = new Date(`${dateStr}T00:00:00-06:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59-06:00`);
  const tickets = await prisma.ticket.findMany({
    where: {
      status: "COMPLETED",
      checkOutTime: { gte: dayStart, lte: dayEnd },
    },
    include: {
      garage: { select: { name: true } },
      checkedInBy: { select: { name: true } },
      checkedOutBy: { select: { name: true } },
    },
    orderBy: [{ garageId: "asc" }, { checkOutTime: "asc" }],
  });

  return { garages, reports, tickets };
}

function buildSummary(garages, reports) {
  return garages.map((g) => {
    const garageReports = reports.filter((r) => r.garageId === g.id);
    const totals = { grossTotal: 0, netTotal: 0, adjustments: 0 };
    PAYMENT_METHODS.forEach((m) => (totals[m.key] = 0));
    garageReports.forEach((r) => {
      totals.grossTotal += r.grossTotal || 0;
      totals.netTotal += r.netTotal || 0;
      totals.adjustments += r.adjustments || 0;
      PAYMENT_METHODS.forEach((m) => (totals[m.key] += r[m.key] || 0));
    });
    return { garage: g, reportCount: garageReports.length, totals };
  });
}

async function buildExcel(dateStr, summary, tickets) {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Garage", key: "garage", width: 26 },
    { header: "Shift reports", key: "reportCount", width: 14 },
    ...PAYMENT_METHODS.map((m) => ({ header: m.label, key: m.key, width: 14 })),
    { header: "Adjustments", key: "adjustments", width: 14 },
    { header: "Gross total", key: "grossTotal", width: 14 },
    { header: "Net total", key: "netTotal", width: 14 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summary.forEach((s) => {
    const row = { garage: s.garage.name, reportCount: s.reportCount, ...s.totals };
    summarySheet.addRow(row);
  });
  const grand = { garage: "ALL GARAGES", reportCount: summary.reduce((a, s) => a + s.reportCount, 0) };
  PAYMENT_METHODS.forEach((m) => (grand[m.key] = summary.reduce((a, s) => a + s.totals[m.key], 0)));
  grand.adjustments = summary.reduce((a, s) => a + s.totals.adjustments, 0);
  grand.grossTotal = summary.reduce((a, s) => a + s.totals.grossTotal, 0);
  grand.netTotal = summary.reduce((a, s) => a + s.totals.netTotal, 0);
  const grandRow = summarySheet.addRow(grand);
  grandRow.font = { bold: true };

  const detailSheet = workbook.addWorksheet("Detail");
  detailSheet.columns = [
    { header: "Garage", key: "garage", width: 20 },
    { header: "Ticket #", key: "ticketNumber", width: 12 },
    { header: "Check-in", key: "checkInTime", width: 20 },
    { header: "Check-out", key: "checkOutTime", width: 20 },
    { header: "Duration (min)", key: "durationMinutes", width: 14 },
    { header: "Fee", key: "feeAmount", width: 10 },
    { header: "Payment method", key: "paymentMethod", width: 16 },
    { header: "Checked in by", key: "checkedInBy", width: 16 },
    { header: "Checked out by", key: "checkedOutBy", width: 16 },
    { header: "Plate", key: "licensePlate", width: 12 },
  ];
  detailSheet.getRow(1).font = { bold: true };
  tickets.forEach((t) => {
    detailSheet.addRow({
      garage: t.garage?.name || "",
      ticketNumber: t.ticketNumber,
      checkInTime: t.checkInTime ? new Date(t.checkInTime).toLocaleString("en-US") : "",
      checkOutTime: t.checkOutTime ? new Date(t.checkOutTime).toLocaleString("en-US") : "",
      durationMinutes: t.durationMinutes || "",
      feeAmount: t.feeAmount || 0,
      paymentMethod: t.paymentMethod || "",
      checkedInBy: t.checkedInBy?.name || "",
      checkedOutBy: t.checkedOutBy?.name || "",
      licensePlate: t.licensePlate || "",
    });
  });

  return workbook.xlsx.writeBuffer();
}

async function buildPdf(dateStr, summary, tickets) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter, points
  const pageHeight = 792;
  const marginX = 40;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 50;

  function ensureRoom(minY) {
    if (y < minY) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 50;
    }
  }

  function writeLine(text, { size = 10, bold = false, color = rgb(0, 0, 0), gap = 14 } = {}) {
    ensureRoom(50);
    page.drawText(text, { x: marginX, y, size, font: bold ? boldFont : font, color });
    y -= gap;
  }

  writeLine(`Daily revenue backup — ${dateStr}`, { size: 18, bold: true, gap: 28 });
  writeLine("Summary by garage", { size: 13, bold: true, gap: 20 });

  summary.forEach((s) => {
    writeLine(`${s.garage.name} — ${s.reportCount} shift report(s)`, { size: 11, bold: true, gap: 14 });
    const line = PAYMENT_METHODS.map((m) => `${m.label}: ${money(s.totals[m.key])}`).join("   ");
    writeLine(line, { size: 8, color: rgb(0.27, 0.27, 0.27), gap: 12 });
    writeLine(
      `Gross: ${money(s.totals.grossTotal)}    Adjustments: ${money(s.totals.adjustments)}    Net: ${money(
        s.totals.netTotal
      )}`,
      { size: 9, gap: 18 }
    );
  });

  const grandGross = summary.reduce((a, s) => a + s.totals.grossTotal, 0);
  const grandNet = summary.reduce((a, s) => a + s.totals.netTotal, 0);
  writeLine(`ALL GARAGES — Gross: ${money(grandGross)}    Net: ${money(grandNet)}`, {
    size: 12,
    bold: true,
    gap: 20,
  });

  // Full detail on a fresh page.
  page = pdfDoc.addPage([pageWidth, pageHeight]);
  y = pageHeight - 50;
  writeLine("Full ticket detail", { size: 13, bold: true, gap: 20 });

  if (tickets.length === 0) {
    writeLine("No completed tickets today.", { size: 9, color: rgb(0.4, 0.4, 0.4) });
  } else {
    tickets.forEach((t) => {
      const checkOut = t.checkOutTime ? new Date(t.checkOutTime).toLocaleString("en-US") : "—";
      const line = `${t.garage?.name || ""} · #${t.ticketNumber} · out ${checkOut} · ${
        t.durationMinutes || "?"
      }min · ${money(t.feeAmount)} · ${t.paymentMethod || "—"} · in: ${t.checkedInBy?.name || "—"} out: ${
        t.checkedOutBy?.name || "—"
      }`;
      writeLine(line, { size: 8, gap: 12 });
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function GET(req) {
  // Vercel Cron sends this header automatically when a CRON_SECRET is
  // configured in Vercel's project settings — protects this endpoint from
  // being triggered by randoms hitting the URL.
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), { status: 401 });
  }

  const dateStr = todayDateString();
  const { garages, reports, tickets } = await fetchData(dateStr);
  const summary = buildSummary(garages, reports);

  const [excelBuffer, pdfBuffer] = await Promise.all([
    buildExcel(dateStr, summary, tickets),
    buildPdf(dateStr, summary, tickets),
  ]);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const toAddress = process.env.BACKUP_EMAIL_TO;

  if (!toAddress) {
    return new Response(JSON.stringify({ error: "BACKUP_EMAIL_TO is not set." }), { status: 500 });
  }

  const grandGross = summary.reduce((a, s) => a + s.totals.grossTotal, 0);

  const result = await resend.emails.send({
    from: process.env.BACKUP_EMAIL_FROM || "Integral Revenue <backups@integralrevenue.app>",
    to: toAddress,
    subject: `Daily revenue backup — ${dateStr} (${money(grandGross)} across ${garages.length} garages)`,
    text: `Attached: today's revenue summary and full ticket detail, in both Excel and PDF.\n\nDate: ${dateStr}\nGarages: ${garages.length}\nGrand total (gross): ${money(grandGross)}`,
    attachments: [
      {
        filename: `revenue-backup-${dateStr}.xlsx`,
        content: excelBuffer.toString("base64"),
      },
      {
        filename: `revenue-backup-${dateStr}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (result.error) {
    return new Response(JSON.stringify({ error: result.error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, date: dateStr, emailId: result.data?.id }), { status: 200 });
}

module.exports = { GET };
