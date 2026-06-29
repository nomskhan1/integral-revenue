const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");
const { calculateFee } = require("../../../../lib/pricing");

// Used at checkout: the valet scans the QR code (which "types" the qrToken
// into the input, same as a keyboard) or manually types the ticket number.
// This looks up the matching PARKED ticket either way.
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }
  if (!session.garageId) {
    return new Response(JSON.stringify({ error: "Your account isn't assigned to a garage." }), {
      status: 400,
    });
  }

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  if (!code) {
    return new Response(JSON.stringify({ error: "Scan or type a ticket code." }), { status: 400 });
  }

  // A scanned QR resolves via qrToken (a long hex string). A hand-typed
  // ticket number is short (e.g. "0042") — try both so either works.
  const ticket = await prisma.ticket.findFirst({
    where: {
      garageId: session.garageId,
      status: "PARKED",
      OR: [{ qrToken: code }, { ticketNumber: code }],
    },
    include: { garage: { select: { id: true, name: true, hourlyRate: true } } },
  });

  if (!ticket) {
    return new Response(
      JSON.stringify({ error: "No active (parked) ticket found at your garage matching that code." }),
      { status: 404 }
    );
  }

  // Preview the duration and fee so the valet can confirm with the
  // customer before finalizing the charge.
  const now = new Date();
  const minutes = Math.max(1, Math.round((now - new Date(ticket.checkInTime)) / 60000));
  const { feeAmount: previewFee } = await calculateFee(ticket.garage, minutes);

  return new Response(JSON.stringify({ ...ticket, previewMinutes: minutes, previewFee }), { status: 200 });
}

module.exports = { GET };
