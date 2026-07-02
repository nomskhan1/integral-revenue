const prisma = require("../../../lib/db");
const { getSessionFromRequest } = require("../../../lib/auth");

async function GET(req) {
  // Settings are public — logo and company name are shown to all users.
  const rows = await prisma.appSetting.findMany();
  const settings = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  return new Response(JSON.stringify(settings), { status: 200 });
}

async function PATCH(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can update settings." }), { status: 403 });
  }

  const body = await req.json();
  const updates = [];
  for (const [key, value] of Object.entries(body)) {
    updates.push(
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
  }
  await Promise.all(updates);
  const rows = await prisma.appSetting.findMany();
  const settings = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  return new Response(JSON.stringify(settings), { status: 200 });
}

module.exports = { GET, PATCH };
