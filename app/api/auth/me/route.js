const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ user: null }), { status: 200 });
  }

  // Include garage name AND logoUrl so the header can show the garage logo.
  let garage = null;
  if (session.garageId) {
    garage = await prisma.garage.findUnique({
      where: { id: session.garageId },
      select: { id: true, name: true, logoUrl: true },
    });
  }

  return new Response(JSON.stringify({ user: { ...session, garage } }), { status: 200 });
}

module.exports = { GET };
