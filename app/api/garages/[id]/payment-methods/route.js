const prisma = require("../../../../../lib/db");
const { getSessionFromRequest } = require("../../../../../lib/auth");

const VALID_METHODS = ["CASH", "CREDIT_CARD", "COUPON", "CHARGE_BACK", "NC", "LOANER"];

const METHOD_LABELS = {
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  COUPON: "Coupon",
  CHARGE_BACK: "Charge Back",
  NC: "N/C",
  LOANER: "Loaner",
};

async function GET(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const { id } = params;
  const methods = await prisma.garagePaymentMethod.findMany({
    where: { garageId: id },
    orderBy: { createdAt: "asc" },
  });

  return new Response(JSON.stringify(methods), { status: 200 });
}

async function POST(req, { params }) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can manage payment methods." }), {
      status: 403,
    });
  }

  const { id } = params;
  const body = await req.json();
  const { method } = body || {};

  if (!VALID_METHODS.includes(method)) {
    return new Response(JSON.stringify({ error: "Invalid payment method." }), { status: 400 });
  }

  try {
    const pm = await prisma.garagePaymentMethod.create({
      data: { garageId: id, method },
    });
    return new Response(JSON.stringify({ ...pm, label: METHOD_LABELS[method] }), { status: 201 });
  } catch (err) {
    if (err.code === "P2002") {
      return new Response(
        JSON.stringify({ error: `${METHOD_LABELS[method]} is already enabled for this garage.` }),
        { status: 409 }
      );
    }
    return new Response(JSON.stringify({ error: "Couldn't add payment method." }), { status: 500 });
  }
}

module.exports = { GET, POST, VALID_METHODS, METHOD_LABELS };
