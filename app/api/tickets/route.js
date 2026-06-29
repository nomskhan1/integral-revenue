const crypto = require("crypto");
const QRCode = require("qrcode");
const prisma = require("../../../lib/db");
const { getSessionFromRequest } = require("../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  // Super Admin is scoped to creating Admins and managing garages only.
  if (session.role === "SUPER_ADMIN") {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // e.g. "PARKED"
  const garageIdParam = url.searchParams.get("garageId");

  let where = {};
  if (session.role === "EMPLOYEE" || session.role === "GARAGE_MANAGER") {
    where.garageId = session.garageId || "__none__";
  } else if (garageIdParam) {
    where.garageId = garageIdParam;
  }
  if (status) where.status = status;

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      garage: { select: { name: true, hourlyRate: true } },
      checkedInBy: { select: { name: true } },
      checkedOutBy: { select: { name: true } },
    },
    orderBy: { checkInTime: "desc" },
    take: 300,
  });

  return new Response(JSON.stringify(tickets), { status: 200 });
}

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Only employees and garage managers can check in vehicles." }), {
      status: 403,
    });
  }
  if (!session.garageId) {
    return new Response(JSON.stringify({ error: "Your account isn't assigned to a garage." }), {
      status: 400,
    });
  }

  const body = await req.json();
  const { apartmentNumber, vehicleMake, vehicleModel, vehicleColor, licensePlate, parkingLocation, photoUrl } = body || {};

  // Generate the next sequential ticket number for this garage. Simple and
  // human-readable (e.g. "0042") — uniqueness is enforced at the database
  // level per garage as a safety net against race conditions.
  const lastTicket = await prisma.ticket.findFirst({
    where: { garageId: session.garageId },
    orderBy: { createdAt: "desc" },
    select: { ticketNumber: true },
  });
  const nextNum = lastTicket ? (parseInt(lastTicket.ticketNumber, 10) || 0) + 1 : 1;
  const ticketNumber = String(nextNum);

  const qrToken = crypto.randomBytes(16).toString("hex");

  let ticket;
  try {
    ticket = await prisma.ticket.create({
      data: {
        garageId: session.garageId,
        ticketNumber,
        qrToken,
        status: "PARKED",
        checkInTime: new Date(),
        apartmentNumber: apartmentNumber || null,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleColor: vehicleColor || null,
        licensePlate: licensePlate || null,
        parkingLocation: parkingLocation || null,
        photoUrl: photoUrl || null,
        checkedInById: session.id,
      },
      include: { garage: { select: { name: true } } },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Couldn't create ticket. Please try again." }), {
      status: 500,
    });
  }

  // Render the QR code as a data URL so the frontend can display and print
  // it immediately, with no separate image request needed.
  const qrDataUrl = await QRCode.toDataURL(ticket.qrToken, { width: 300, margin: 1 });

  return new Response(JSON.stringify({ ...ticket, qrDataUrl }), { status: 201 });
}

module.exports = { GET, POST };
