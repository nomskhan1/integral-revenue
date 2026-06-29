const prisma = require("../../../lib/db");
const { getSessionFromRequest } = require("../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  // Garage Managers and Employees only need their own garage's basic info
  // (e.g. for displaying its name) — everyone else (Super Admin/Admin) can
  // see the full list.
  let where = {};
  if (session.role === "GARAGE_MANAGER" || session.role === "EMPLOYEE") {
    where = { id: session.garageId || "__none__" };
  }

  const garages = await prisma.garage.findMany({
    where,
    include: {
      _count: { select: { users: true, shiftReports: true } },
    },
    orderBy: { name: "asc" },
  });

  return new Response(JSON.stringify(garages), { status: 200 });
}

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return new Response(JSON.stringify({ error: "Super Admin or Admin access required." }), {
      status: 403,
    });
  }

  const body = await req.json();
  const { name, address, hourlyRate } = body || {};

  if (!name) {
    return new Response(JSON.stringify({ error: "Garage name is required." }), { status: 400 });
  }

  const garage = await prisma.garage.create({
    data: {
      name,
      address: address || null,
      hourlyRate: hourlyRate != null ? parseFloat(hourlyRate) : 0,
    },
  });

  return new Response(JSON.stringify(garage), { status: 201 });
}

module.exports = { GET, POST };
