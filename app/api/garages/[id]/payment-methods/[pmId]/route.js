const prisma = require("../../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../../lib/auth");

async function DELETE(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can manage payment methods." }), {
      status: 403,
    });
  }

  const { pmId } = params;
  await prisma.garagePaymentMethod.delete({ where: { id: pmId } });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

module.exports = { DELETE };
