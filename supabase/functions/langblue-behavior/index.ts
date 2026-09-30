import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EVENTS = new Set([
  "page_view","product_opened","learning_started","learning_completed",
  "session_started","session_heartbeat","session_ended","return_visit",
  "content_seen","content_answered","content_repeated","content_skipped",
  "weakness_mode_opened","weakness_mode_completed",
  "assessment_started","assessment_completed",
  "subscription_viewed","subscription_selected","activation_completed"
]);
const MAX_PAYLOAD_BYTES = 4096;
const MAX_EVENTS_PER_MINUTE = 120;

function json(data: unknown, status=200){
  return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
}
function isUuid(value: unknown): value is string{
  return typeof value==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function safePayload(value: unknown): Record<string,unknown>{
  if(!value || typeof value!=="object" || Array.isArray(value)) return {};
  const text=JSON.stringify(value);
  if(new TextEncoder().encode(text).byteLength>MAX_PAYLOAD_BYTES) return {};
  return value as Record<string,unknown>;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);

  const url=Deno.env.get("SUPABASE_URL");
  const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if(!url || !serviceRoleKey) return json({ok:false,error:"SERVER_CONFIGURATION_ERROR"},500);

  const auth=req.headers.get("authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"").trim();
  if(!token) return json({ok:false,error:"AUTH_REQUIRED"},401);

  const authClient=createClient(url,anonKey||serviceRoleKey);
  const {data:userData,error:userError}=await authClient.auth.getUser(token);
  if(userError || !userData.user) return json({ok:false,error:"INVALID_SESSION"},401);

  let body:Record<string,unknown>;
  try{ body=await req.json(); }catch{ return json({ok:false,error:"INVALID_JSON"},400); }

  const eventId=isUuid(body.event_id)?body.event_id:null;
  const eventName=typeof body.event_name==="string"?body.event_name.trim():"";
  const productId=typeof body.product_id==="string"?body.product_id.trim().toLowerCase():null;
  const language=typeof body.language==="string"?body.language.trim().toLowerCase():null;
  const sessionId=isUuid(body.session_id)?body.session_id:null;
  const contextId=typeof body.context_id==="string"?body.context_id.trim().slice(0,160):null;
  const payload=safePayload(body.event_payload);
  const schemaVersion=Number.isInteger(body.schema_version)?Number(body.schema_version):1;

  if(!eventId || !ALLOWED_EVENTS.has(eventName)) return json({ok:false,error:"INVALID_EVENT"},400);
  if(productId && !/^[a-z0-9_-]{1,40}$/.test(productId)) return json({ok:false,error:"INVALID_PRODUCT"},400);
  if(language && !/^[a-z]{2,16}(?:-[a-z]{2,16})?$/.test(language)) return json({ok:false,error:"INVALID_LANGUAGE"},400);
  if(schemaVersion!==1) return json({ok:false,error:"UNSUPPORTED_SCHEMA_VERSION"},400);

  const nowMs=Date.now();
  const occurredRaw=typeof body.occurred_at==="string"?Date.parse(body.occurred_at):NaN;
  const occurredMs=Number.isFinite(occurredRaw)
    ? Math.max(nowMs-60*60*1000,Math.min(nowMs+5*60*1000,occurredRaw)) : nowMs;

  const admin=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const since=new Date(nowMs-60*1000).toISOString();
  const {count,error:rateError}=await admin.from("behavior_events")
    .select("event_id",{count:"exact",head:true})
    .eq("user_id",userData.user.id).gte("received_at",since);
  if(rateError) return json({ok:false,error:"RATE_CHECK_FAILED"},500);
  if((count||0)>=MAX_EVENTS_PER_MINUTE) return json({ok:false,error:"RATE_LIMITED"},429);

  const {error}=await admin.from("behavior_events").insert({
    event_id:eventId,user_id:userData.user.id,event_name:eventName,
    product_id:productId,language,session_id:sessionId,context_id:contextId,
    event_payload:payload,occurred_at:new Date(occurredMs).toISOString(),
    schema_version:schemaVersion,source:"web"
  });
  if(error){
    if(error.code==="23505") return json({ok:true,duplicate:true});
    return json({ok:false,error:"EVENT_WRITE_FAILED"},500);
  }
  return json({ok:true,event_id:eventId});
});