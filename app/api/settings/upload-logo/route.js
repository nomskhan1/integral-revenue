const { put } = require("@vercel/blob");
const prisma = require("../../../../lib/db");
const { getSessionFromRequest } = require("../../../../lib/auth");

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Only Admin can upload a logo." }), { status: 403 });
  }

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

  const blob = await put(`app-logo/logo.${extension}`, buffer, {
    access: "public",
    contentType: `image/${matches[1]}`,
  });

  // Save the logo URL as an app setting.
  await prisma.appSetting.upsert({
    where: { key: "logoUrl" },
    update: { value: blob.url },
    create: { key: "logoUrl", value: blob.url },
  });

  return new Response(JSON.stringify({ url: blob.url }), { status: 200 });
}

module.exports = { POST };
