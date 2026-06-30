const prisma = require("../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../lib/auth");

async function GET(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;

  // All roles that belong to this garage can read the shift templates
  // so the shift report form can populate the selector.
  const templates = await prisma.shiftTemplate.findMany({
    where: { garageId: id },
    orderBy: { startTime: "asc" },
  });

  return new Response(JSON.stringify(templates), { status: 200 });
}

async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can define shift templates." }), { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { name, startTime, endTime } = body || {};

  if (!name || !startTime || !endTime) {
    return new Response(
      JSON.stringify({ error: "Shift name, start time, and end time are all required." }),
      { status: 400 }
    );
  }

  const template = await prisma.shiftTemplate.create({
    data: { garageId: id, name, startTime, endTime },
  });

  return new Response(JSON.stringify(template), { status: 201 });
}

module.exports = { GET, POST };
