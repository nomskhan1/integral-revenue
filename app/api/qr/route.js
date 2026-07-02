const QRCode = require("qrcode");
const { getSessionFromRequest } = require("../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response(JSON.stringify({ error: "Token required." }), { status: 400 });

  const dataUrl = await QRCode.toDataURL(token, { width: 200, margin: 1 });
  return new Response(JSON.stringify({ dataUrl }), { status: 200 });
}

module.exports = { GET };
