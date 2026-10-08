import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN="https://lngbl.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
async function sha(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function makeToken(){const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("")}
function ip(req:Request){return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||req.headers.get("cf-connecting-ip")||""}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const body=await req.json().catch(()=>({})),action=String(body.action||"");
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const authUser=async()=>{const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!bearer)return null;const c=createClient(url,anon,{auth:{persistSession:false}});const r=await c.auth.getUser(bearer);return r.error||!r.data.user?null:r.data.user};

 if(action==="app_status"){
  const tz=String(body.timezone||"Asia/Tehran"); const localDate=new Intl.DateTimeFormat("en-CA",{timeZone:tz}).format(new Date()); const today=new Date();
  const [release,maintenance]=await Promise.all([
   admin.from("android_app_releases").select("version_code,version_name,min_version_code,apk_path,apk_sha256,release_notes,force_update,published_at").order("version_code",{ascending:false}).limit(1).maybeSingle(),
   admin.from("android_maintenance_windows").select("maintenance_date,start_time,end_time,message,enabled,timezone").eq("maintenance_date",localDate).eq("enabled",true).maybeSingle()
  ]);
  let signed_url=null;
  if(release.data?.apk_path){
   const s=await admin.storage.from("android-releases").createSignedUrl(release.data.apk_path,300,{download:true});
   if(!s.error)signed_url=s.data?.signedUrl||null;
  }
  const v=Number(body.version_code||0);
  return json({ok:true,maintenance:maintenance.data||null,release:release.data?{...release.data,download_url:signed_url}:null,update_available:!!release.data&&Number(release.data.version_code)>v});
 }

 if(action==="create_session"){
  if(req.headers.get("Origin")!==ORIGIN)return json({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  const user=await authUser();if(!user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const raw=makeToken(),hash=await sha(raw);
  await admin.from("android_handoffs").delete().eq("user_id",user.id).lt("expires_at",new Date().toISOString());
  const ins=await admin.from("android_handoffs").insert({user_id:user.id,token_hash:hash});
  if(ins.error)return json({ok:false,error:"SESSION_CREATE_FAILED"},500);
  return json({ok:true,token:raw,expires_in_days:30});
 }

 if(action==="create_pairing"){
  if(req.headers.get("Origin")!==ORIGIN)return json({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  const user=await authUser();if(!user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const pair=String(body.pair_code||"");const dk=String(body.device_key||"");
  if(pair.length<32||dk.length<32)return json({ok:false,error:"PAIRING_INPUT_INVALID"},400);
  const ins=await admin.from("android_pairings").insert({
   user_id:user.id,device_key_hash:await sha(dk),browser_ip_hash:await sha(ip(req)),
   browser_user_agent:(req.headers.get("user-agent")||"").slice(0,500),
   device_label:String(body.device_label||"Android device").slice(0,120),
   app_version:String(body.app_version||"").slice(0,30)
  }).select("id,status,expires_at").single();
  return ins.error?json({ok:false,error:"PAIRING_CREATE_FAILED"},500):json({ok:true,pairing_id:ins.data.id,status:ins.data.status,expires_at:ins.data.expires_at});
 }

 if(action==="decide_pairing"){
  if(req.headers.get("Origin")!==ORIGIN)return json({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  const user=await authUser();if(!user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const id=String(body.pairing_id||"");const decision=String(body.decision||"");
  if(!["approve","reject"].includes(decision))return json({ok:false,error:"INVALID_DECISION"},400);
  const row=await admin.from("android_pairings").select("id,status,expires_at").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(row.error||!row.data||row.data.status!=="pending"||new Date(row.data.expires_at).getTime()<=Date.now())return json({ok:false,error:"PAIRING_EXPIRED"},409);
  const x=await admin.from("android_pairings").update({status:decision==="approve"?"approved":"rejected",decided_at:new Date().toISOString()}).eq("id",id).eq("status","pending");
  return x.error?json({ok:false,error:"PAIRING_DECISION_FAILED"},500):json({ok:true,status:decision==="approve"?"approved":"rejected"});
 }

 if(action==="poll_pairing"){
  const id=String(body.pairing_id||""),pair=String(body.pair_code||""),dk=String(body.device_key||"");
  const row=await admin.from("android_pairings").select("*").eq("id",id).eq("device_key_hash",await sha(dk)).maybeSingle();
  if(row.error||!row.data)return json({ok:false,error:"PAIRING_NOT_FOUND"},404);
  if(row.data.consumed_at)return json({ok:false,error:"PAIRING_CONSUMED"},409);
  if(new Date(row.data.expires_at).getTime()<=Date.now())return json({ok:false,error:"PAIRING_EXPIRED"},409);
  if(row.data.status!=="approved")return json({ok:true,status:row.data.status});
  const deviceIp=await sha(ip(req));const match=!!row.data.browser_ip_hash&&deviceIp===row.data.browser_ip_hash;
  const sub=await admin.from("subscriptions").select("expires_at").eq("user_id",row.data.user_id).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1);
  const expires=sub.data?.[0]?.expires_at||null;
  const raw=makeToken(),hash=await sha(raw);
  const ins=await admin.from("android_handoffs").insert({user_id:row.data.user_id,token_hash:hash});
  if(ins.error)return json({ok:false,error:"SESSION_CREATE_FAILED"},500);
  await admin.from("android_pairings").update({consumed_at:new Date().toISOString(),app_ip_match:match}).eq("id",id).eq("consumed_at",null);
  await admin.from("android_devices").upsert({user_id:row.data.user_id,device_key_hash:await sha(dk),device_label:row.data.device_label,platform:"android",app_version:row.data.app_version,last_ip_hash:deviceIp,last_seen_at:new Date().toISOString(),approved_at:new Date().toISOString(),offline_until:new Date(Date.now()+30*86400000).toISOString(),subscription_expires_at:expires,revoked_at:null},{onConflict:"device_key_hash"});
  return json({ok:true,status:"approved",token:raw,expires_in_days:30,ip_match:match,subscription_expires_at:expires});
 }

 const raw=String(body.token||"");
 let uid:string|null=null;let handoffId:string|null=null;
 if(raw.length===64){
  const h=await admin.from("android_handoffs").select("id,user_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();
  if(h.error||!h.data||h.data.revoked_at||new Date(h.data.expires_at).getTime()<=Date.now())return json({ok:false,error:"SESSION_EXPIRED"},401);
  uid=h.data.user_id;handoffId=h.data.id;
 }else{
  const user=await authUser();
  if(!user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  uid=user.id;
 }

 if(action==="bootstrap"){
  const [p,s,sub,content,device]=await Promise.all([
   admin.from("profiles").select("id,name,username,sex,country,country_name,language_level,english_level,german_level,arabic_level").eq("id",uid).maybeSingle(),
   admin.from("user_state").select("state").eq("user_id",uid).maybeSingle(),
   admin.from("subscriptions").select("id,plan_id,product_ids,status,starts_at,expires_at").eq("user_id",uid).eq("status","active").gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1),
   admin.from("android_content_items").select("item_id,kind,language,content,deleted_at,updated_at").eq("user_id",uid).is("deleted_at",null).order("updated_at",{ascending:false}).limit(1000),
   raw.length===64?admin.from("android_devices").select("offline_until,subscription_expires_at,revoked_at").eq("user_id",uid).eq("device_key_hash",await sha(String(body.device_key||""))).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  if(p.error)return json({ok:false,error:"PROFILE_LOAD_FAILED"},500);
  return json({ok:true,profile:p.data||null,user_state:s.data?.state||{},subscription:sub.data?.[0]||null,content:content.data||[],device:device.data||null});
 }
 if(action==="save_state"){
  if(!body.state||typeof body.state!=="object")return json({ok:false,error:"INVALID_STATE"},400);
  const x=await admin.from("user_state").upsert({user_id:uid,state:body.state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  return x.error?json({ok:false,error:"STATE_SAVE_FAILED"},500):json({ok:true});
 }
 if(action==="content_upsert"){
  if(!["grammar","vocabulary"].includes(String(body.kind))||!body.content||typeof body.content!=="object")return json({ok:false,error:"INVALID_CONTENT"},400);
  const x=await admin.from("android_content_items").upsert({user_id:uid,item_id:String(body.item_id).slice(0,180),kind:String(body.kind),language:String(body.language||"english").slice(0,40),content:body.content,deleted_at:null,updated_at:new Date().toISOString()},{onConflict:"user_id,kind,item_id"});
  return x.error?json({ok:false,error:"CONTENT_SAVE_FAILED"},500):json({ok:true});
 }
 if(action==="content_delete"){
  const x=await admin.from("android_content_items").update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("user_id",uid).eq("kind",String(body.kind)).eq("item_id",String(body.item_id));
  return x.error?json({ok:false,error:"CONTENT_DELETE_FAILED"},500):json({ok:true});
 }
 if(action==="event"){
  const name=String(body.event_name||"").trim(),product=String(body.product_id||"");
  if(name.length<2||name.length>80||!["grammar","vocabulary"].includes(product))return json({ok:false,error:"INVALID_EVENT"},400);
  const x=await admin.from("behavior_events").insert({event_id:crypto.randomUUID(),user_id:uid,event_name:name,product_id:product,language:"english",context_id:"android-native",event_payload:body.event_payload&&typeof body.event_payload==="object"?body.event_payload:{},occurred_at:new Date().toISOString(),schema_version:1,source:"android"});
  return x.error?json({ok:false,error:"EVENT_SAVE_FAILED"},500):json({ok:true});
 }
 if(action==="revoke"){
  if(!handoffId)return json({ok:false,error:"INVALID_TOKEN"},401);
  const x=await admin.from("android_handoffs").update({revoked_at:new Date().toISOString()}).eq("id",handoffId);
  return x.error?json({ok:false,error:"REVOKE_FAILED"},500):json({ok:true});
 }
 return json({ok:false,error:"UNKNOWN_ACTION"},400);
});