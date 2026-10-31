import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../assets/css/langblue-design-system.css", import.meta.url), "utf8");
const page = readFileSync(new URL("../pages/design-system-preview.html", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../docs/privacy-by-design.md", import.meta.url), "utf8");

test("design system exposes responsive and accessible shared tokens", () => {
  for (const token of ["--lb-bg:", "--lb-green:", "--lb-coral:", "--lb-radius-md:", "--lb-focus:"]) {
    assert.ok(css.includes(token), `missing token: ${token}`);
  }
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});

test("React preview is isolated from public navigation and uses shared styles", () => {
  assert.match(page, /name="robots" content="noindex,nofollow"/);
  assert.match(page, /langblue-design-system\.css/);
  assert.match(page, /react@18\.3\.1/);
  assert.match(page, /createRoot/);
  assert.match(page, /langblue-design-preview/);
});

test("privacy plan records current audit findings and safe rollout constraints", () => {
  assert.match(privacy, /account_activity_registry/);
  assert.match(privacy, /langblue-connection-policy/);
  assert.match(privacy, /langblue-behavior/);
  assert.match(privacy, /us-west-2/);
  assert.match(privacy, /Fail open/);
  assert.match(privacy, /activity registry data to one row per account/);
});

test("analytics is opt-in and enforced server-side", () => {
  const behaviorFunction = readFileSync(new URL("../supabase/functions/langblue-behavior/index.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20261031042818_privacy_first_data_minimization.sql", import.meta.url), "utf8");
  assert.match(migration, /analytics_consent boolean not null default false/);
  assert.match(migration, /drop column if exists ip_address/);
  assert.match(behaviorFunction, /profile\?\.analytics_consent !== true/);
  assert.match(behaviorFunction, /ANALYTICS_DISABLED/);
});

test("connection policy no longer performs IP classification or restrictions", () => {
  const fn = readFileSync(new URL("../supabase/functions/langblue-connection-policy/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fn, /IP_INTELLIGENCE|api\.ipwho|cf-connecting-ip|x-forwarded-for/);
  assert.match(fn, /access_restricted_by_ip: false/);
});

test("activity function is account-based and does not inspect request IP", () => {
  const fn = readFileSync(new URL("../supabase/functions/langblue-activity/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fn, /cf-connecting-ip|x-forwarded-for|x-real-ip|ip_address/);
});

test("shared visual system is linked across public and learning sections", () => {
  const pages = [
    "../index.html",
    "../pages/LangBlue-grammer.html",
    "../pages/vocab.html",
    "../pages/LangBlue-De.html",
    "../pages/LangDesert.html",
    "../pages/Langjp.html",
    "../pages/LangKz.html",
    "../pages/LangTj.html",
    "../pages/teacher-network.html",
    "../pages/teachers.html",
    "../pages/exam.html",
    "../pages/community-access.html",
    "../pages/community-access-admin.html",
    "../pages/learning-engine.html",
    "../pages/server-rest.html",
    "../pages/research.html"
  ];
  for (const path of pages) {
    const html = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(html, /langblue-design-system\.css/, path);
    assert.match(html, /lb-design-system/, path);
  }
});

test("IP minimization keeps page-view deduplication to a 24-hour hash window", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20261031043352_privacy_ip_hash_retention_and_cleanup.sql", import.meta.url), "utf8");
  assert.match(migration, /drop column if exists ip_address/);
  assert.match(migration, /drop column if exists last_ip_hash/);
  assert.match(migration, /drop column if exists browser_ip_hash/);
  assert.match(migration, /interval '24 hours'/);
  assert.doesNotMatch(migration, /interval '90 days'/);
});
