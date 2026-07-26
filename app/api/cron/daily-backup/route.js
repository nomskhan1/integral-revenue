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
  const garages = await prisma.garage.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, logoUrl: true } });

  // Load all admins who have garage assignments AND a report email set —
  // those are the ones who should receive per-garage reports.
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      reportEmail: { not: null },
      adminGarages: { some: {} },
    },
    include: {
      adminGarages: {
        include: { garage: { select: { id: true, name: true, logoUrl: true } } },
      },
    },
  });

  const reports = await prisma.shiftReport.findMany({
    where: { shiftDate: dateStr },
    include: { garage: true, employee: { select: { name: true } } },
    orderBy: [{ garageId: "asc" }],
  });

  // Tickets checked out today, used for the full-detail sheet/page.
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

  return { garages, admins, reports, tickets };
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

// Builds a branded HTML email body with the garage logo and summary.
function buildEmailHtml({ adminName, garageNames, dateStr, grandGross, logoUrl, logoAlt }) {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${logoAlt}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:16px;" /><br/>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F0EDE6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr><td style="background:#1B2430;padding:28px 32px;text-align:center;">
          ${logoHtml}
          <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C9A227;">
            ${garageNames}
          </div>
          <div style="font-size:12px;color:#8A9BB0;margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;">
            Daily Revenue Report
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="font-size:15px;color:#374151;margin:0 0 24px;">
            Hi ${adminName},<br/><br/>
            Attached is today's revenue report for <strong>${garageNames}</strong>.
          </p>

          <!-- Summary box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE6;border-radius:8px;padding:20px;margin-bottom:24px;">
            <tr>
              <td style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;">Date</td>
              <td style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;text-align:right;">Gross Total</td>
            </tr>
            <tr>
              <td style="font-size:24px;font-weight:700;color:#1B2430;padding-top:6px;">${dateStr}</td>
              <td style="font-size:24px;font-weight:700;color:#C9A227;padding-top:6px;text-align:right;">${money(grandGross)}</td>
            </tr>
          </table>

          <p style="font-size:13px;color:#6B7280;margin:0;">
            Full details are attached as Excel and PDF files.<br/>
            This is an automated report from Integral Revenue.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F8F7F4;padding:20px 32px;text-align:center;border-top:1px solid #E5E3DE;">
          <p style="font-size:11px;color:#9CA3AF;margin:0;">
            Integral Surveillance Solutions LLC &nbsp;·&nbsp; 
            <a href="https://integralsurveillancellc.com/privacy" style="color:#9CA3AF;">Privacy</a> &nbsp;·&nbsp;
            <a href="https://integralsurveillancellc.com/terms" style="color:#9CA3AF;">Terms</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), { status: 401 });
  }

  const dateStr = todayDateString();
  const { garages, admins, reports, tickets } = await fetchData(dateStr);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.BACKUP_EMAIL_FROM || "Integral Revenue <backups@integralrevenue.app>";
  const results = [];

  // ── 1. Per-admin emails (scoped to their assigned garages) ──────────────
  for (const admin of admins) {
    const adminGarageIds = new Set(admin.adminGarages.map((ag) => ag.garageId));
    const adminGarages = garages.filter((g) => adminGarageIds.has(g.id));
    const adminReports = reports.filter((r) => adminGarageIds.has(r.garageId));
    const adminTickets = tickets.filter((t) => adminGarageIds.has(t.garageId));

    if (adminGarages.length === 0) continue;

    const summary = buildSummary(adminGarages, adminReports);
    const grandGross = summary.reduce((a, s) => a + s.totals.grossTotal, 0);

    const [excelBuffer, pdfBuffer] = await Promise.all([
      buildExcel(dateStr, summary, adminTickets),
      buildPdf(dateStr, summary, adminTickets),
    ]);

    const garageNames = adminGarages.map((g) => g.name).join(", ");
    // Get logo from first assigned garage (most admins manage one garage)
    const firstGarage = adminGarages[0];
    const logoUrl = firstGarage?.logoUrl || null;
    const logoAlt = firstGarage?.name || garageNames;

    const result = await resend.emails.send({
      from,
      to: admin.reportEmail,
      subject: `Daily revenue report — ${dateStr} (${garageNames})`,
      text: `Hi ${admin.name},\n\nAttached is today's revenue report for your garage(s): ${garageNames}.\n\nDate: ${dateStr}\nGross total: ${money(grandGross)}\n\nThis is an automated report from Integral Revenue.`,
      html: buildEmailHtml({
        adminName: admin.name,
        garageNames,
        dateStr,
        grandGross,
        logoUrl,
        logoAlt,
      }),
      attachments: [
        {
          filename: `revenue-report-${dateStr}.xlsx`,
          content: excelBuffer.toString("base64"),
        },
        {
          filename: `revenue-report-${dateStr}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    results.push({
      admin: admin.name,
      email: admin.reportEmail,
      garages: adminGarages.map((g) => g.name),
      error: result.error?.message || null,
    });
  }

  // ── 2. Combined super-admin report (all garages) ────────────────────────
  const toAddress = process.env.BACKUP_EMAIL_TO;
  if (toAddress) {
    const summary = buildSummary(garages, reports);
    const grandGross = summary.reduce((a, s) => a + s.totals.grossTotal, 0);

    const [excelBuffer, pdfBuffer] = await Promise.all([
      buildExcel(dateStr, summary, tickets),
      buildPdf(dateStr, summary, tickets),
    ]);

    const result = await resend.emails.send({
      from,
      to: toAddress,
      subject: `Daily revenue backup — ${dateStr} (${money(grandGross)} across ${garages.length} garages)`,
      text: `Attached: today's revenue summary and full ticket detail, in both Excel and PDF.\n\nDate: ${dateStr}\nGarages: ${garages.length}\nGrand total (gross): ${money(grandGross)}`,
      html: buildEmailHtml({
        adminName: "Admin",
        garageNames: `All Garages (${garages.length})`,
        dateStr,
        grandGross,
        logoUrl: null,
        logoAlt: "Integral Revenue",
      }),
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

    results.push({
      admin: "SUPER_ADMIN",
      email: toAddress,
      garages: garages.map((g) => g.name),
      error: result.error?.message || null,
    });
  }

  return new Response(JSON.stringify({ ok: true, date: dateStr, results }), { status: 200 });
}

module.exports = { GET };
