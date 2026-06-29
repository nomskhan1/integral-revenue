const prisma = require("./db");

// Calculates the parking fee for a given duration at a garage. If the
// garage has rate tiers configured, the tier whose maxHours first covers
// the (rounded-up) hours parked is used — e.g. a tier with maxHours=1
// covers anything from 0 up to and including 1 hour. The tier with
// maxHours=null (if any) is the open-ended catch-all for anything beyond
// every other tier. If no tiers are configured at all, falls back to the
// garage's flat hourlyRate × hours, exactly as before.
async function calculateFee(garage, durationMinutes) {
  const hours = Math.ceil(durationMinutes / 60);

  const tiers = await prisma.rateTier.findMany({
    where: { garageId: garage.id },
    orderBy: [{ maxHours: "asc" }], // nulls sort last in Postgres ascending
  });

  if (tiers.length > 0) {
    const matched = tiers.find((t) => t.maxHours !== null && hours <= t.maxHours) || tiers.find((t) => t.maxHours === null);
    if (matched) {
      return { hours, feeAmount: Math.round(matched.fee * 100) / 100, tierUsed: matched.id };
    }
    // Tiers exist but none cover this duration (no open-ended tier was
    // ever added) — fall back to the flat rate rather than charging $0.
  }

  const feeAmount = Math.round(hours * (garage.hourlyRate || 0) * 100) / 100;
  return { hours, feeAmount, tierUsed: null };
}

module.exports = { calculateFee };
