import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const policy = readFileSync(new URL("../docs/policies/central-access-legal-and-commerce-specification.md", import.meta.url), "utf8");
const account = readFileSync(new URL("../assets/js/langblue-central-account.js", import.meta.url), "utf8");

test("Central Access policy documents guardian approval and revocation safeguards", () => {
  assert.match(policy, /guardian must sign in to their own account/i);
  assert.match(policy, /Revocation stops future actions/i);
  assert.match(policy, /Do not request identity documents by default/i);
});

test("Central Access policy records the latest 7 percent discount rules and legacy conflicts", () => {
  assert.match(policy, /First-purchase benefit: 7% once/i);
  assert.match(policy, /Referral benefit: a qualifying invited learner may receive 7% once/i);
  assert.match(policy, /No stacking/i);
  assert.match(policy, /current commerce code has a 10% discount/i);
  assert.match(policy, /older\/current-code promotion logic/i);
});

test("Central Access policy documents activation token and consumer rights controls", () => {
  assert.match(policy, /Consume the token atomically/i);
  assert.match(policy, /cancellation method and effective time/i);
  assert.match(policy, /refund eligibility, timing, method/i);
  assert.match(policy, /not legal advice/i);
});

test("Central Access account UI explains server-authoritative access and payment boundary", () => {
  assert.match(account, /وضعیت دسترسی ثبت‌شده در سرور/);
  assert.match(account, /این بخش پرداخت دریافت نمی‌کند/);
  assert.match(account, /کد فعال‌سازی نباید در فیش/);
  assert.match(account, /ورود سرپرست به حساب خودش/);
  assert.match(account, /تحلیل اختیاری محصول از دسترسی آموزشی جداست/);
});
