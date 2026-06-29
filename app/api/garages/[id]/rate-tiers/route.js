const prisma = require("../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../lib/auth");

async function GET(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;

  // Garage Manager and Employee need to be able to see the active rate
  // structure (read-only) so they understand pricing — only Admin can
  // change it.
  const tiers = await prisma.rateTier.findMany({
    where: { garageId: id },
    orderBy: [{ maxHours: "asc" }],
  });

  // Postgres sorts NULL last by default ascending, which is exactly what
  // we want (the open-ended catch-all tier always comes last).
  return new Response(JSON.stringify(tiers), { status: 200 });
}

async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can set rate tiers." }), { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { label, maxHours, fee } = body || {};

  if (fee === undefined || fee === null || isNaN(parseFloat(fee))) {
    return new Response(JSON.stringify({ error: "A fee amount is required." }), { status: 400 });
  }

  const parsedMaxHours = maxHours === "" || maxHours === null || maxHours === undefined ? null : parseInt(maxHours, 10);

  if (parsedMaxHours !== null) {
    const existing = await prisma.rateTier.findFirst({ where: { garageId: id, maxHours: parsedMaxHours } });
    if (existing) {
      return new Response(
        JSON.stringify({ error: `A tier for "up to ${parsedMaxHours} hour(s)" already exists.` }),
        { status: 409 }
      );
    }
  } else {
    const existingOpenEnded = await prisma.rateTier.findFirst({ where: { garageId: id, maxHours: null } });
    if (existingOpenEnded) {
      return new Response(
        JSON.stringify({ error: "An open-ended (\"anything beyond\") tier already exists. Edit or remove it first." }),
        { status: 409 }
      );
    }
  }

  const tier = await prisma.rateTier.create({
    data: {
      garageId: id,
      label: label || null,
      maxHours: parsedMaxHours,
      fee: parseFloat(fee),
    },
  });

  return new Response(JSON.stringify(tier), { status: 201 });
}

module.exports = { GET, POST };
