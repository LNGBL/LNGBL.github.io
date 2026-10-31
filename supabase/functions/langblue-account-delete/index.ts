import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ ok: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }
  if (body.confirm !== true) return json({ ok: false, error: "DELETE_CONFIRMATION_REQUIRED" }, 400);

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("username").eq("id", user.id).maybeSingle();
  if (profileError) return json({ ok: false, error: "PROFILE_LOOKUP_FAILED" }, 500);

  const keepExamContent = body.keep_exam_content === true;
  if (keepExamContent) {
    const { error } = await admin.from("question_pool")
      .update({ author_user_id: null, author_hash: null }).eq("author_user_id", user.id);
    if (error) return json({ ok: false, error: "CONTENT_ANONYMIZATION_FAILED" }, 500);
  } else {
    const { error } = await admin.from("question_pool")
      .update({ active: false }).eq("author_user_id", user.id);
    if (error) return json({ ok: false, error: "CONTENT_WITHDRAWAL_FAILED" }, 500);
  }

  if (profile?.username) {
    const username = String(profile.username);
    const [comments, foreignAccess] = await Promise.all([
      admin.from("comments").delete().eq("local_user_id", username),
      admin.from("foreign_access").delete().eq("local_user_id", username)
    ]);
    if (comments.error || foreignAccess.error) {
      return json({ ok: false, error: "LEGACY_ACCOUNT_DATA_DELETE_FAILED" }, 500);
    }
  }

  const { error: signOutError } = await admin.auth.admin.signOut(token, "global");
  if (signOutError) return json({ ok: false, error: "SESSION_REVOCATION_FAILED" }, 500);

  // The verified Auth identity is the single deletion authority. Every user-owned
  // table is FK-linked with ON DELETE CASCADE; Auth deletion cascades in one DB transaction.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ ok: false, error: "AUTH_DELETE_FAILED", detail: deleteError.message }, 500);

  return json({ ok: true, deleted: true, sessions_revoked: true, exam_content_anonymized: keepExamContent });
});
