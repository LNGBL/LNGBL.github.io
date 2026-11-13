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
  if (["INVALID_CODE", "CODE_INACTIVE", "CODE_ALREADY_USED", "CODE_EXPIRED"].includes(safe)) {
    return "INVALID_OR_USED_CODE";
  }
  if (["PLAN_UNAVAILABLE", "INVALID_PLAN"].includes(safe)) {
    return "PLAN_NOT_FOUND";
  }
  const allowed = new Set([
    "AUTH_REQUIRED",
    "CODE_REQUIRED",
    "INVALID_OR_USED_CODE",
    "PRODUCT_NOT_INCLUDED",
    "SERVER_MAINTENANCE",
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

  // The database RPC locks, validates, and redeems the code atomically.
  // An empty product list means the complete central entitlement on that code.
  const { data: redeemed, error: redeemError } = await admin.rpc("redeem_activation_code", {
    p_user_id: user.id,
    p_code_hash: hash,
    p_product_ids: [],
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

  // The database transaction already validated and returned the plan.
  // No follow-up read can fail after the code has been consumed.
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
