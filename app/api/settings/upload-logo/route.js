const { put } = require("@vercel/blob");
const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can upload a logo." }), { status: 403 });
  }

  try {
    const body = await req.json();
    const { imageBase64 } = body || {};

    if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "A valid image is required." }), { status: 400 });
    }

    const matches = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return new Response(JSON.stringify({ error: "Couldn't read that image." }), { status: 400 });
    }

    const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    let blobUrl;
    try {
      const blob = await put(`app-logo/logo.${extension}`, buffer, {
        access: "public",
        contentType: `image/${matches[1]}`,
      });
      blobUrl = blob.url;
    } catch (blobErr) {
      console.error("[upload-logo] Blob upload failed:", blobErr);
      return new Response(JSON.stringify({ error: "Image storage failed: " + blobErr.message }), { status: 500 });
    }

    try {
      await prisma.appSetting.upsert({
        where: { key: "logoUrl" },
        update: { value: blobUrl },
        create: { key: "logoUrl", value: blobUrl },
      });
    } catch (dbErr) {
      console.error("[upload-logo] DB save failed:", dbErr);
      return new Response(JSON.stringify({ error: "Database save failed: " + dbErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ url: blobUrl }), { status: 200 });
  } catch (err) {
    console.error("[upload-logo] Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), { status: 500 });
  }
}

module.exports = { POST };
