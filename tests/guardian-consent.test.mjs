import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20261104190121_guardian_consent_workflow_foundation.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/langblue-guardian-consent/index.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../pages/guardian-consent.html", import.meta.url), "utf8");
const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("guardian tables deny direct browser roles and use RLS", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.guardian_consent_requests from public, anon, authenticated/i);
  assert.match(migration, /grant all on public\.guardian_consent_requests to service_role/i);
  assert.match(migration, /revoke all on function public\.lb_guardian_accept_request[\s\S]*?from public, anon, authenticated/i);
});

test("guardian acceptance requires separate verified adult status", () => {
  assert.match(migration, /GUARDIAN_AGE_VERIFICATION_REQUIRED/);
  assert.match(migration, /guardian_age_verifications/);
  assert.match(edge, /GUARDIAN_AGE_VERIFICATION_REQUIRED/);
  assert.match(edge, /verify_jwt/); // configured separately below
  assert.match(config, /\[functions\.langblue-guardian-consent\][\s\S]*?verify_jwt = true/);
});

test("guardian requests support rejection, cancellation, revocation and fixed scopes", () => {
  assert.match(edge, /action === "reject" \|\| action === "cancel"/);
  assert.match(edge, /action === "revoke"/);
  assert.match(migration, /learning_progress/);
  assert.match(migration, /research_participation/);
  assert.match(page, /لغو رضایت/);
  assert.match(page, /نام کاربری فقط یک درخواست می‌سازد/);
});

test("guardian UI does not request identity documents or financial data", () => {
  assert.match(page, /هیچ تاریخ تولد، مدرک هویتی، شماره تماس یا نشانی‌ای/);
  assert.match(page, /پذیرش فعلاً بسته است/);
  assert.doesNotMatch(page, /card number|CVV|bank account/i);
});
