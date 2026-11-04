// Server-side policy evaluator. It never calculates an order total or consumes a benefit.
// Callers must supply evidence loaded from trusted server-side records, never browser flags.
const BENEFIT_PERCENT = 7;

export function evaluateGuardianDiscountPolicy(evidence) {
  if (!evidence || !Number.isInteger(evidence.verifiedPaidOrderCount) ||
      evidence.verifiedPaidOrderCount < 0 ||
      typeof evidence.firstPurchaseBenefitConsumed !== "boolean" ||
      typeof evidence.qualifyingReferral !== "boolean" ||
      !Array.isArray(evidence.consumedReferralPeriodKeys)) {
    return { status: "blocked", reason: "TRUSTED_PURCHASE_EVIDENCE_REQUIRED" };
  }

  const firstPurchase = evidence.verifiedPaidOrderCount === 0 &&
    evidence.firstPurchaseBenefitConsumed === false;
  const periodKey = typeof evidence.entitlementPeriodKey === "string"
    ? evidence.entitlementPeriodKey.trim()
    : "";
  const referral = evidence.qualifyingReferral && periodKey.length > 0 &&
    !evidence.consumedReferralPeriodKeys.includes(periodKey);

  const eligibleBenefits = [];
  if (firstPurchase) eligibleBenefits.push("first_purchase");
  if (referral) eligibleBenefits.push("referral_entitlement_period");

  if (eligibleBenefits.length === 0) {
    return { status: "not_eligible", discountPercent: 0, eligibleBenefits: [] };
  }
  if (eligibleBenefits.length > 1) {
    return {
      status: "choice_required",
      discountPercent: BENEFIT_PERCENT,
      eligibleBenefits,
      stackable: false,
    };
  }
  return {
    status: "eligible",
    benefit: eligibleBenefits[0],
    discountPercent: BENEFIT_PERCENT,
    stackable: false,
  };
}
