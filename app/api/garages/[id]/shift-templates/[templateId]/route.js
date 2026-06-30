const prisma = require("../../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../../lib/auth");

async function DELETE(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can remove shift templates." }), { status: 403 });
  }

  const { templateId } = params;
  await prisma.shiftTemplate.delete({ where: { id: templateId } });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

module.exports = { DELETE };
