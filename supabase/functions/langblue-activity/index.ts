import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
  const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, error: "INVALID_SESSION" }, 401);
  let body: Record<string, unknown> = {};
  try { const raw = await req.text(); if (raw) body = JSON.parse(raw); } catch { /* non-blocking activity */ }
  const language = typeof body.practice_language === "string" ? body.practice_language.trim().toLowerCase() : null;
  const section = typeof body.practice_section === "string" ? body.practice_section.trim().toLowerCase() : null;
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("username").eq("id", userData.user.id).maybeSingle();
  if (profileError || !profile?.username) return json({ ok: false, error: "PROFILE_NOT_FOUND" }, 404);
  const username = String(profile.username).trim().toLowerCase();
  const now = new Date();
  const { data: leaderboard } = await admin.from("leaderboard")
    .select("user_id, practice_languages, practice_sections")
    .eq("user_id", userData.user.id).maybeSingle();
  if (leaderboard) {
    const languages = Array.isArray(leaderboard.practice_languages) ? [...leaderboard.practice_languages] : [];
    const sections = Array.isArray(leaderboard.practice_sections) ? [...leaderboard.practice_sections] : [];
    if (language && !languages.includes(language)) languages.push(language);
    if (section && !sections.includes(section)) sections.push(section);
    await admin.from("leaderboard").update({
      practice_languages: languages, practice_sections: sections,
      last_active_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("user_id", userData.user.id);
  }
  const { data: row, error: rowError } = await admin.from("account_activity_registry")
    .select("id, active_seconds, last_activity_at, qualified_24h")
    .eq("user_id", userData.user.id).eq("username", username).maybeSingle();
  if (rowError) return json({ ok: false, error: "ACTIVITY_LOOKUP_FAILED" }, 500);
  if (!row) return json({
    ok: true, registered: false, ip_available: false,
    leaderboard_active: Boolean(leaderboard), error: "ACCOUNT_NOT_REGISTERED",
    practice_language: language, practice_section: section,
  });
  const last = new Date(row.last_activity_at).getTime();
  const elapsed = Math.max(0, Math.min(300, Math.floor((now.getTime() - last) / 1000)));
  const activeSeconds = Number(row.active_seconds || 0) + elapsed;
  const qualified = Boolean(row.qualified_24h) || activeSeconds >= 86400;
  const patch: Record<string, unknown> = {
    active_seconds: activeSeconds, last_activity_at: now.toISOString(),
    updated_at: now.toISOString(), qualified_24h: qualified,
  };
  if (language) patch.practice_language = language;
  if (section) patch.practice_section = section;
  if (qualified && !row.qualified_24h) patch.qualified_at = now.toISOString();
  const { error: updateError } = await admin.from("account_activity_registry")
    .update(patch).eq("id", row.id);
  if (updateError) return json({ ok: false, error: "ACTIVITY_UPDATE_FAILED" }, 500);
  return json({
    ok: true, registered: true, qualified_24h: qualified,
    active_seconds: activeSeconds, practice_language: language, practice_section: section,
  });
});
