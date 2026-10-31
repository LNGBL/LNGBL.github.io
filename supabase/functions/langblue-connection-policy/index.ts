import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
function coarseCountry(req: Request): string | null {
  const value = String(req.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) && value !== "XX" ? value : null;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("connection_policy_status").eq("id", user.id).maybeSingle();
  if (profileError) return json({ ok: false, error: "PROFILE_LOOKUP_FAILED" }, 500);
  if (profile && profile.connection_policy_status !== "normal") {
    const { error } = await admin.from("profiles").update({
      connection_policy_status: "normal",
      connection_grace_started_at: null,
      connection_grace_expires_at: null,
      connection_suspended_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) return json({ ok: false, error: "POLICY_RESET_FAILED" }, 500);
  }
  return json({
    ok: true,
    status: "normal",
    privacy_profile: "universal-minimal",
    region_hint: coarseCountry(req),
    region_hint_is_approximate: true,
    access_restricted_by_ip: false,
  });
});
