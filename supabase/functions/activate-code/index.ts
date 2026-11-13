import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(value: string) {
  const data = new TextEncoder().encode(value.trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function publicActivationError(code: unknown) {
  const safe = String(code || "").trim().toUpperCase();
  const allowed = new Set([
    "AUTH_REQUIRED",
    "CODE_REQUIRED",
    "INVALID_OR_USED_CODE",
    "PRODUCT_NOT_INCLUDED",
    "SERVER_MAINTENANCE",
    "CODE_LOOKUP_FAILED",
    "ACTIVATION_FAILED",
    "PLAN_NOT_FOUND",
  ]);
  return allowed.has(safe) ? safe : "ACTIVATION_FAILED";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const { data: maintenance } = await admin.rpc("is_langblue_maintenance_window");
  if (maintenance === true) return json({ ok: false, error: "SERVER_MAINTENANCE" }, 503);

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!code) return json({ ok: false, error: "CODE_REQUIRED" }, 400);

  const hash = await sha256(code);

  const { data: row, error: lookupError } = await admin
    .from("activation_codes")
    .select("id,plan_id,product_ids,max_uses,uses,active,expires_at")
    .eq("code_hash", hash)
    .maybeSingle();

  if (lookupError) {
    console.error("Activation code lookup failed:", lookupError);
    return json({ ok: false, error: "CODE_LOOKUP_FAILED" }, 500);
  }

  if (!row || !row.active || Number(row.uses || 0) >= Number(row.max_uses || 1) ||
      (row.expires_at && new Date(row.expires_at) <= new Date())) {
    return json({ ok: false, error: "INVALID_OR_USED_CODE" }, 400);
  }

  // Central policy: activation always applies to the full code entitlement.
  const products = Array.from(new Set((row.product_ids || []).map(String)));
  if (!products.length) return json({ ok: false, error: "PRODUCT_NOT_INCLUDED" }, 403);

  const { data: redeemed, error: redeemError } = await admin.rpc("redeem_activation_code", {
    p_user_id: user.id,
    p_code_hash: hash,
    p_product_ids: products,
  });

  if (redeemError) {
    console.error("Activation redemption failed:", redeemError);
    return json({ ok: false, error: "ACTIVATION_FAILED" }, 500);
  }

  if (!redeemed?.ok) {
    return json({ ok: false, error: publicActivationError(redeemed?.error) }, 400);
  }

  const subscription = redeemed.subscription;
  const plan = redeemed.plan;

  // The database transaction already validated and returned this plan.
  // Avoid a second lookup that could fail after the code has been consumed.
  if (!subscription || !plan || plan.id !== subscription.plan_id) {
    console.error("Activation RPC returned an incomplete subscription or plan payload");
    return json({ ok: false, error: "PLAN_NOT_FOUND" }, 500);
  }

  return json({
    ok: true,
    subscription,
    plan: {
      id: plan.id,
      label: plan.label,
      days: plan.days,
      months: plan.months,
      price_irt: plan.price_irt,
    },
  });
});
