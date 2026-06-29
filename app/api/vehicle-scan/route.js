const Anthropic = require("@anthropic-ai/sdk");
const { getSessionFromRequest } = require("../../../lib/auth");

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["EMPLOYEE", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Vehicle photo scanning isn't set up yet. An admin needs to add an ANTHROPIC_API_KEY to enable it.",
      }),
      { status: 503 }
    );
  }

  const body = await req.json();
  const { imageBase64 } = body || {};
  if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
    return new Response(JSON.stringify({ error: "A valid image is required." }), { status: 400 });
  }

  const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    return new Response(JSON.stringify({ error: "Couldn't read that image." }), { status: 400 });
  }
  const mediaType = match[1] === "jpg" ? "jpeg" : match[1];
  const base64Data = match[2];

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: `image/${mediaType}`, data: base64Data },
            },
            {
              type: "text",
              text:
                "Look at this photo of a vehicle. Identify its make, model, color, and license " +
                "plate number if visible. Respond with ONLY a JSON object, no other text, in " +
                'exactly this format: {"make": "...", "model": "...", "color": "...", "licensePlate": "..."}. ' +
                'If you cannot determine a field, use an empty string for it. For licensePlate, only ' +
                "include it if you can read it clearly and with reasonable confidence — otherwise leave it empty.",
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text || "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { make: "", model: "", color: "", licensePlate: "" };
    }

    return new Response(
      JSON.stringify({
        make: parsed.make || "",
        model: parsed.model || "",
        color: parsed.color || "",
        licensePlate: parsed.licensePlate || "",
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Vehicle scan failed:", err);
    return new Response(JSON.stringify({ error: "Couldn't analyze that photo. Please try again or enter details manually." }), {
      status: 500,
    });
  }
}

module.exports = { POST };
