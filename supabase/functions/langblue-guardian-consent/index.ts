import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN = "https://lngbl.github.io";
const POLICY_VERSION = "2026-11-04-v1";
const ALLOWED_SCOPES = new Set([
  "account_support",
  "learning_progress",
  "community_features",
  "research_participation",
]);
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function cleanScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter((item) => ALLOWED_SCOPES.has(item)))];
}

function safeError(error: unknown) {
  const code = String(typeof error === "string" ? error : ((error as { message?: string })?.message || "")).toUpperCase();
  const known = [
    "INVALID_GUARDIAN", "POLICY_VERSION_MISMATCH", "INVALID_SCOPES",
    "REQUEST_ALREADY_PENDING", "REQUEST_NOT_AVAILABLE",
    "GUARDIAN_AGE_VERIFICATION_REQUIRED", "INVALID_ACCEPTED_SCOPES",
    "ACTIVE_RELATIONSHIP_ALREADY_EXISTS", "NOT_AUTHORIZED",
    "RELATIONSHIP_NOT_AVAILABLE",
  ];
  return known.find((item) => code.includes(item)) || "REQUEST_FAILED";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST" || req.headers.get("Origin") !== ORIGIN) {
    return json({ ok: false, error: "REQUEST_NOT_ALLOWED" }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const uid = authData.user.id;
  const action = String(body.action || "");

  if (action === "request") {
    if (body.confirmedUnder18 !== true) return json({ ok: false, error: "MINOR_DECLARATION_REQUIRED" }, 400);
    const username = String(body.guardianUsername || "").trim().toLowerCase();
    if (username.length < 3 || username.length > 80 || /\s/.test(username)) {
      return json({ ok: false, error: "INVALID_GUARDIAN_USERNAME" }, 400);
    }
    const scopes = cleanScopes(body.scopes);
    if (!scopes.length || scopes.length > 4) return json({ ok: false, error: "INVALID_SCOPES" }, 400);

    const recent = await db.from("guardian_consent_requests")
      .select("id", { count: "exact", head: true })
      .eq("learner_user_id", uid)
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (recent.error) return json({ ok: false, error: "DATABASE_ERROR" }, 500);
    if ((recent.count || 0) >= 5) return json({ ok: false, error: "REQUEST_RATE_LIMITED" }, 429);

    const guardian = await db.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (guardian.error) return json({ ok: false, error: "GUARDIAN_LOOKUP_FAILED" }, 500);
    if (!guardian.data || guardian.data.id === uid) return json({ ok: false, error: "GUARDIAN_NOT_FOUND" }, 404);

    const created = await db.rpc("lb_guardian_create_request", {
      p_learner_user_id: uid,
      p_guardian_user_id: guardian.data.id,
      p_scopes: scopes,
      p_policy_version: POLICY_VERSION,
    });
    if (created.error) return json({ ok: false, error: "REQUEST_CREATE_FAILED" }, 500);
    if (!created.data?.ok) return json({ ok: false, error: safeError(created.data?.error) }, 409);
    return json({ ok: true, requestId: created.data.request_id, policyVersion: POLICY_VERSION });
  }

  if (action === "overview") {
    const now = new Date().toISOString();
    const [expireLearner, expireGuardian] = await Promise.all([
      db.from("guardian_consent_requests").update({ status: "expired", responded_at: now })
        .eq("learner_user_id", uid).eq("status", "pending").lte("expires_at", now),
      db.from("guardian_consent_requests").update({ status: "expired", responded_at: now })
        .eq("guardian_user_id", uid).eq("status", "pending").lte("expires_at", now),
    ]);
    if (expireLearner.error || expireGuardian.error) return json({ ok: false, error: "EXPIRY_UPDATE_FAILED" }, 500);
    const [pendingForMe, myRequests, relationships, verification] = await Promise.all([
      db.from("guardian_consent_requests")
        .select("id,learner_user_id,requested_scopes,policy_version,created_at,expires_at")
        .eq("guardian_user_id", uid).eq("status", "pending").gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(20),
      db.from("guardian_consent_requests")
        .select("id,guardian_user_id,requested_scopes,policy_version,status,created_at,expires_at,responded_at")
        .eq("learner_user_id", uid).order("created_at", { ascending: false }).limit(20),
      db.from("guardian_relationships")
        .select("id,learner_user_id,guardian_user_id,scopes,policy_version,status,accepted_at,revoked_at")
        .or(`learner_user_id.eq.${uid},guardian_user_id.eq.${uid}`)
        .order("accepted_at", { ascending: false }).limit(30),
      db.from("guardian_age_verifications")
        .select("status,verified_at,expires_at")
        .eq("guardian_user_id", uid).maybeSingle(),
    ]);
    if (pendingForMe.error || myRequests.error || relationships.error || verification.error) {
      return json({ ok: false, error: "OVERVIEW_LOAD_FAILED" }, 500);
    }

    const otherIds = new Set<string>();
    for (const row of pendingForMe.data || []) otherIds.add(row.learner_user_id);
    for (const row of myRequests.data || []) otherIds.add(row.guardian_user_id);
    for (const row of relationships.data || []) {
      otherIds.add(row.learner_user_id === uid ? row.guardian_user_id : row.learner_user_id);
    }
    const ids = [...otherIds];
    const profiles = ids.length
      ? await db.from("profiles").select("id,username,name").in("id", ids)
      : { data: [], error: null };
    if (profiles.error) return json({ ok: false, error: "PROFILE_LOOKUP_FAILED" }, 500);
    const profileMap = new Map((profiles.data || []).map((p) => [p.id, { username: p.username, name: p.name }]));
    const attach = (row: Record<string, unknown>, idField: string) => ({
      ...row,
      otherAccount: profileMap.get(String(row[idField])) || null,
    });
    const verified = verification.data?.status === "verified"
      && !!verification.data.verified_at
      && !!verification.data.expires_at
      && new Date(verification.data.expires_at).getTime() > Date.now();

    return json({
      ok: true,
      policyVersion: POLICY_VERSION,
      guardianAgeVerified: verified,
      pendingForMe: (pendingForMe.data || []).map((row) => attach(row, "learner_user_id")),
      myRequests: (myRequests.data || []).map((row) => attach(row, "guardian_user_id")),
      relationships: (relationships.data || []).map((row) => ({
        ...row,
        role: row.learner_user_id === uid ? "learner" : "guardian",
        otherAccount: profileMap.get(row.learner_user_id === uid ? row.guardian_user_id : row.learner_user_id) || null,
      })),
    });
  }

  if (action === "accept") {
    const requestId = String(body.requestId || "");
    const scopes = cleanScopes(body.scopes);
    if (!requestId || !scopes.length) return json({ ok: false, error: "INVALID_ACCEPTANCE" }, 400);
    const result = await db.rpc("lb_guardian_accept_request", {
      p_request_id: requestId,
      p_guardian_user_id: uid,
      p_scopes: scopes,
    });
    if (result.error) return json({ ok: false, error: "ACCEPTANCE_FAILED" }, 500);
    if (!result.data?.ok) {
      const error = safeError(result.data?.error);
      return json({ ok: false, error }, error === "GUARDIAN_AGE_VERIFICATION_REQUIRED" ? 403 : 409);
    }
    return json({ ok: true, relationshipId: result.data.relationship_id });
  }

  if (action === "reject" || action === "cancel") {
    const requestId = String(body.requestId || "");
    if (!requestId) return json({ ok: false, error: "REQUEST_ID_REQUIRED" }, 400);
    const result = await db.rpc("lb_guardian_close_request", {
      p_request_id: requestId,
      p_actor_user_id: uid,
      p_action: action,
    });
    if (result.error) return json({ ok: false, error: "REQUEST_UPDATE_FAILED" }, 500);
    if (!result.data?.ok) return json({ ok: false, error: safeError(result.data?.error) }, 409);
    return json({ ok: true, status: result.data.status });
  }

  if (action === "revoke") {
    const relationshipId = String(body.relationshipId || "");
    if (!relationshipId) return json({ ok: false, error: "RELATIONSHIP_ID_REQUIRED" }, 400);
    const result = await db.rpc("lb_guardian_revoke_relationship", {
      p_relationship_id: relationshipId,
      p_actor_user_id: uid,
    });
    if (result.error) return json({ ok: false, error: "REVOCATION_FAILED" }, 500);
    if (!result.data?.ok) return json({ ok: false, error: safeError(result.data?.error) }, 409);
    return json({ ok: true, status: "revoked" });
  }

  return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
});
