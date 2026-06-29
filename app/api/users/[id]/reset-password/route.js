const bcrypt = require("bcryptjs");
const prisma = require("../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../lib/auth");

function canManage(session, target) {
  if (session.role === "SUPER_ADMIN") return true;
  if (session.role === "ADMIN") return target.role !== "SUPER_ADMIN" && target.role !== "ADMIN";
  if (session.role === "GARAGE_MANAGER") {
    return target.role === "EMPLOYEE" && target.garageId === session.garageId;
  }
  return false;
}

async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;
  const body = await req.json();
  const { newPassword } = body || {};

  if (!newPassword || newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "New password must be at least 6 characters." }), {
      status: 400,
    });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return new Response(JSON.stringify({ error: "Account not found." }), { status: 404 });

  if (!canManage(session, target)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash: newHash } });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

module.exports = { POST };
