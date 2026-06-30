const prisma = require("../../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../../lib/auth");

async function PATCH(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can edit rate tiers." }), { status: 403 });
  }
  const { tierId } = params;
  const body = await req.json();
  const { label, maxHours, fee } = body || {};
  const data = {};
  if (label !== undefined) data.label = label || null;
  if (fee !== undefined) data.fee = parseFloat(fee) || 0;
  if (maxHours !== undefined) {
    data.maxHours = maxHours === "" || maxHours === null ? null : parseFloat(maxHours);
  }
  const updated = await prisma.rateTier.update({ where: { id: tierId }, data });
  return new Response(JSON.stringify(updated), { status: 200 });
}

async function DELETE(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can remove rate tiers." }), { status: 403 });
  }
  const { tierId } = params;
  await prisma.rateTier.delete({ where: { id: tierId } });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

module.exports = { PATCH, DELETE };
