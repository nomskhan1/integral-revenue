const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function PATCH(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { action } = body || {};

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });
  if (ticket.garageId !== session.garageId) {
    return new Response(JSON.stringify({ error: "That ticket belongs to a different garage." }), {
      status: 403,
    });
  }

  if (action === "cancel") {
    if (ticket.status !== "PARKED") {
      return new Response(JSON.stringify({ error: "Only an active (parked) ticket can be cancelled." }), {
        status: 409,
      });
    }
    const updated = await prisma.ticket.update({ where: { id }, data: { status: "CANCELLED" } });
    return new Response(JSON.stringify(updated), { status: 200 });
  }

  return new Response(JSON.stringify({ error: "Unknown action." }), { status: 400 });
}

module.exports = { PATCH };
