const prisma = require("../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../lib/auth");

async function GET(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;
  try {
    const tiers = await prisma.rateTier.findMany({
      where: { garageId: id },
      orderBy: [{ maxMinutes: "asc" }],
    });
    return new Response(JSON.stringify(tiers), { status: 200 });
  } catch (err) {
    console.error("[rate-tiers GET]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can set rate tiers." }), { status: 403 });
  }

  const { id } = params;
  try {
    const body = await req.json();
    const { label, maxMinutes, fee } = body || {};

    if (fee === undefined || fee === null || isNaN(parseFloat(fee))) {
      return new Response(JSON.stringify({ error: "A fee amount is required." }), { status: 400 });
    }

    const isOpenEnded = maxMinutes === null || maxMinutes === undefined;
    const parsedMaxMinutes = isOpenEnded ? null : parseInt(maxMinutes, 10);

    if (!isOpenEnded && (isNaN(parsedMaxMinutes) || parsedMaxMinutes <= 0)) {
      return new Response(JSON.stringify({ error: "Please enter a valid duration." }), { status: 400 });
    }

    if (isOpenEnded) {
      const existingOpenEnded = await prisma.rateTier.findFirst({ where: { garageId: id, maxMinutes: null } });
      if (existingOpenEnded) {
        return new Response(
          JSON.stringify({ error: 'An open-ended ("anything beyond") tier already exists. Remove it first.' }),
          { status: 409 }
        );
      }
    } else {
      const existing = await prisma.rateTier.findFirst({ where: { garageId: id, maxMinutes: parsedMaxMinutes } });
      if (existing) {
        return new Response(JSON.stringify({ error: "A tier for that duration already exists." }), { status: 409 });
      }
    }

    const tier = await prisma.rateTier.create({
      data: {
        garageId: id,
        label: label || null,
        maxMinutes: parsedMaxMinutes,
        fee: parseFloat(fee),
      },
    });
    return new Response(JSON.stringify(tier), { status: 201 });
  } catch (err) {
    console.error("[rate-tiers POST]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

module.exports = { GET, POST };
