import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRoleKey || !anonKey) {
    return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
  const token = authHeader.slice(7).trim();
  if (!token) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: grant, error: grantError } = await admin
    .from("research_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (grantError) return json({ ok: false, error: "AUTHORIZATION_CHECK_FAILED" }, 500);
  if (!grant) return json({ ok: false, error: "RESEARCH_ADMIN_REQUIRED" }, 403);

  const [summary, daily, funnel] = await Promise.all([
    admin.rpc("research_dashboard_summary"),
    admin.from("behavior_event_daily").select("*").order("event_date", { ascending: false }).limit(180),
    admin.from("behavior_product_funnel").select("*").order("product_id")
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