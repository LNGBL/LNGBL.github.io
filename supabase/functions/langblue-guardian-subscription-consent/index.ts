import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const ORIGIN = "https://lngbl.github.io";
const BUCKET = "langblue-guardian-consent-audio";
const POLICY_VERSION = "2026-11-09-iran-v1";
const PRODUCTS = new Set(["grammar","vocabulary","deutsch","arabic","langjp","langkz","langtj"]);
const PLANS = new Set(["irt_7d","irt_14d","irt_21d","irt_3m","irt_6m","irt_12m"]);
const HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: HEADERS });
const now = () => new Date().toISOString();
const clean = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ""));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST")
    return reply({ ok: false, error: "REQUEST_NOT_ALLOWED" }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const apiKey = (req.headers.get("apikey") || "").trim();
  let configuredSecretKeys: Record<string, string> = {};
  try {
    configuredSecretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  } catch {
    return reply({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }
  const isSecretApiCall = Object.values(configuredSecretKeys).some((key) => key && key === apiKey);
  const isServiceCall = token === service || isSecretApiCall;
  const origin = req.headers.get("Origin");
  if (origin !== ORIGIN && !(isServiceCall && !origin))
    return reply({ ok: false, error: "REQUEST_NOT_ALLOWED" }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ ok: false, error: "INVALID_JSON" }, 400); }
  const action = clean(body.action, 50);
  if (!isServiceCall && !token) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401);
  if (isServiceCall && !["scheduled_cleanup","scheduled_annual_report"].includes(action))
    return reply({ ok: false, error: "SERVICE_ACTION_NOT_ALLOWED" }, 403);
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  let actor: { id: string };
  if (isServiceCall) {
    actor = { id: "" };
  } else {
    const authResult = await auth.auth.getUser(token);
    if (authResult.error || !authResult.data.user) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401);
    actor = authResult.data.user;
  }
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const adultVerified = async () => {
    const q = await db.from("guardian_age_verifications").select("guardian_user_id")
      .eq("guardian_user_id", actor.id).eq("status", "verified")
      .not("verified_at", "is", null).gt("expires_at", now()).maybeSingle();
    if (q.error) throw new Error("AGE_VERIFICATION_LOOKUP_FAILED");
    return !!q.data;
  };
  const isAdmin = async () => {
    const q = await db.from("platform_admins").select("role").eq("user_id", actor.id).maybeSingle();
    if (q.error) throw new Error("ADMIN_AUTHORIZATION_CHECK_FAILED");
    return !!q.data;
  };
  const validRelationship = async (learnerId: string) => {
    const q = await db.from("guardian_relationships").select("id")
      .eq("guardian_user_id", actor.id).eq("learner_user_id", learnerId)
      .eq("status", "active").contains("scopes", ["account_support"]).maybeSingle();
    if (q.error) throw new Error("GUARDIAN_RELATIONSHIP_LOOKUP_FAILED");
    return !!q.data;
  };
  const profilesFor = async (ids: string[]) => {
    const q = ids.length
      ? await db.from("profiles").select("id,username,name").in("id", ids)
      : { data: [], error: null };
    if (q.error) throw new Error("PROFILE_LOOKUP_FAILED");
    return new Map((q.data || []).map((x: any) => [x.id, x]));
  };

  try {
    if (action === "submit") {
      if (!await adultVerified()) return reply({ ok: false, error: "ADULT_VERIFICATION_REQUIRED" }, 403);
      const learnerId = clean(body.learnerUserId, 64);
      const familyName = clean(body.guardianFamilyName, 100);
      const decision = clean(body.decision, 20);
      const planId = clean(body.planId, 30);
      const amount = Number(body.amountIrt);
      const audioPath = clean(body.audioPath, 300);
      const productIds = Array.isArray(body.productIds)
        ? [...new Set(body.productIds.map((x) => clean(x, 30)))].sort()
        : [];
      if (!uuid(learnerId) || learnerId === actor.id || !familyName || !audioPath)
        return reply({ ok: false, error: "INVALID_CONSENT_INPUT" }, 400);
      if (!await validRelationship(learnerId))
        return reply({ ok: false, error: "ACTIVE_GUARDIAN_LINK_REQUIRED" }, 403);
      if (!productIds.length || productIds.length > PRODUCTS.size || productIds.some((x) => !PRODUCTS.has(x)))
        return reply({ ok: false, error: "INVALID_PRODUCTS" }, 400);
      if (!PLANS.has(planId) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000)
        return reply({ ok: false, error: "INVALID_PLAN_OR_AMOUNT" }, 400);
      if (decision !== "consent" && decision !== "declined")
        return reply({ ok: false, error: "INVALID_DECISION" }, 400);
      if (body.policyVersion !== POLICY_VERSION)
        return reply({ ok: false, error: "POLICY_VERSION_MISMATCH" }, 409);
      const fileName = audioPath.slice(actor.id.length + 1);
      if (!audioPath.startsWith(actor.id + "/") ||
          !/^[0-9a-f-]{36}\.(webm|m4a|ogg|mp3|wav)$/i.test(fileName))
        return reply({ ok: false, error: "INVALID_AUDIO_PATH" }, 400);
      const listed = await db.storage.from(BUCKET).list(actor.id, { search: fileName, limit: 5 });
      const file = (listed.data || []).find((x: any) => x.name === fileName);
      if (listed.error || !file) return reply({ ok: false, error: "AUDIO_FILE_MISSING" }, 400);
      const size = Number(file.metadata?.size || 0);
      if (size > 10 * 1024 * 1024) return reply({ ok: false, error: "AUDIO_TOO_LARGE" }, 400);

      const inserted = await db.from("subscription_guardian_consents").insert({
        learner_user_id: learnerId,
        guardian_user_id: actor.id,
        product_ids: productIds,
        plan_id: planId,
        amount_irt: amount,
        decision,
        audio_path: audioPath,
        policy_version: POLICY_VERSION,
        review_status: "pending_admin_review"
      }).select("id,decision,review_status,created_at").single();
      if (inserted.error) throw new Error("CONSENT_SAVE_FAILED");
      return reply({ ok: true, consent: inserted.data, policyVersion: POLICY_VERSION });
    }

    if (action === "latest_approved") {
      if (!await adultVerified()) return reply({ ok: false, error: "ADULT_VERIFICATION_REQUIRED" }, 403);
      const learnerId = clean(body.learnerUserId, 64);
      const planId = clean(body.planId, 30);
      const amount = Number(body.amountIrt);
      const productIds = Array.isArray(body.productIds)
        ? [...new Set(body.productIds.map((x) => clean(x, 30)))].sort()
        : [];
      if (!uuid(learnerId) || learnerId === actor.id || !await validRelationship(learnerId))
        return reply({ ok: false, error: "ACTIVE_GUARDIAN_LINK_REQUIRED" }, 403);
      const q = await db.from("subscription_guardian_consents")
        .select("id,product_ids,plan_id,amount_irt")
        .eq("guardian_user_id", actor.id).eq("learner_user_id", learnerId)
        .eq("decision", "consent").eq("review_status", "approved")
        .is("audio_deleted_at", null).gt("retention_until", now())
        .eq("plan_id", planId).eq("amount_irt", amount)
        .order("reviewed_at", { ascending: false }).limit(20);
      if (q.error) throw new Error("CONSENT_STATUS_LOOKUP_FAILED");
      const match = (q.data || []).find((x: any) =>
        JSON.stringify([...(x.product_ids || [])].sort()) === JSON.stringify(productIds));
      return reply({ ok: true, approved: !!match, consentId: match?.id || null });
    }

    if (action === "latest_status") {
      if (!await adultVerified()) return reply({ ok: false, error: "ADULT_VERIFICATION_REQUIRED" }, 403);
      const learnerId = clean(body.learnerUserId, 64);
      const planId = clean(body.planId, 30);
      const amount = Number(body.amountIrt);
      const productIds = Array.isArray(body.productIds)
        ? [...new Set(body.productIds.map((x) => clean(x, 30)))].sort()
        : [];
      if (!uuid(learnerId) || learnerId === actor.id || !await validRelationship(learnerId))
        return reply({ ok: false, error: "ACTIVE_GUARDIAN_LINK_REQUIRED" }, 403);
      const q = await db.from("subscription_guardian_consents")
        .select("id,product_ids,decision,review_status")
        .eq("guardian_user_id", actor.id).eq("learner_user_id", learnerId)
        .eq("plan_id", planId).eq("amount_irt", amount)
        .order("created_at", { ascending: false }).limit(30);
      if (q.error) throw new Error("CONSENT_STATUS_LOOKUP_FAILED");
      const match = (q.data || []).find((x: any) =>
        JSON.stringify([...(x.product_ids || [])].sort()) === JSON.stringify(productIds));
      return reply({
        ok: true,
        found: !!match,
        consentId: match?.id || null,
        decision: match?.decision || null,
        reviewStatus: match?.review_status || null,
        approved: !!match && match.decision === "consent" && match.review_status === "approved"
      });
    }

    if (action === "admin_list") {
      if (!await isAdmin() || !await adultVerified())
        return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const q = await db.from("subscription_guardian_consents")
        .select("id,learner_user_id,guardian_user_id,product_ids,plan_id,amount_irt,decision,audio_path,policy_version,review_status,reviewed_by,reviewed_at,retention_until,audio_deleted_at,created_at")
        .order("created_at", { ascending: false }).limit(250);
      if (q.error) throw new Error("CONSENT_QUEUE_LOAD_FAILED");
      const ids = [...new Set((q.data || []).flatMap((x: any) => [x.learner_user_id, x.guardian_user_id, x.reviewed_by]).filter(Boolean))];
      const map = await profilesFor(ids);
      const consents = await Promise.all((q.data || []).map(async (x: any) => {
        const signed = x.audio_path && !x.audio_deleted_at
          ? await db.storage.from(BUCKET).createSignedUrl(x.audio_path, 180)
          : { data: null, error: null };
        return {
          ...x,
          audio_url: signed.data?.signedUrl || null,
          learner: map.get(x.learner_user_id) || null,
          guardian: map.get(x.guardian_user_id) || null,
          reviewer: map.get(x.reviewed_by) || null
        };
      }));
      return reply({ ok: true, consents });
    }

    if (action === "admin_review") {
      if (!await isAdmin() || !await adultVerified())
        return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const id = clean(body.id, 64);
      const status = clean(body.status, 30);
      if (!uuid(id) || !["approved","rejected","acknowledged"].includes(status))
        return reply({ ok: false, error: "INVALID_REVIEW" }, 400);
      const current = await db.from("subscription_guardian_consents")
        .select("id,decision,review_status").eq("id", id).maybeSingle();
      if (current.error) throw new Error("CONSENT_LOOKUP_FAILED");
      if (!current.data || current.data.review_status !== "pending_admin_review")
        return reply({ ok: false, error: "CONSENT_NOT_PENDING" }, 409);
      if (current.data.decision === "consent" && status === "acknowledged")
        return reply({ ok: false, error: "INVALID_REVIEW_STATUS" }, 400);
      if (current.data.decision === "declined" && status === "approved")
        return reply({ ok: false, error: "DECLINED_CONSENT_CANNOT_BE_APPROVED" }, 400);
      const retentionDate = new Date();
      if (status === "approved") retentionDate.setUTCFullYear(retentionDate.getUTCFullYear() + 2);
      else retentionDate.setUTCDate(retentionDate.getUTCDate() + 30);
      const update = await db.from("subscription_guardian_consents").update({
        review_status: status,
        reviewed_by: actor.id,
        reviewed_at: now(),
        retention_until: retentionDate.toISOString()
      }).eq("id", id).eq("review_status", "pending_admin_review")
        .select("id,decision,review_status,reviewed_at,retention_until").maybeSingle();
      if (update.error) throw new Error("CONSENT_REVIEW_UPDATE_FAILED");
      if (!update.data) return reply({ ok: false, error: "CONSENT_NOT_PENDING" }, 409);
      return reply({ ok: true, consent: update.data });
    }

    if (action === "admin_cleanup") {
      if (!await isAdmin() || !await adultVerified())
        return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const due = await db.from("subscription_guardian_consents")
        .select("id,audio_path").lte("retention_until", now()).is("audio_deleted_at", null)
        .not("retention_until", "is", null).limit(500);
      if (due.error) throw new Error("RETENTION_QUEUE_LOAD_FAILED");
      const paths = (due.data || []).map((x: any) => x.audio_path).filter(Boolean);
      if (paths.length) {
        const removed = await db.storage.from(BUCKET).remove(paths);
        if (removed.error) throw new Error("AUDIO_RETENTION_DELETE_FAILED");
        const ids = (due.data || []).map((x: any) => x.id);
        const marked = await db.from("subscription_guardian_consents")
          .update({ audio_deleted_at: now() }).in("id", ids);
        if (marked.error) throw new Error("RETENTION_AUDIT_UPDATE_FAILED");
      }
      return reply({ ok: true, deleted: paths.length });
    }

    if (action === "admin_reports") {
      if (!await isAdmin() || !await adultVerified())
        return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const q = await db.from("guardian_consent_annual_reports")
        .select("id,report_year,storage_path,record_count,generated_at")
        .order("report_year", { ascending: false }).limit(20);
      if (q.error) throw new Error("REPORT_LIST_FAILED");
      const reports = await Promise.all((q.data || []).map(async (r: any) => {
        const signed = await db.storage.from("langblue-guardian-consent-reports").createSignedUrl(r.storage_path, 180);
        return { ...r, url: signed.data?.signedUrl || null };
      }));
      return reply({ ok: true, reports });
    }

    if (action === "scheduled_cleanup") {
      const due = await db.from("subscription_guardian_consents")
        .select("id,audio_path").lte("retention_until", now()).is("audio_deleted_at", null)
        .not("retention_until", "is", null).limit(500);
      if (due.error) throw new Error("RETENTION_QUEUE_LOAD_FAILED");
      const paths = (due.data || []).map((x: any) => x.audio_path).filter(Boolean);
      if (paths.length) {
        const removed = await db.storage.from(BUCKET).remove(paths);
        if (removed.error) throw new Error("AUDIO_RETENTION_DELETE_FAILED");
        const marked = await db.from("subscription_guardian_consents")
          .update({ audio_deleted_at: now() }).in("id", (due.data || []).map((x: any) => x.id));
        if (marked.error) throw new Error("RETENTION_AUDIT_UPDATE_FAILED");
      }
      return reply({ ok: true, deleted: paths.length });
    }

    if (action === "scheduled_annual_report") {
      const year = Number(body.year || (new Date().getUTCFullYear() - 1));
      if (!Number.isInteger(year) || year < 2020 || year > new Date().getUTCFullYear())
        return reply({ ok: false, error: "INVALID_REPORT_YEAR" }, 400);
      const existing = await db.from("guardian_consent_annual_reports")
        .select("id,report_year,record_count,generated_at").eq("report_year", year).maybeSingle();
      if (existing.error) throw new Error("REPORT_LOOKUP_FAILED");
      if (existing.data) return reply({ ok: true, alreadyGenerated: true, report: existing.data });
      const start = new Date(Date.UTC(year, 0, 1)).toISOString();
      const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
      const q = await db.from("subscription_guardian_consents")
        .select("id,learner_user_id,guardian_user_id,product_ids,plan_id,decision,review_status,created_at,reviewed_at,reviewed_by")
        .gte("created_at", start).lt("created_at", end)
        .in("review_status", ["approved","rejected","acknowledged"])
        .order("created_at", { ascending: true }).limit(5000);
      if (q.error) throw new Error("ANNUAL_REPORT_LOAD_FAILED");
      const ids = [...new Set((q.data || []).flatMap((x: any) => [x.learner_user_id, x.guardian_user_id, x.reviewed_by]).filter(Boolean))];
      const map = await profilesFor(ids);
      const pdf = await PDFDocument.create();
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let page = pdf.addPage([842, 595]);
      let y = 555;
      const safe = (v: unknown) => String(v ?? "").replace(/[^\x20-\x7E]/g, "?").slice(0, 40);
      const addPage = () => { page = pdf.addPage([842, 595]); y = 555; };
      page.drawText("LangBlue - Annual Guardian Consent Review", { x: 36, y, size: 16, font: bold, color: rgb(0.05,0.16,0.23) });
      y -= 24;
      page.drawText("Report year: " + year + " | Generated: " + now() + " | Reviewed records: " + (q.data || []).length, { x: 36, y, size: 9, font: regular });
      y -= 24;
      const headers = "Ref       Learner        Guardian       Decision      Review         Submitted (UTC)        Products / Plan";
      page.drawText(headers, { x: 36, y, size: 8, font: bold });
      y -= 14;
      for (const row of (q.data || [])) {
        if (y < 35) addPage();
        const line = [
          String(row.id).slice(0,8),
          safe(map.get(row.learner_user_id)?.username || "—"),
          safe(map.get(row.guardian_user_id)?.username || "—"),
          safe(row.decision),
          safe(row.review_status),
          safe(row.created_at),
          safe([...(row.product_ids || []), row.plan_id].join(","))
        ].join(" | ");
        page.drawText(line, { x: 36, y, size: 7, font: regular });
        y -= 11;
      }
      if (!(q.data || []).length) page.drawText("No reviewed consent records for this year.", { x: 36, y, size: 10, font: regular });
      const bytes = await pdf.save();
      const path = "annual/guardian-consent-" + year + ".pdf";
      const uploaded = await db.storage.from("langblue-guardian-consent-reports")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (uploaded.error) throw new Error("REPORT_PDF_UPLOAD_FAILED");
      const saved = await db.from("guardian_consent_annual_reports").insert({
        report_year: year, storage_path: path, record_count: (q.data || []).length
      }).select("id,report_year,record_count,generated_at").single();
      if (saved.error) throw new Error("REPORT_METADATA_SAVE_FAILED");
      return reply({ ok: true, report: saved.data });
    }

    if (action === "admin_annual_report") {
      if (!await isAdmin() || !await adultVerified())
        return reply({ ok: false, error: "ADMIN_UNAUTHORIZED" }, 403);
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 2020 || year > new Date().getUTCFullYear())
        return reply({ ok: false, error: "INVALID_REPORT_YEAR" }, 400);
      const start = new Date(Date.UTC(year, 0, 1)).toISOString();
      const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
      const q = await db.from("subscription_guardian_consents")
        .select("id,learner_user_id,guardian_user_id,product_ids,plan_id,decision,review_status,created_at,reviewed_at,reviewed_by,audio_deleted_at")
        .gte("created_at", start).lt("created_at", end)
        .in("review_status", ["approved","rejected","acknowledged"])
        .order("created_at", { ascending: true }).limit(5000);
      if (q.error) throw new Error("ANNUAL_REPORT_LOAD_FAILED");
      const ids = [...new Set((q.data || []).flatMap((x: any) => [x.learner_user_id, x.guardian_user_id, x.reviewed_by]).filter(Boolean))];
      const map = await profilesFor(ids);
      const rows = (q.data || []).map((x: any) => ({
        consent_ref: x.id,
        learner_username: map.get(x.learner_user_id)?.username || "—",
        guardian_username: map.get(x.guardian_user_id)?.username || "—",
        decision: x.decision,
        review_status: x.review_status,
        products: x.product_ids,
        plan_id: x.plan_id,
        submitted_at: x.created_at,
        reviewed_at: x.reviewed_at,
        reviewer_username: map.get(x.reviewed_by)?.username || "—",
        audio_deleted: !!x.audio_deleted_at
      }));
      return reply({ ok: true, year, generatedAt: now(), total: rows.length, rows });
    }

    return reply({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error ? error.message : "INTERNAL_ERROR" }, 500);
  }
});
