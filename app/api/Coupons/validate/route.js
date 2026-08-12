const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

// GET ?token=xxx — validate a coupon QR token at checkout
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "token is required." }), { status: 400 });
  }

  const coupon = await prisma.coupon.findUnique({
    where: { qrToken: token },
    include: {
      couponPack: {
        include: {
          couponBook: {
            include: { garage: true },
          },
        },
      },
    },
  });

  if (!coupon) {
    return new Response(JSON.stringify({ valid: false, error: "Invalid coupon — not found." }), { status: 200 });
  }

  if (coupon.status === "USED") {
    return new Response(JSON.stringify({
      valid: false,
      error: `This coupon was already used${coupon.usedAt ? ` on ${new Date(coupon.usedAt).toLocaleDateString()}` : ""}.`,
    }), { status: 200 });
  }

  if (coupon.status === "CANCELLED") {
    return new Response(JSON.stringify({ valid: false, error: "This coupon has been cancelled." }), { status: 200 });
  }

  if (coupon.couponPack.status === "CANCELLED") {
    return new Response(JSON.stringify({ valid: false, error: "This coupon pack has been cancelled." }), { status: 200 });
  }

  const book = coupon.couponPack.couponBook;

  return new Response(JSON.stringify({
    valid: true,
    coupon: {
      id: coupon.id,
      qrToken: coupon.qrToken,
      sequenceNum: coupon.sequenceNum,
      packSize: book.packSize,
      discountType: book.discountType,
      discountValue: book.discountValue,
      garageName: book.garage.name,
      bookName: book.name,
      customerName: coupon.couponPack.customerName,
    },
  }), { status: 200 });
}

// POST — apply coupon to a ticket at checkout
async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const body = await req.json();
  const { token, ticketId, couponPhotoUrl, baseFee } = body || {};

  if (!token || !ticketId) {
    return new Response(JSON.stringify({ error: "token and ticketId are required." }), { status: 400 });
  }

  const coupon = await prisma.coupon.findUnique({
    where: { qrToken: token },
    include: {
      couponPack: {
        include: { couponBook: true },
      },
    },
  });

  if (!coupon || coupon.status !== "UNUSED") {
    return new Response(JSON.stringify({ error: "Coupon is invalid or already used." }), { status: 400 });
  }

  const book = coupon.couponPack.couponBook;
  const base = Number(baseFee) || 0;

  // Calculate discount
  let discountAmount = 0;
  let finalFee = base;

  if (book.discountType === "FLAT_DOLLAR") {
    discountAmount = Math.min(book.discountValue, base);
    finalFee = Math.max(0, base - discountAmount);
  } else if (book.discountType === "FIXED_RATE") {
    discountAmount = Math.max(0, base - book.discountValue);
    finalFee = book.discountValue;
  } else if (book.discountType === "FREE_HOURS") {
    // Discount = freeHours * hourlyRate (approximated from base fee and duration)
    // We store the discount as the dollar value applied
    discountAmount = book.discountValue; // stored as hours — actual $ calculated at checkout
    finalFee = Math.max(0, base - discountAmount);
  }

  // Mark coupon as used
  await prisma.coupon.update({
    where: { id: coupon.id },
    data: {
      status: "USED",
      usedAt: new Date(),
      usedByTicketId: ticketId,
      couponPhotoUrl: couponPhotoUrl || null,
      discountApplied: discountAmount,
    },
  });

  // Check if pack is now exhausted
  const unusedCount = await prisma.coupon.count({
    where: { couponPackId: coupon.couponPackId, status: "UNUSED" },
  });

  if (unusedCount === 0) {
    await prisma.couponPack.update({
      where: { id: coupon.couponPackId },
      data: { status: "EXHAUSTED" },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    discountType: book.discountType,
    discountValue: book.discountValue,
    discountAmount,
    finalFee,
  }), { status: 200 });
}

module.exports = { GET, POST };
