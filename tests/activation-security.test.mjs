import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const coreSource = fs.readFileSync("assets/js/langblue-core.js", "utf8");
const edgeSource = fs.readFileSync("supabase/functions/activate-code/index.ts", "utf8");

function makeRuntime(activateCode) {
  const values = new Map();
  const document = { cookie: "" };
  const window = {};
  const localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  window.LangBlueBackend = {
    CONFIG: { enabled: true },
    activateCode
  };
  window.LangBlueSupabase = {};
  const context = {
    window,
    document,
    localStorage,
    sessionStorage: localStorage,
    crypto: webcrypto,
    TextEncoder,
    console,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(coreSource, context, { filename: "langblue-core.js" });
  localStorage.setItem("lb:session", JSON.stringify({ userId: "test", username: "test" }));
  localStorage.setItem("lb:user:test:user", JSON.stringify({ id: "test", username: "test" }));
  return { window, localStorage };
}

test("unit: activation backend errors are never exposed verbatim", async () => {
  const { window } = makeRuntime(async () => ({
    ok: false,
    error: "PostgREST: relation public.internal_table does not exist; service_role=SECRET"
  }));
  const result = await window.LangBlueCore.subscription.activateAsync("LB-TEST", ["grammar"]);
  assert.equal(result.ok, false);
  assert.equal(result.error, "فعال‌سازی انجام نشد. لطفاً دوباره تلاش کن.");
  assert.doesNotMatch(result.error, /PostgREST|internal_table|SECRET/i);
});

test("unit: known safe activation errors remain user-readable", async () => {
  const { window } = makeRuntime(async () => ({
    ok: false,
    error: "INVALID_OR_USED_CODE"
  }));
  const result = await window.LangBlueCore.subscription.activateAsync("LB-TEST", ["grammar"]);
  assert.equal(result.ok, false);
  assert.equal(result.error, "کد فعال‌سازی نامعتبر، منقضی یا قبلاً استفاده شده است.");
});

test("unit: thrown backend errors are sanitized", async () => {
  const { window } = makeRuntime(async () => {
    throw new Error("database schema=private secrets=do-not-show");
  });
  const result = await window.LangBlueCore.subscription.activateAsync("LB-TEST", ["grammar"]);
  assert.equal(result.ok, false);
  assert.equal(result.error, "فعال‌سازی انجام نشد. لطفاً دوباره تلاش کن.");
  assert.doesNotMatch(result.error, /database|schema|secrets/i);
});

test("integration contract: Edge Function whitelists RPC error codes", () => {
  assert.match(edgeSource, /function publicActivationError\(code: unknown\)/);
  assert.match(edgeSource, /return json\(\{ ok: false, error: publicActivationError\(redeemed\?\.error\) \}, 400\)/);
  assert.doesNotMatch(edgeSource, /return json\(redeemed \|\|/);
});

test("integration contract: frontend does not return raw activation error.message", () => {
  const activationSection = coreSource.slice(
    coreSource.indexOf("const LangBlueSubscription"),
    coreSource.indexOf("  /*\n   * Unified Public API")
  );
  assert.doesNotMatch(activationSection, /error\.message\|\|'FUNCTION_ERROR'/);
  assert.match(activationSection, /publicActivationError\(remote && remote\.error\)/);
});
