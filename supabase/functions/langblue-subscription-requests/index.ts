import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN = "https://lngbl.github.io";
const BUCKET = "langblue-payment-receipts";
const HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer"
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const PRODUCTS = new Set(["grammar", "vocabulary", "deutsch", "arabic", "langjp", "langkz", "langtj"]);
const PLANS = new Set(["irt_7d", "irt_14d", "irt_21d", "irt_3m", "irt_6m", "irt_12m"]);
const now = () => new Date().toISOString();
const clean = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ""));
const hashRequest = async (id: string, requester: string) => {
  const salt = crypto.randomUUID();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id + "|" + requester + "|" + salt));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST" || req.headers.get("Origin") !== ORIGIN) return reply({ ok: false, error: "REQUEST_NOT_ALLOWED" }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const authResult = await auth.auth.getUser(token);
  if (authResult.error || !authResult.data.user) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401);
  const actor = authResult.data.user;
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ ok: false, error: "INVALID_JSON" }, 400); }
  const action = clean(body.action, 40);

  try {
    const isAdmin = async () => {
      const q = await db.from("platform_admins").select("role").eq("user_id", actor.id).maybeSingle();
      if (q.error) throw new Error("ADMIN_AUTHORIZATION_CHECK_FAILED");
      return !!q.data;
    };
    const adultVerified = async () => {
      const q = await db.from("guardian_age_verifications").select("guardian_user_id")
        .eq("guardian_user_id", actor.id).eq("status", "verified")
        .not("verified_at", "is", null).gt("expires_at", now()).maybeSingle();
      if (q.error) throw new Error("AGE_VERIFICATION_LOOKUP_FAILED");
      return !!q.data;
    };
    const profileFor = async (id: string) => {
      const q = await db.from("profiles").select("id,username,name").eq("id", id).maybeSingle();
      if (q.error) throw new Error("PROFILE_LOOKUP_FAILED");
      return q.data;
    };

    if (action === "linked_learners") {
      if (!await adultVerified()) return reply({ ok: false, error: "ADULT_VERIFICATION_REQUIRED" }, 403);
      const links = await db.from("guardian_relationships").select("learner_user_id")
        .eq("guardian_user_id", actor.id).eq("status", "active").contains("scopes", ["account_support"]);
      if (links.error) throw new Error("GUARDIAN_LINKS_LOOKUP_FAILED");
      const ids = [...new Set((links.data || []).map((x: any) => x.learner_user_id).filter(Boolean))];
      const learners = [{ user_id: actor.id, ...(await profileFor(actor.id) || {}), is_self: true }];
      if (ids.length) {
        const p = await db.from("profiles").select("id,username,name").in("id", ids);
        if (p.error) throw new Error("LEARNER_PROFILE_LOOKUP_FAILED");
        for (const row of p.data || []) learners.push({ user_id: row.id, username: row.username, name: row.name, is_self: false });
      }
      return reply({ ok: true, learners });
    }

    if (action === "create") {
      if (!await adultVerified()) return reply({ ok: false, error: "ADULT_VERIFICATION_REQUIRED" }, 403);
      const learnerId = clean(body.learnerUserId, 64);
      const planId = clean(body.planId, 30);
      const productIds = Array.isArray(body.productIds) ? [...new Set(body.productIds.map((x) => clean(x, 30)))] : [];
      if (!uuid(learnerId)) return reply({ ok: false, error: "INVALID_LEARNER_ACCOUNT" }, 400);
      if (!productIds.length || productIds.length > 7 || productIds.some((x) => !PRODUCTS.has(x))) return reply({ ok: false, error: "INVALID_PRODUCTS" }, 400);
      if (!PLANS.has(planId)) return reply({ ok: false, error: "INVALID_PLAN" }, 400);
      if (learnerId !== actor.id) {
        const relation = await db.from("guardian_relationships").select("id")
          .eq("guardian_user_id", actor.id).eq("learner_user_id", learnerId)
          .eq("status", "active").contains("scopes", ["account_support"]).maybeSingle();
        if (relation.error) throw new Error("GUARDIAN_RELATIONSHIP_LOOKUP_FAILED");
        if (!relation.data) return reply({ ok: false, error: "ACTIVE_GUARDIAN_LINK_REQUIRED" }, 403);
      }
      const learnerProfile = await profileFor(learnerId);
      if (!learnerProfile) return reply({ ok: false, error: "LEARNER_ACCOUNT_NOT_FOUND" }, 404);
      const plan = await db.from("plans").select("id,label,days,price_irt,active").eq("id", planId).eq("active", true).maybeSingle();
      if (plan.error) throw new Error("PLAN_LOOKUP_FAILED");
      if (!plan.data || plan.data.days <= 0) return reply({ ok: false, error: "PLAN_UNAVAILABLE" }, 400);

      const amountIrt = Number(plan.data.price_irt) * productIds.length;
      const id = crypto.randomUUID();
      const ext = "jpg";
      const receiptPath = actor.id + "/" + id + "." + ext;
      const requestHash = await hashRequest(id, actor.id);
      const insert = await db.from("subscription_requests").insert({
        id, request_hash: requestHash, requester_user_id: actor.id, learner_user_id: learnerId,
        product_ids: productIds, plan_id: planId, amount_irt: amountIrt, receipt_path: receiptPath,
        discount_preview: { kind: "none", label: "قیمت مصوب پلن × تعداد محصولات", binding: true },
        status: "pending_admin_review"
      }).select("id,request_ref,product_ids,plan_id,amount_irt,receipt_path,status,created_at").single();
      if (insert.error) throw new Error("REQUEST_SAVE_FAILED");

      const signed = await db.storage.from(BUCKET).createSignedUploadUrl(receiptPath, { upsert: false });
      if (signed.error || !signed.data?.token) throw new Error("RECEIPT_UPLOAD_URL_FAILED");
      return reply({
        ok: true, request: { ...insert.data, receipt_path: undefined },
        learner: learnerProfile,
        upload: { path: receiptPath, token: signed.data.token },
        plan: { id: plan.data.id, label: plan.data.label, days: plan.data.days },
        entitlement_changed: false
      });
    }

    if (action === "my_requests") {
      const q = await db.from("subscription_requests")
        .select("request_ref,product_ids,plan_id,amount_irt,status,admin_note,created_at,reviewed_at")
        .eq("requester_user_id", actor.id).order("created_at", { ascending: false }).limit(50);
      if (q.error) throw new Error("REQUEST_HISTORY_LOAD_FAILED");
      return reply({ ok: true, requests: q.data || [] });
    }

    if (action === "admin_list") {
      if (!await isAdmin()) return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const q = await db.from("subscription_requests")
        .select("id,request_ref,request_hash,requester_user_id,learner_user_id,product_ids,plan_id,amount_irt,receipt_path,status,admin_note,created_at,reviewed_at")
        .order("created_at", { ascending: false }).limit(150);
      if (q.error) throw new Error("REQUEST_QUEUE_LOAD_FAILED");
      const ids = [...new Set((q.data || []).flatMap((x: any) => [x.requester_user_id, x.learner_user_id]).filter(Boolean))];
      const profiles = ids.length ? await db.from("profiles").select("id,username,name").in("id", ids) : { data: [], error: null };
      if (profiles.error) throw new Error("REQUEST_ACCOUNT_LOOKUP_FAILED");
      const profileMap = new Map((profiles.data || []).map((x: any) => [x.id, x]));
      const requests = await Promise.all((q.data || []).map(async (x: any) => {
        let receiptUrl: string | null = null;
        if (x.receipt_path) {
          const signed = await db.storage.from(BUCKET).createSignedUrl(x.receipt_path, 300);
          if (!signed.error) receiptUrl = signed.data?.signedUrl || null;
        }
        return {
          ...x, receipt_path: undefined, receipt_url: receiptUrl,
          requester: profileMap.get(x.requester_user_id) || null,
          learner: profileMap.get(x.learner_user_id) || null
        };
      }));
      return reply({ ok: true, requests });
    }

    if (action === "admin_update") {
      if (!await isAdmin()) return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const id = clean(body.id, 64);
      const decision = clean(body.decision, 20);
      const note = clean(body.note, 1000);
      if (!uuid(id) || !["approved", "rejected"].includes(decision)) return reply({ ok: false, error: "INVALID_UPDATE" }, 400);
      const result = await db.rpc("review_subscription_payment", {
        p_request_id: id, p_admin_user_id: actor.id, p_decision: decision, p_note: note || null
      });
      if (result.error) {
        const message = result.error.message || "";
        if (message.includes("RECEIPT_REQUIRED")) return reply({ ok: false, error: "RECEIPT_REQUIRED" }, 409);
        if (message.includes("RECEIPT_FILE_MISSING")) return reply({ ok: false, error: "RECEIPT_FILE_MISSING" }, 409);
        if (message.includes("REQUEST_NOT_PENDING")) return reply({ ok: false, error: "REQUEST_NOT_PENDING" }, 409);
        if (message.includes("PLAN_UNAVAILABLE")) return reply({ ok: false, error: "PLAN_UNAVAILABLE" }, 409);
        throw new Error("PAYMENT_REVIEW_FAILED");
      }
      return reply({ ok: true, result: result.data, entitlement_changed: decision === "approved" });
    }

    return reply({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error ? error.message : "INTERNAL_ERROR" }, 500);
  }
});
