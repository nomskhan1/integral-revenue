const twilio = require("twilio");
const QRCode = require("qrcode");
const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const body = await req.json();
  const { ticketId, phone } = body || {};

  if (!ticketId) return new Response(JSON.stringify({ error: "Ticket ID required." }), { status: 400 });
  if (!phone) return new Response(JSON.stringify({ error: "Phone number required." }), { status: 400 });

  // Validate and clean phone number
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 10) {
    return new Response(JSON.stringify({ error: "Please enter a valid 10-digit phone number." }), { status: 400 });
  }
  const formattedPhone = cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { garage: { select: { name: true } } },
  });
  if (!ticket) return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });

  // Check Twilio credentials are configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    return new Response(JSON.stringify({ error: "SMS is not configured. Please contact your Admin." }), { status: 500 });
  }

  try {
    // Generate QR code as a data URL (we'll include ticket info in the message)
    const checkIn = new Date(ticket.checkInTime).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });

    const garageName = ticket.garage?.name || "Garage";
    const plate = ticket.licensePlate ? ` · ${ticket.licensePlate}` : "";

    const message =
      `${garageName} Parking\n` +
      `Ticket #${ticket.ticketNumber}${plate}\n` +
      `Checked in: ${checkIn}\n\n` +
      `Show this code at checkout:\n` +
      `${ticket.qrToken}\n\n` +
      `Your attendant can also scan this at checkout. Keep this message handy.`;

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: message,
      from: fromPhone,
      to: formattedPhone,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("[sms]", err);
    const msg = err.message?.includes("unverified")
      ? "On a Twilio trial, you can only text verified numbers. Upgrade your Twilio account to text any number."
      : err.message || "Failed to send SMS.";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

module.exports = { POST };
