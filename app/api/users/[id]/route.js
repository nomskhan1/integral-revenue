const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

function canManage(session, target) {
  if (session.role === "SUPER_ADMIN") return true;
  if (session.role === "ADMIN") return target.role !== "SUPER_ADMIN" && target.role !== "ADMIN";
  if (session.role === "GARAGE_MANAGER") {
    return target.role === "EMPLOYEE" && target.garageId === session.garageId;
  }
  return false;
}

async function PATCH(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return new Response(JSON.stringify({ error: "Account not found." }), { status: 404 });

  if (!canManage(session, target)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const body = await req.json();
  const { name, username } = body || {};

  const data = {};
  if (name) data.name = name;
  if (username && username !== target.username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return new Response(JSON.stringify({ error: "That username is already taken." }), {
        status: 409,
      });
    }
    data.username = username;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, username: true, role: true, garage: { select: { name: true } } },
  });

  return new Response(JSON.stringify(updated), { status: 200 });
}

async function DELETE(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;
  if (id === session.id) {
    return new Response(JSON.stringify({ error: "You can't remove your own account while signed in." }), {
      status: 400,
    });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return new Response(JSON.stringify({ error: "Account not found." }), { status: 404 });

  if (!canManage(session, target)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  // Clear this user as the report submitter reference is not allowed since
  // shift reports require a submitter — block deletion if they have any
  // reports on file, to keep financial history intact and attributable.
  const reportCount = await prisma.shiftReport.count({ where: { employeeId: id } });
  if (reportCount > 0) {
    return new Response(
      JSON.stringify({
        error: `Can't remove — this account has ${reportCount} shift report(s) on file. Historical reports must stay attributable.`,
      }),
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

module.exports = { PATCH, DELETE };
