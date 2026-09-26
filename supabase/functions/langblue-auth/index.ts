import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authEmail(username: string) {
  const bytes = new TextEncoder().encode(String(username || "").trim().toLowerCase());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const token = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return "u-" + token + "@accounts.langblue.local";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRoleKey || !anonKey) return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

  let body: { action?: string; username?: string; password?: string; profile?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const action = String(body.action || "").trim().toLowerCase();

  if (!username || !password) return json({ ok: false, error: "CREDENTIALS_REQUIRED" }, 400);
  if (!/^[^\s]{3,80}$/.test(username)) return json({ ok: false, error: "INVALID_USERNAME" }, 400);
  if (password.length < 6 || password.length > 200) return json({ ok: false, error: "INVALID_PASSWORD" }, 400);
  if (!["login", "signup"].includes(action)) return json({ ok: false, error: "INVALID_ACTION" }, 400);

  const email = authEmail(username);
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (action === "signup") {
    const { data: existing, error: existingError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existingError) return json({ ok: false, error: "AUTH_LOOKUP_FAILED" }, 500);
    if ((existing?.users || []).some((u) => String(u.email || "").toLowerCase() === email)) {
      return json({ ok: false, error: "USERNAME_EXISTS" }, 409);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: body.profile || {},
    });
    if (createError || !created?.user) {
      console.error(createError);
      return json({ ok: false, error: "BACKEND_SIGNUP_FAILED" }, 400);
    }
  }

  const { data: signed, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signed.session || !signed.user) {
    return json({ ok: false, error: action === "signup" ? "BACKEND_SIGNUP_FAILED" : "INVALID_CREDENTIALS" }, 401);
  }

  if (body.profile && typeof body.profile === "object") {
    await admin.from("profiles").upsert({
      id: signed.user.id,
      name: String(body.profile.name || body.profile.fullName || "").trim(),
      username,
      sex: String(body.profile.sex || body.profile.gender || "").trim() || null,
      country: body.profile.country ? String(body.profile.country) : null,
      country_name: body.profile.countryName ? String(body.profile.countryName) : null,
      currency: body.profile.currency ? String(body.profile.currency) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  }

  return json({
    ok: true,
    created: action === "signup",
    user: signed.user,
    session: signed.session,
  });
});