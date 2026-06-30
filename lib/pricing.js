const prisma = require("./db");

// Calculates the parking fee for a given duration at a garage.
// maxHours is stored as a float — e.g. 1.75 means 1 hour 45 minutes.
// The tier whose maxHours first covers the actual duration is used.
// The tier with maxHours = null is the open-ended catch-all.
// Falls back to the flat hourlyRate if no tiers are configured.
async function calculateFee(garage, durationMinutes) {
  const tiers = await prisma.rateTier.findMany({
    where: { garageId: garage.id },
    orderBy: [{ maxHours: "asc" }],
  });

  if (tiers.length > 0) {
    const durationHours = durationMinutes / 60;
    const matched =
      tiers.find((t) => t.maxHours !== null && durationHours <= t.maxHours) ||
      tiers.find((t) => t.maxHours === null);
    if (matched) {
      return {
        hours: Math.ceil(durationHours),
        feeAmount: Math.round(matched.fee * 100) / 100,
        tierUsed: matched.id,
      };
    }
  }

  const hours = Math.ceil(durationMinutes / 60);
  const feeAmount = Math.round(hours * (garage.hourlyRate || 0) * 100) / 100;
  return { hours, feeAmount, tierUsed: null };
}

module.exports = { calculateFee };
