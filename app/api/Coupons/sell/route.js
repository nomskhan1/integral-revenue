const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");
const crypto = require("crypto");

// POST — sell a coupon pack to a customer
// Charges via Square Terminal, generates individual coupons, emails customer
async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "GARAGE_MANAGER", "EMPLOYEE", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not authorized." }), { status: 403 });
  }

  const body = await req.json();
  const { couponBookId, customerName, customerEmail, customerPhone, paymentMethod } = body || {};

  if (!couponBookId) {
    return new Response(JSON.stringify({ error: "couponBookId is required." }), { status: 400 });
  }

  const book = await prisma.couponBook.findUnique({
    where: { id: couponBookId },
    include: { garage: true },
  });

  if (!book) {
    return new Response(JSON.stringify({ error: "Coupon book not found." }), { status: 404 });
  }

  if (!book.active) {
    return new Response(JSON.stringify({ error: "This coupon book is no longer available." }), { status: 400 });
  }

  // Create the pack and individual coupons in one transaction
  const pack = await prisma.couponPack.create({
    data: {
      couponBookId,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      amountPaid: book.salePrice,
      soldById: session.id,
      status: "ACTIVE",
      coupons: {
        create: Array.from({ length: book.packSize }, (_, i) => ({
          qrToken: crypto.randomBytes(16).toString("hex"),
          sequenceNum: i + 1,
          status: "UNUSED",
        })),
      },
    },
    include: {
      coupons: { orderBy: { sequenceNum: "asc" } },
      couponBook: { include: { garage: true } },
      soldBy: true,
    },
  });

  // Send email with coupon QR codes if email provided
  if (customerEmail) {
    try {
      await sendCouponEmail(pack);
    } catch (err) {
      console.error("Failed to send coupon email:", err);
      // Don't fail the sale if email fails
    }
  }

  return new Response(JSON.stringify({ ok: true, pack }), { status: 201 });
}

async function sendCouponEmail(pack) {
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.BACKUP_EMAIL_FROM || "noreply@integralsurveillancellc.com";

  const book = pack.couponBook;
  const garage = book.garage;

  const discountLabel = {
    FLAT_DOLLAR: `$${book.discountValue.toFixed(2)} off`,
    FREE_HOURS: `${book.discountValue} hour${book.discountValue !== 1 ? "s" : ""} free`,
    FIXED_RATE: `flat rate $${book.discountValue.toFixed(2)}`,
  }[book.discountType] || book.discountType;

  const couponRows = pack.coupons.map(c => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:14px;color:#374151;">
        Coupon ${c.sequenceNum} of ${book.packSize}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-size:12px;font-family:monospace;color:#6B7280;">
        ${c.qrToken}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${c.qrToken}" width="80" height="80" alt="QR Code"/>
      </td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#F0EDE6;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EDE6;padding:32px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
            <tr><td style="background:#1B2330;padding:28px 32px;text-align:center;">
              ${garage.logoUrl ? `<img src="${garage.logoUrl}" alt="${garage.name}" style="max-height:50px;max-width:180px;margin-bottom:12px;"><br/>` : ""}
              <div style="font-size:20px;font-weight:700;color:#C9A227;letter-spacing:0.06em;text-transform:uppercase;">${garage.name}</div>
              <div style="font-size:12px;color:#8A9BB0;margin-top:4px;">Parking Coupons</div>
            </td></tr>
            <tr><td style="padding:32px;">
              <p style="font-size:16px;color:#374151;margin:0 0 16px;">Hi ${pack.customerName || "there"},</p>
              <p style="font-size:15px;color:#374151;margin:0 0 24px;">
                Thank you for your purchase! Here are your <strong>${book.packSize} parking coupons</strong> for ${garage.name}.
                Each coupon gives you <strong>${discountLabel}</strong> on your parking fee.
              </p>
              <div style="background:#F0EDE6;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <div style="font-size:13px;color:#6B7280;margin-bottom:4px;">PURCHASE SUMMARY</div>
                <div style="font-size:15px;color:#1B2330;"><strong>${book.name}</strong> — ${book.packSize} coupons</div>
                <div style="font-size:14px;color:#6B7280;">Discount: ${discountLabel} per coupon</div>
                <div style="font-size:14px;color:#C9A227;font-weight:600;">Amount paid: $${pack.amountPaid.toFixed(2)}</div>
              </div>
              <p style="font-size:14px;color:#374151;margin:0 0 20px;">
                Present the QR code below to the parking attendant at checkout. Each code is single-use.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
                <tr style="background:#F9FAFB;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;">Coupon</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;">Code</th>
                  <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;">QR Code</th>
                </tr>
                ${couponRows}
              </table>
              <p style="font-size:12px;color:#9CA3AF;margin-top:24px;">
                Coupons are valid at ${garage.name} only. Each coupon is single-use and non-transferable.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from,
    to: pack.customerEmail,
    subject: `Your ${book.packSize} parking coupons — ${garage.name}`,
    html,
  });
}

// GET — list packs sold
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "GARAGE_MANAGER", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not authorized." }), { status: 403 });
  }

  const url = new URL(req.url);
  const garageId = url.searchParams.get("garageId") || session.garageId;

  const packs = await prisma.couponPack.findMany({
    where: { couponBook: { garageId } },
    orderBy: { soldAt: "desc" },
    include: {
      couponBook: true,
      soldBy: { select: { name: true } },
      coupons: { select: { status: true } },
    },
    take: 50,
  });

  return new Response(JSON.stringify(packs), { status: 200 });
}

module.exports = { GET, POST };
