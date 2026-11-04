import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGuardianDiscountPolicy } from "../supabase/functions/_shared/discount-policy.mjs";

const trusted = {
  verifiedPaidOrderCount: 0,
  firstPurchaseBenefitConsumed: false,
  qualifyingReferral: false,
  entitlementPeriodKey: "period:12m:2026",
  consumedReferralPeriodKeys: [],
};

test("first eligible paid purchase receives one 7 percent policy benefit", () => {
  const result = evaluateGuardianDiscountPolicy(trusted);
  assert.equal(result.status, "eligible");
  assert.equal(result.discountPercent, 7);
  assert.equal(result.benefit, "first_purchase");
});

test("referral benefit is once per exact entitlement period", () => {
  const result = evaluateGuardianDiscountPolicy({
    ...trusted,
    verifiedPaidOrderCount: 1,
    firstPurchaseBenefitConsumed: true,
    qualifyingReferral: true,
  });
  assert.equal(result.status, "eligible");
  assert.equal(result.benefit, "referral_entitlement_period");
  const used = evaluateGuardianDiscountPolicy({
    ...trusted,
    verifiedPaidOrderCount: 1,
    firstPurchaseBenefitConsumed: true,
    qualifyingReferral: true,
    consumedReferralPeriodKeys: ["period:12m:2026"],
  });
  assert.equal(used.status, "not_eligible");
});

test("first purchase and referral never stack", () => {
  const result = evaluateGuardianDiscountPolicy({
    ...trusted,
    qualifyingReferral: true,
  });
  assert.equal(result.status, "choice_required");
  assert.equal(result.discountPercent, 7);
  assert.equal(result.stackable, false);
  assert.deepEqual(result.eligibleBenefits, ["first_purchase", "referral_entitlement_period"]);
});

test("untrusted or incomplete purchase evidence fails closed", () => {
  assert.equal(evaluateGuardianDiscountPolicy({ ...trusted, verifiedPaidOrderCount: "0" }).status, "blocked");
});
