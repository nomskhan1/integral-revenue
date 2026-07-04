const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function PATCH(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return new Response(JSON.stringify({ error: "Super Admin or Admin access required." }), {
      status: 403,
    });
  }

  const { id } = params;
  const body = await req.json();
  const { name, address, hourlyRate, logoUrl } = body || {};

  const updated = await prisma.garage.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(hourlyRate !== undefined ? { hourlyRate: parseFloat(hourlyRate) || 0 } : {}),
      ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
    },
  });

  return new Response(JSON.stringify(updated), { status: 200 });
}

async function DELETE(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return new Response(JSON.stringify({ error: "Super Admin or Admin access required." }), {
      status: 403,
    });
  }

  const { id } = params;

  const usersAttached = await prisma.user.count({ where: { garageId: id } });
  if (usersAttached > 0) {
    return new Response(
      JSON.stringify({
        error: `Can't delete — ${usersAttached} account(s) are still assigned to this garage. Reassign or remove them first.`,
      }),
      { status: 409 }
    );
  }

  await prisma.garage.delete({ where: { id } });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

module.exports = { PATCH, DELETE };
