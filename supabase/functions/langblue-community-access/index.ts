import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://lngbl.github.io";
const C={ "Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-langblue-admin-secret","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store" };
const out=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...C,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:C});
 if(req.method!=="POST"||req.headers.get("Origin")!==ORIGIN)return out({ok:false,error:"REQUEST_NOT_ALLOWED"},403);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return out({ok:false,error:"SERVER_CONFIGURATION_ERROR"},500);
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return out({ok:false,error:"AUTH_REQUIRED"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),u=await auth.auth.getUser(token);
 if(u.error||!u.data.user)return out({ok:false,error:"AUTH_REQUIRED"},401);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const secret=Deno.env.get("LANGBLUE_ADMIN_SECRET"),isAdmin=!!secret&&req.headers.get("x-langblue-admin-secret")===secret;
 let b:any;try{b=await req.json()}catch{return out({ok:false,error:"INVALID_JSON"},400)}
 const a=String(b.action||""),uid=u.data.user.id;
 if(a==="submit"){
  if(String(b.website||"").trim())return out({ok:false,error:"BOT_CHECK_FAILED"},400);
  const note=String(b.note||"").trim();if(note.length>500)return out({ok:false,error:"NOTE_TOO_LONG"},400);
  const age=Number(b.age);if(!Number.isInteger(age)||age<10||age>69)return out({ok:false,error:"AGE_NOT_ELIGIBLE"},400);\n  const old=await db.from("community_discount_requests").select("id,status,discount_expires_at").eq("user_id",uid).maybeSingle();
  if(old.error)return out({ok:false,error:"DATABASE_ERROR"},500);
  if(old.data?.status==="pending"||(old.data?.status==="approved"&&old.data.discount_expires_at&&new Date(old.data.discount_expires_at).getTime()>Date.now()))return out({ok:true,status:old.data.status,discount_expires_at:old.data.discount_expires_at});
  const q=old.data?await db.from("community_discount_requests").update({status:"pending",self_declared:true,declared_age:age,user_note:note,admin_note:"",created_at:new Date().toISOString(),updated_at:new Date().toISOString(),reviewed_at:null,welcome_seen_at:null,discount_expires_at:null}).eq("id",old.data.id).select("id,status").single():await db.from("community_discount_requests").insert({user_id:uid,self_declared:true,declared_age:age,user_note:note}).select("id,status").single();
  return q.error?out({ok:false,error:"REQUEST_SAVE_FAILED"},500):out({ok:true,request:q.data});
 }
 if(a==="status"||a==="welcome"){
  const q=await db.from("community_discount_requests").select("status,declared_age,discount_expires_at,created_at,reviewed_at,admin_note,welcome_seen_at").eq("user_id",uid).maybeSingle();
  if(q.error)return out({ok:false,error:"DATABASE_ERROR"},500);
  const active=!!(q.data?.status==="approved"&&q.data.discount_expires_at&&new Date(q.data.discount_expires_at).getTime()>Date.now());\n  return out(a==="welcome"?{ok:true,showRoses:active&&!q.data.welcome_seen_at}:{ok:true,request:q.data?{...q.data,discount_active:active}:null});
 }
 if(a==="welcome_seen"){
  const q=await db.from("community_discount_requests").update({welcome_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("user_id",uid).eq("status","approved").is("welcome_seen_at",null);
  return q.error?out({ok:false,error:"WELCOME_SAVE_FAILED"},500):out({ok:true});
 }
 if(a==="admin_list"){
  if(!isAdmin)return out({ok:false,error:"ADMIN_UNAUTHORIZED"},401);
  const q=await db.from("community_discount_requests").select("id,user_id,status,declared_age,discount_expires_at,user_note,admin_note,created_at,reviewed_at").order("created_at",{ascending:false}).limit(100);
  if(q.error)return out({ok:false,error:"DATABASE_ERROR"},500);
  const ids=[...new Set((q.data||[]).map((x:any)=>x.user_id))];
  const ps=ids.length?await db.from("profiles").select("id,username,name").in("id",ids):{data:[]};
  const map=new Map((ps.data||[]).map((p:any)=>[p.id,p]));
  return out({ok:true,requests:(q.data||[]).map((x:any)=>({...x,profile:map.get(x.user_id)||null}))});
 }
 if(a==="admin_decide"){
  if(!isAdmin)return out({ok:false,error:"ADMIN_UNAUTHORIZED"},401);
  const id=String(b.requestId||""),decision=String(b.decision||""),note=String(b.adminNote||"").trim();
  if(!id||!["approved","rejected"].includes(decision)||note.length>1000)return out({ok:false,error:"INVALID_DECISION"},400);
  const q=await db.from("community_discount_requests").update({status:decision,admin_note:note,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString(),welcome_seen_at:null,discount_expires_at:decision==="approved"?(()=>{const d=new Date();d.setUTCMonth(d.getUTCMonth()+6);return d.toISOString()})():null}).eq("id",id).eq("status","pending").select("id").maybeSingle();
  if(q.error)return out({ok:false,error:"DECISION_SAVE_FAILED"},500);
  if(!q.data)return out({ok:false,error:"REQUEST_NOT_FOUND_OR_REVIEWED"},409);
  return out({ok:true,status:decision});
 }
 return out({ok:false,error:"UNKNOWN_ACTION"},400);
});