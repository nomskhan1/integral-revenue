const { getSessionFromRequest } = require("../../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "GARAGE_MANAGER", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not authorized." }), { status: 403 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Square not configured." }), { status: 500 });
  }

  const [devicesRes, codesRes] = await Promise.all([
    fetch("https://connect.squareup.com/v2/devices", {
      headers: { "Authorization": `Bearer ${accessToken}`, "Square-Version": "2024-01-18" },
    }),
    fetch("https://connect.squareup.com/v2/devices/codes", {
      headers: { "Authorization": `Bearer ${accessToken}`, "Square-Version": "2024-01-18" },
    }),
  ]);

  const devicesData = await devicesRes.json();
  const codesData = await codesRes.json();

  return new Response(JSON.stringify({
    devices: devicesData.devices || [],
    device_codes: codesData.device_codes || [],
  }), { status: 200 });
}

// POST — creates a device code to pair the Square Terminal with this app
async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || !["ADMIN", "GARAGE_MANAGER", "SUPER_ADMIN"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not authorized." }), { status: 403 });
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!accessToken || !locationId) {
    return new Response(JSON.stringify({ error: "Square not configured." }), { status: 500 });
  }

  const res = await fetch("https://connect.squareup.com/v2/devices/codes", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Square-Version": "2024-01-18",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: `pair-${Date.now()}`,
      device_code: {
        name: "Integral Revenue Terminal",
        product_type: "TERMINAL_API",
        location_id: locationId,
      },
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { status: res.ok ? 200 : 500 });
}

module.exports = { GET, POST };
