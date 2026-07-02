const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  const garageId = url.searchParams.get("garageId");

  if (!code) return new Response(JSON.stringify({ error: "Code is required." }), { status: 400 });

  const voucher = await prisma.nCVoucher.findUnique({
    where: { code },
    include: { garage: { select: { id: true, name: true } } },
  });

  if (!voucher) {
    return new Response(JSON.stringify({ valid: false, error: "Voucher not found." }), { status: 200 });
  }
  if (voucher.status === "USED") {
    return new Response(JSON.stringify({ valid: false, error: "This voucher has already been used." }), { status: 200 });
  }
  if (voucher.status === "CANCELLED") {
    return new Response(JSON.stringify({ valid: false, error: "This voucher has been cancelled." }), { status: 200 });
  }
  if (garageId && voucher.garageId !== garageId) {
    return new Response(JSON.stringify({ valid: false, error: `This voucher is only valid at ${voucher.garage.name}.` }), { status: 200 });
  }

  return new Response(JSON.stringify({ valid: true, voucher }), { status: 200 });
}

module.exports = { GET };
