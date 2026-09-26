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

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  const requested = Array.isArray(body.productIds)
    ? Array.from(new Set(body.productIds.map(String).filter(Boolean)))
    : [];

  if (!code) return json({ ok: false, error: "CODE_REQUIRED" }, 400);

  const hash = await sha256(code);

  // Read-only lookup: do not consume the code here.
  // Actual redemption is performed atomically by redeem_activation_code().
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

  const products = Array.from(new Set((row.product_ids || []).map(String)));
  const selected = requested.length
    ? requested.filter((p) => products.includes(p))
    : products;

  if (!selected.length) return json({ ok: false, error: "PRODUCT_NOT_INCLUDED" }, 403);

  // The database function locks the code row and writes the subscription
  // before incrementing usage, so a failed redemption cannot leave a consumed code.
  const { data: redeemed, error: redeemError } = await admin.rpc("redeem_activation_code", {
    p_user_id: user.id,
    p_code_hash: hash,
    p_product_ids: selected,
  });

  if (redeemError) {
    console.error("Activation redemption failed:", redeemError);
    return json({ ok: false, error: "ACTIVATION_FAILED" }, 500);
  }

  if (!redeemed?.ok) {
    return json(redeemed || { ok: false, error: "ACTIVATION_FAILED" }, 400);
  }

  const subscription = redeemed.subscription;
  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id,label,days,months,price_irt")
    .eq("id", subscription.plan_id)
    .eq("active", true)
    .single();

  if (planError || !plan) return json({ ok: false, error: "PLAN_NOT_FOUND" }, 500);

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
