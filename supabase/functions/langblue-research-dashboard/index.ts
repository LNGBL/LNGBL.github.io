import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer"
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders });

function getJwtIssuedAt(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return Number.isFinite(payload.iat) ? Number(payload.iat) : null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const origin = req.headers.get("Origin");
  if (origin !== "https://lngbl.github.io") {
    return json({ ok: false, error: "ORIGIN_NOT_ALLOWED" }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !serviceRoleKey || !anonKey) {
    return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  // Research data is sensitive: require a recently issued access token.
  // The normal Supabase client refreshes tokens, so this does not require a
  // password on every dashboard refresh while limiting the usefulness of
  // a stolen old token.
  const issuedAt = getJwtIssuedAt(token);
  const now = Math.floor(Date.now() / 1000);
  if (!issuedAt || issuedAt > now + 60 || now - issuedAt > 15 * 60) {
    return json({ ok: false, error: "SESSION_TOO_OLD" }, 401);
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) {
    return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: grant, error: grantError } = await admin
    .from("research_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (grantError) {
    return json({ ok: false, error: "AUTHORIZATION_CHECK_FAILED" }, 500);
  }

  if (!grant) {
    return json({ ok: false, error: "RESEARCH_ADMIN_REQUIRED" }, 403);
  }

  const [summary, daily, funnel] = await Promise.all([
    admin.rpc("research_dashboard_summary"),
    admin.from("behavior_event_daily")
      .select("*")
      .order("event_date", { ascending: false })
      .limit(180),
    admin.from("behavior_product_funnel")
      .select("*")
      .order("product_id")
  ]);

  if (summary.error) return json({ ok: false, error: "SUMMARY_QUERY_FAILED" }, 500);
  if (daily.error) return json({ ok: false, error: "DAILY_QUERY_FAILED" }, 500);
  if (funnel.error) return json({ ok: false, error: "FUNNEL_QUERY_FAILED" }, 500);

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    summary: summary.data,
    daily: daily.data || [],
    funnel: funnel.data || []
  });
});
