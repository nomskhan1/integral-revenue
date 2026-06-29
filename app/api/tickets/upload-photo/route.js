const { put } = require("@vercel/blob");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  const body = await req.json();
  const { imageBase64 } = body || {};

  if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
    return new Response(JSON.stringify({ error: "A valid image is required." }), { status: 400 });
  }

  const approxBytes = imageBase64.length * 0.75;
  if (approxBytes > 4 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "Image is too large. Please use a smaller photo." }), {
      status: 400,
    });
  }

  const matches = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    return new Response(JSON.stringify({ error: "Couldn't read that image." }), { status: 400 });
  }
  const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  try {
    const blob = await put(`ticket-photos/${Date.now()}-${session.id}.${extension}`, buffer, {
      access: "public",
      contentType: `image/${matches[1]}`,
    });
    return new Response(JSON.stringify({ url: blob.url }), { status: 200 });
  } catch (err) {
    console.error("Photo upload failed:", err);
    return new Response(JSON.stringify({ error: "Upload failed. Please try again." }), {
      status: 500,
    });
  }
}

module.exports = { POST };
