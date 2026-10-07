import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://lngbl.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
async function sha(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function makeToken(){const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const body=await req.json().catch(()=>({})),action=String(body.action||"");
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(url,service,{auth:{persistSession:false}});
 if(action==="create_session"){
  if(req.headers.get("Origin")!==ORIGIN)return json({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!bearer)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const auth=createClient(url,anon,{auth:{persistSession:false}}),u=await auth.auth.getUser(bearer);
  if(u.error||!u.data.user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const raw=makeToken(),hash=await sha(raw);
  await admin.from("android_handoffs").delete().eq("user_id",u.data.user.id).lt("expires_at",new Date().toISOString());
  const ins=await admin.from("android_handoffs").insert({user_id:u.data.user.id,token_hash:hash});
  if(ins.error)return json({ok:false,error:"SESSION_CREATE_FAILED"},500);
  return json({ok:true,token:raw,expires_in_days:30});
 }
 const raw=String(body.token||"");if(raw.length!==64)return json({ok:false,error:"INVALID_TOKEN"},401);
 const hash=await sha(raw),h=await admin.from("android_handoffs").select("id,user_id,expires_at,revoked_at").eq("token_hash",hash).maybeSingle();
 if(h.error||!h.data||h.data.revoked_at||new Date(h.data.expires_at).getTime()<=Date.now())return json({ok:false,error:"SESSION_EXPIRED"},401);
 const uid=h.data.user_id;
 if(action==="bootstrap"){
  const [p,s,sub]=await Promise.all([
   admin.from("profiles").select("id,name,username,sex,country,country_name,language_level,english_level,german_level,arabic_level").eq("id",uid).maybeSingle(),
   admin.from("user_state").select("state").eq("user_id",uid).maybeSingle(),
   admin.from("subscriptions").select("id,plan_id,product_ids,status,starts_at,expires_at").eq("user_id",uid).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1)
  ]);
  if(p.error)return json({ok:false,error:"PROFILE_LOAD_FAILED"},500);
  return json({ok:true,profile:p.data||null,user_state:s.data?.state||{},subscription:sub.data?.[0]||null});
 }
 if(action==="save_state"){
  if(!body.state||typeof body.state!=="object")return json({ok:false,error:"INVALID_STATE"},400);
  const x=await admin.from("user_state").upsert({user_id:uid,state:body.state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  return x.error?json({ok:false,error:"STATE_SAVE_FAILED"},500):json({ok:true});
 }
 if(action==="event"){
  const name=String(body.event_name||"").trim(),product=String(body.product_id||"");
  if(name.length<2||name.length>80||!["grammar","vocabulary"].includes(product))return json({ok:false,error:"INVALID_EVENT"},400);
  const x=await admin.from("behavior_events").insert({event_id:crypto.randomUUID(),user_id:uid,event_name:name,product_id:product,language:"english",context_id:"android-native",event_payload:body.event_payload&&typeof body.event_payload==="object"?body.event_payload:{},occurred_at:new Date().toISOString(),schema_version:1,source:"android"});
  return x.error?json({ok:false,error:"EVENT_SAVE_FAILED"},500):json({ok:true});
 }
 if(action==="revoke"){
  const x=await admin.from("android_handoffs").update({revoked_at:new Date().toISOString()}).eq("id",h.data.id);
  return x.error?json({ok:false,error:"REVOKE_FAILED"},500):json({ok:true});
 }
 return json({ok:false,error:"UNKNOWN_ACTION"},400);
});
