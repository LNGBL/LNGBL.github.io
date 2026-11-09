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
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: HEADERS });
const PRODUCTS = new Set(["grammar", "vocabulary", "deutsch", "arabic", "langjp", "langkz", "langtj"]);
const PLANS = new Set(["irt_7d", "irt_14d", "irt_21d", "irt_3m", "irt_6m", "irt_12m"]);
const now = () => new Date().toISOString();
const clean = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ""));
const hashRequest = async (id: string, requester: string) => {
  const salt = crypto.randomUUID();
  const bytes = new TextEncoder().encode(id + "|" + requester + "|" + salt);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST" || req.headers.get("Origin") !== ORIGIN)
    return reply({ ok: false, error: "REQUEST_NOT_ALLOWED" }, 403);

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
    const admin = async () => {
      const q = await db.from("platform_admins").select("role").eq("user_id", actor.id).maybeSingle();
      if (q.error) throw new Error("ADMIN_AUTHORIZATION_CHECK_FAILED");
      return q.data;
    };
    const adultVerified = async () => {
      const q = await db.from("guardian_age_verifications")
        .select("guardian_user_id")
        .eq("guardian_user_id", actor.id)
        .eq("status", "verified")
        .not("verified_at", "is", null)
        .gt("expires_at", now())
        .maybeSingle();
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
      const links = await db.from("guardian_relationships")
        .select("learner_user_id")
        .eq("guardian_user_id", actor.id)
        .eq("status", "active")
        .contains("scopes", ["account_support"]);
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
      const receiptPath = clean(body.receiptPath, 300);
      const amountIrt = Number(body.amountIrt);
      if (!uuid(learnerId)) return reply({ ok: false, error: "INVALID_LEARNER_ACCOUNT" }, 400);
      const productIds = Array.isArray(body.productIds) ? [...new Set(body.productIds.map((x) => clean(x, 30)))].sort() : [];
      const planId = clean(body.planId, 30);
      if (!productIds.length || productIds.length > 7 || productIds.some((x) => !PRODUCTS.has(x)))
        return reply({ ok: false, error: "INVALID_PRODUCTS" }, 400);
      if (!PLANS.has(planId)) return reply({ ok: false, error: "INVALID_PLAN" }, 400);
      if (!Number.isSafeInteger(amountIrt) || amountIrt <= 0 || amountIrt > 1000000000)
        return reply({ ok: false, error: "INVALID_DECLARED_AMOUNT" }, 400);
      if (!receiptPath.startsWith(actor.id + "/") || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(receiptPath.slice(actor.id.length + 1)))
        return reply({ ok: false, error: "INVALID_RECEIPT_PATH" }, 400);

      if (learnerId !== actor.id) {
        const relation = await db.from("guardian_relationships")
          .select("id")
          .eq("guardian_user_id", actor.id)
          .eq("learner_user_id", learnerId)
          .eq("status", "active")
          .contains("scopes", ["account_support"])
          .maybeSingle();
        if (relation.error) throw new Error("GUARDIAN_RELATIONSHIP_LOOKUP_FAILED");
        if (!relation.data) return reply({ ok: false, error: "ACTIVE_GUARDIAN_LINK_REQUIRED" }, 403);
      }
      let guardianConsentId: string | null = null;
      if (learnerId !== actor.id) {
        const consentId = clean(body.guardianConsentId, 64);
        if (!uuid(consentId)) return reply({ ok: false, error: "GUARDIAN_CONSENT_REQUIRED" }, 409);
        const consent = await db.from("subscription_guardian_consents")
          .select("id,product_ids")
          .eq("id", consentId)
          .eq("guardian_user_id", actor.id)
          .eq("learner_user_id", learnerId)
          .eq("decision", "consent")
          .eq("review_status", "approved")
          .eq("plan_id", planId)
          .eq("amount_irt", amountIrt)
          .contains("product_ids", productIds)
          .is("audio_deleted_at", null)
          .gt("retention_until", now())
          .maybeSingle();
        if (consent.error) throw new Error("GUARDIAN_CONSENT_LOOKUP_FAILED");
        if (!consent.data) return reply({ ok: false, error: "GUARDIAN_CONSENT_REQUIRED" }, 409);
        const exactProducts =
          JSON.stringify([...(consent.data.product_ids || [])].sort()) === JSON.stringify([...productIds].sort());
        if (!exactProducts) return reply({ ok: false, error: "GUARDIAN_CONSENT_REQUIRED" }, 409);
        guardianConsentId = consent.data.id;
      }

      const learnerProfile = await profileFor(learnerId);
      if (!learnerProfile) return reply({ ok: false, error: "LEARNER_ACCOUNT_NOT_FOUND" }, 404);

      const file = await db.storage.from(BUCKET).list(actor.id, { search: receiptPath.slice(actor.id.length + 1), limit: 10 });
      const fileName = receiptPath.slice(actor.id.length + 1);
      if (file.error || !(file.data || []).some((x: any) => x.name === fileName))
        return reply({ ok: false, error: "RECEIPT_FILE_MISSING" }, 400);

      const allProducts = PRODUCTS.size === productIds.length && [...PRODUCTS].every((x) => productIds.includes(x));
      const discountPreview = {
        kind: planId === "irt_12m" && allProducts ? "annual_all_products_bundle_review" : "no_discount_preview",
        label: planId === "irt_12m" && allProducts
          ? "قابل بررسی برای تخفیف بستهٔ ۱۲ماههٔ همهٔ محصولات"
          : "مبلغ اعلام‌شده با تصویر رسید توسط مدیر تطبیق داده می‌شود",
        binding: false
      };

      const id = crypto.randomUUID();
      const requestHash = await hashRequest(id, actor.id);
      const insert = await db.from("subscription_requests").insert({
        id,
        request_hash: requestHash,
        requester_user_id: actor.id,
        learner_user_id: learnerId,
        product_ids: productIds,
        plan_id: planId,
        discount_preview: discountPreview,
        amount_irt: amountIrt,
        receipt_path: receiptPath,
        receipt_uploaded_at: now(),
        guardian_consent_id: guardianConsentId,
        status: "pending_admin_review"
      }).select("id,request_ref,request_hash,product_ids,plan_id,amount_irt,discount_preview,status,created_at").single();
      if (insert.error) throw new Error("REQUEST_SAVE_FAILED");
      return reply({ ok: true, request: insert.data, learner: learnerProfile, entitlement_changed: false });
    }

    if (action === "my_requests") {
      const q = await db.from("subscription_requests")
        .select("request_ref,product_ids,plan_id,amount_irt,status,admin_note,created_at,reviewed_at")
        .eq("requester_user_id", actor.id)
        .order("created_at", { ascending: false }).limit(50);
      if (q.error) throw new Error("REQUEST_HISTORY_LOAD_FAILED");
      return reply({ ok: true, requests: q.data || [] });
    }

    if (action === "admin_list" || action === "admin_update") {
      const grant = await admin();
      if (!grant) return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      if (!await adultVerified()) return reply({ ok: false, error: "ADULT_VERIFICATION_REQUIRED" }, 403);
      if (action === "admin_list") {
        const q = await db.from("subscription_requests")
          .select("id,request_ref,request_hash,requester_user_id,learner_user_id,product_ids,plan_id,amount_irt,receipt_path,discount_preview,status,admin_note,created_at,reviewed_at")
          .order("created_at", { ascending: false }).limit(150);
        if (q.error) throw new Error("REQUEST_QUEUE_LOAD_FAILED");
        const ids = [...new Set((q.data || []).flatMap((x: any) => [x.requester_user_id, x.learner_user_id]).filter(Boolean))];
        const profiles = ids.length
          ? await db.from("profiles").select("id,username,name").in("id", ids)
          : { data: [], error: null };
        if (profiles.error) throw new Error("REQUEST_ACCOUNT_LOOKUP_FAILED");
        const map = new Map((profiles.data || []).map((x: any) => [x.id, x]));
        const requests = await Promise.all((q.data || []).map(async (x: any) => {
          const signed = x.receipt_path
            ? await db.storage.from(BUCKET).createSignedUrl(x.receipt_path, 300)
            : { data: null, error: null };
          return {
            ...x,
            receipt_url: signed.data?.signedUrl || null,
            requester: map.get(x.requester_user_id) || null,
            learner: map.get(x.learner_user_id) || null
          };
        }));
        return reply({ ok: true, requests });
      }

      const id = clean(body.id, 64);
      const status = clean(body.status, 40);
      const note = clean(body.note, 1000);
      if (!uuid(id)) return reply({ ok: false, error: "INVALID_UPDATE" }, 400);

      if (status === "approved" || status === "rejected") {
        const decision = await db.rpc("review_subscription_payment", {
          p_request_id: id,
          p_admin_user_id: actor.id,
          p_decision: status,
          p_note: note || null
        });
        if (decision.error) {
          const message = String(decision.error.message || "");
          if (message.includes("RECEIPT_REQUIRED")) return reply({ ok: false, error: "RECEIPT_REQUIRED" }, 409);
          if (message.includes("RECEIPT_FILE_MISSING")) return reply({ ok: false, error: "RECEIPT_FILE_MISSING" }, 409);
          if (message.includes("PLAN_UNAVAILABLE")) return reply({ ok: false, error: "PLAN_UNAVAILABLE" }, 409);
          if (message.includes("GUARDIAN_CONSENT_REQUIRED")) return reply({ ok: false, error: "GUARDIAN_CONSENT_REQUIRED" }, 409);
          if (message.includes("REQUEST_NOT_PENDING")) return reply({ ok: false, error: "REQUEST_NOT_PENDING" }, 409);
          throw new Error("PAYMENT_REVIEW_FAILED");
        }
        return reply({
          ok: true,
          request: decision.data,
          entitlement_changed: status === "approved"
        });
      }

      if (!["needs_info", "reviewed", "closed"].includes(status))
        return reply({ ok: false, error: "INVALID_UPDATE" }, 400);
      const update = await db.from("subscription_requests").update({
        status, admin_note: note || null, reviewed_by: actor.id, reviewed_at: now(), updated_at: now()
      }).eq("id", id).in("status", ["pending_admin_review", "needs_info"])
        .select("id,request_ref,status,admin_note,reviewed_at").maybeSingle();
      if (update.error) throw new Error("REQUEST_UPDATE_FAILED");
      if (!update.data) return reply({ ok: false, error: "REQUEST_NOT_PENDING_OR_NOT_FOUND" }, 409);
      return reply({ ok: true, request: update.data, entitlement_changed: false });
    }

    return reply({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error ? error.message : "INTERNAL_ERROR" }, 500);
  }
});
