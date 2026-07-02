const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function PATCH(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "ADMIN" && session.role !== "GARAGE_MANAGER")) {
    return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { action } = body || {};

  const voucher = await prisma.nCVoucher.findUnique({ where: { id } });
  if (!voucher) return new Response(JSON.stringify({ error: "Voucher not found." }), { status: 404 });

  if (action === "cancel") {
    if (voucher.status !== "ACTIVE") {
      return new Response(JSON.stringify({ error: "Only active vouchers can be cancelled." }), { status: 400 });
    }
    const updated = await prisma.nCVoucher.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  }

  return new Response(JSON.stringify({ error: "Unknown action." }), { status: 400 });
}

module.exports = { PATCH };
