const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

// GET — list coupon books for a garage
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "GARAGE_MANAGER", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not authorized." }), { status: 403 });
  }

  const url = new URL(req.url);
  const garageId = url.searchParams.get("garageId") || session.garageId;

  if (!garageId) {
    return new Response(JSON.stringify({ error: "garageId is required." }), { status: 400 });
  }

  const books = await prisma.couponBook.findMany({
    where: { garageId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { packs: true } },
    },
  });

  return new Response(JSON.stringify(books), { status: 200 });
}

// POST — create a coupon book template
async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Admin access required." }), { status: 403 });
  }

  const body = await req.json();
  const { garageId, name, description, packSize, discountType, discountValue, salePrice } = body || {};

  if (!garageId || !name || !packSize || !discountType || discountValue === undefined || !salePrice) {
    return new Response(JSON.stringify({ error: "All fields are required." }), { status: 400 });
  }

  if (![5, 10, 15, 20].includes(Number(packSize))) {
    return new Response(JSON.stringify({ error: "Pack size must be 5, 10, 15, or 20." }), { status: 400 });
  }

  if (!["FLAT_DOLLAR", "FREE_HOURS", "FIXED_RATE"].includes(discountType)) {
    return new Response(JSON.stringify({ error: "Invalid discount type." }), { status: 400 });
  }

  const book = await prisma.couponBook.create({
    data: {
      garageId,
      name,
      description: description || null,
      packSize: Number(packSize),
      discountType,
      discountValue: Number(discountValue),
      salePrice: Number(salePrice),
    },
  });

  return new Response(JSON.stringify(book), { status: 201 });
}

// PATCH — toggle active/inactive
async function PATCH(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Admin access required." }), { status: 403 });
  }

  const body = await req.json();
  const { id, active } = body || {};

  const book = await prisma.couponBook.update({
    where: { id },
    data: { active },
  });

  return new Response(JSON.stringify(book), { status: 200 });
}

module.exports = { GET, POST, PATCH };
