const prisma = require("../../../lib/db");
const { getSessionFromRequest } = require("../../../lib/auth");
const crypto = require("crypto");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "ADMIN" && session.role !== "GARAGE_MANAGER")) {
    return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
  }

  const url = new URL(req.url);
  const garageId = url.searchParams.get("garageId");
  const status = url.searchParams.get("status");

  const where = {};
  if (garageId) where.garageId = garageId;
  else if (session.role === "GARAGE_MANAGER" && session.garageId) {
    where.garageId = session.garageId;
  }
  if (status) where.status = status;

  const vouchers = await prisma.nCVoucher.findMany({
    where,
    include: {
      garage: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return new Response(JSON.stringify(vouchers), { status: 200 });
}

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "ADMIN" && session.role !== "GARAGE_MANAGER")) {
    return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
  }

  const body = await req.json();
  const { garageId, quantity, note } = body || {};

  if (!garageId) {
    return new Response(JSON.stringify({ error: "Garage is required." }), { status: 400 });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < 1 || qty > 500) {
    return new Response(JSON.stringify({ error: "Quantity must be between 1 and 500." }), { status: 400 });
  }

  // Garage managers can only create vouchers for their own garage
  if (session.role === "GARAGE_MANAGER" && session.garageId !== garageId) {
    return new Response(JSON.stringify({ error: "You can only create vouchers for your garage." }), { status: 403 });
  }

  const vouchers = [];
  for (let i = 0; i < qty; i++) {
    vouchers.push({
      code: crypto.randomBytes(8).toString("hex").toUpperCase(),
      garageId,
      note: note || null,
      createdById: session.userId,
    });
  }

  await prisma.nCVoucher.createMany({ data: vouchers });

  // Return created vouchers with garage info for printing
  const created = await prisma.nCVoucher.findMany({
    where: { code: { in: vouchers.map(v => v.code) } },
    include: { garage: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return new Response(JSON.stringify(created), { status: 201 });
}

module.exports = { GET, POST };
