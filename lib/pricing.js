const prisma = require("./db");

// Calculates the parking fee for a given duration at a garage.
//
// Tier matching works as follows:
//
// 1. If duration falls within the highest fixed tier (maxHours != null),
//    use that tier's fee directly — simple single-tier match.
//
// 2. If duration exceeds the highest fixed tier AND an open-ended tier
//    (maxHours = null) exists, the highest fixed tier's duration becomes
//    the "period length". Each full period costs the open-ended tier fee.
//    Any remaining time after the last full period is matched against the
//    fixed tiers as normal.
//
//    Example tiers: 1hr=$10, 24hr=$25, beyond=$25
//      25hrs: 1 full period (24hr=$25) + 1hr remainder → $10  = $35 total
//      48hrs: 2 full periods (24hr=$25 each)           + 0    = $50 total
//      50hrs: 2 full periods ($50) + 2hr remainder → $25      = $75 total
//
// 3. If no tiers are configured, falls back to flat hourlyRate × hours.

async function calculateFee(garage, durationMinutes) {
  const tiers = await prisma.rateTier.findMany({
    where: { garageId: garage.id },
    orderBy: [{ maxHours: "asc" }], // nulls (open-ended) sort last
  });

  if (tiers.length > 0) {
    const fixedTiers = tiers.filter((t) => t.maxHours !== null);
    const openTier   = tiers.find((t) => t.maxHours === null);
    const durationHours = durationMinutes / 60;

    // Find the highest fixed tier.
    const maxFixed = fixedTiers.length > 0
      ? fixedTiers.reduce((a, b) => (b.maxHours > a.maxHours ? b : a))
      : null;

    if (openTier && maxFixed && durationHours > maxFixed.maxHours) {
      // Duration exceeds the highest fixed tier — apply repeating periods.
      const periodHours  = maxFixed.maxHours;
      const fullPeriods  = Math.floor(durationHours / periodHours);
      const remainHours  = durationHours - fullPeriods * periodHours;
      const remainMins   = remainHours * 60;

      // Cost of full periods — each period costs the open-ended tier fee.
      const periodCost = fullPeriods * openTier.fee;

      // Cost of remaining time — match against fixed tiers normally.
      let remainCost = 0;
      if (remainHours > 0) {
        const matchedTier = fixedTiers.find((t) => remainHours <= t.maxHours);
        if (matchedTier) {
          remainCost = matchedTier.fee;
        } else {
          // Remainder exceeds all fixed tiers (shouldn't happen since we
          // divided cleanly, but guard anyway) — use flat hourly.
          remainCost = Math.ceil(remainHours) * (garage.hourlyRate || 0);
        }
      }

      const feeAmount = Math.round((periodCost + remainCost) * 100) / 100;
      return { hours: Math.ceil(durationHours), feeAmount, tierUsed: openTier.id };
    }

    // Duration fits within the fixed tiers (or no open-ended tier exists).
    const matched =
      fixedTiers.find((t) => durationHours <= t.maxHours) ||
      openTier;

    if (matched) {
      return {
        hours: Math.ceil(durationHours),
        feeAmount: Math.round(matched.fee * 100) / 100,
        tierUsed: matched.id,
      };
    }
  }

  // No tiers configured — flat hourly rate billed per hour rounded up.
  const hours = Math.ceil(durationMinutes / 60);
  const feeAmount = Math.round(hours * (garage.hourlyRate || 0) * 100) / 100;
  return { hours, feeAmount, tierUsed: null };
}

module.exports = { calculateFee };
