const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const body = await req.json();
  const { ticketId, phone } = body || {};

  if (!ticketId || !phone) {
    return new Response(JSON.stringify({ error: "ticketId and phone are required." }), { status: 400 });
  }

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 10) {
    return new Response(JSON.stringify({ error: "Please enter a valid phone number." }), { status: 400 });
  }
  const formattedPhone = `+1${cleaned.slice(-10)}`;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return new Response(JSON.stringify({ error: "SMS is not configured. Ask your admin to set up Twilio." }), { status: 500 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { garage: { select: { name: true } } },
  });

  if (!ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });
  }

  const vehicleDesc = [ticket.color, ticket.make, ticket.model].filter(Boolean).join(" ") || "Vehicle";
  const checkInTime = new Date(ticket.checkInTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });

  const message = [
    `Parking: ${ticket.garage?.name || "Parking Garage"}`,
    `Ticket #${ticket.ticketNumber}`,
    `Vehicle: ${vehicleDesc}`,
    `Checked in: ${checkInTime}`,
    `Please keep this for checkout.`,
  ].join("\n");

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const twilioRes = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: formattedPhone,
      Body: message,
    }),
  });

  const twilioData = await twilioRes.json();

  if (!twilioRes.ok || twilioData.error_code) {
    return new Response(JSON.stringify({ error: twilioData.message || "Failed to send SMS." }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, sid: twilioData.sid }), { status: 200 });
}

module.exports = { POST };
