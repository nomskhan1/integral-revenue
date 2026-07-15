const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");
const { calculateFee } = require("../../../../lib/pricing");

// POST { ticketId } — creates a Square Terminal checkout request that
// sends the payment directly to the paired Square Reader on the device.
// No app switching needed — Square activates the Reader automatically.
async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const body = await req.json();
  const { ticketId } = body || {};
  if (!ticketId) {
    return new Response(JSON.stringify({ error: "ticketId is required." }), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { garage: true },
  });

  if (!ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });
  }
  if (ticket.status !== "PARKED") {
    return new Response(JSON.stringify({ error: "This ticket has already been checked out." }), { status: 409 });
  }

  const durationMinutes = Math.max(1, Math.round((Date.now() - new Date(ticket.checkInTime)) / 60000));
  const { feeAmount } = await calculateFee(ticket.garage, durationMinutes);
  const amountCents = Math.round(feeAmount * 100);

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    return new Response(JSON.stringify({ error: "Square is not configured." }), { status: 500 });
  }

  // Create a Square Terminal checkout — this sends the payment request
  // directly to the paired Square Reader via Square's cloud.
  const idempotencyKey = `ticket-${ticketId}-${Date.now()}`;

  const squareRes = await fetch("https://connect.squareup.com/v2/terminals/checkouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      checkout: {
        amount_money: {
          amount: amountCents,
          currency: "USD",
        },
        reference_id: ticketId,
        note: `Parking ticket #${ticket.ticketNumber}`,
        device_options: {
          device_id: "SELF_PAIRED_ROOT", // Uses the paired device on same network
          skip_receipt_screen: false,
          collect_signature: false,
          tip_settings: {
            allow_tipping: false,
          },
        },
        payment_type: "CARD_PRESENT",
        location_id: locationId,
      },
    }),
  });

  const squareData = await squareRes.json();

  if (!squareRes.ok || squareData.errors) {
    const errMsg = squareData.errors?.[0]?.detail || "Square API error";
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }

  const checkoutId = squareData.checkout?.id;

  // Store the checkout ID on the ticket so we can poll for status
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { paymentNote: `Square checkout: ${checkoutId}` },
  });

  return new Response(JSON.stringify({
    ok: true,
    checkoutId,
    amount: feeAmount,
    ticketNumber: ticket.ticketNumber,
  }), { status: 200 });
}

module.exports = { POST };
