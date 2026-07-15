const { getSessionFromRequest } = require("../../../../lib/auth");

// GET — lists all Square Terminal devices registered to this account.
// Used to find the device_id of the paired Square Reader so we can
// send payment requests directly to it via the Terminal API.
async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "GARAGE_MANAGER", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not authorized." }), { status: 403 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Square not configured." }), { status: 500 });
  }

  const res = await fetch("https://connect.squareup.com/v2/devices", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
    },
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { status: 200 });
}

module.exports = { GET };
