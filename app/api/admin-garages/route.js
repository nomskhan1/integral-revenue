const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

// GET: list all admins with their current garage assignments and report email.
// Super Admin only.
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return new Response(JSON.stringify({ error: "Super Admin access required." }), { status: 403 });
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      name: true,
      username: true,
      reportEmail: true,
      adminGarages: {
        include: { garage: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return new Response(JSON.stringify(admins), { status: 200 });
}

// PUT { adminId, garageIds: [...], reportEmail } — replaces the admin's
// garage assignments entirely (add new ones, remove old ones) and sets
// their report email in one atomic operation.
async function PUT(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return new Response(JSON.stringify({ error: "Super Admin access required." }), { status: 403 });
  }

  const body = await req.json();
  const { adminId, garageIds, reportEmail } = body || {};
  if (!adminId) {
    return new Response(JSON.stringify({ error: "adminId is required." }), { status: 400 });
  }

  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Admin not found." }), { status: 404 });
  }

  // Validate all garage IDs actually exist.
  const ids = Array.isArray(garageIds) ? garageIds : [];
  if (ids.length > 0) {
    const found = await prisma.garage.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) {
      return new Response(JSON.stringify({ error: "One or more garage IDs not found." }), { status: 400 });
    }
  }

  // Replace assignments in a transaction.
  await prisma.$transaction([
    prisma.adminGarage.deleteMany({ where: { adminId } }),
    ...(ids.length > 0
      ? [
          prisma.adminGarage.createMany({
            data: ids.map((garageId) => ({ adminId, garageId })),
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: adminId },
      data: { reportEmail: reportEmail || null },
    }),
  ]);

  const updated = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      reportEmail: true,
      adminGarages: { include: { garage: { select: { id: true, name: true } } } },
    },
  });

  return new Response(JSON.stringify(updated), { status: 200 });
}

module.exports = { GET, PUT };
