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
  assert.match(privacy, /has not changed production database rows/);
});
