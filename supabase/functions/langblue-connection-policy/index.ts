import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

function ip(req:Request){
  return req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";
}
async function inspect(req:Request){
  const address=ip(req);
  const endpoint=Deno.env.get("IP_INTELLIGENCE_URL")||"https://api.ipwho.org/ip";
  const key=Deno.env.get("IP_INTELLIGENCE_API_KEY")||"";
  const gatewayCountry=String(req.headers.get("cf-ipcountry")||"").toUpperCase();
  if(!address||!key)return {configured:false,country:gatewayCountry,vpn:false,proxy:false,tor:false,hosting:false};
  try{
    const u=new URL(endpoint.replace(/\/$/,"")+"/"+encodeURIComponent(address));
    u.searchParams.set("apiKey",key);
    u.searchParams.set("security","1");
    const r=await fetch(u,{headers:{accept:"application/json"}});
    if(!r.ok)throw new Error("ip intelligence "+r.status);
    const x=await r.json();
    const d=x?.data||x;
    const g=d?.geo_location||d?.geoLocation||{};
    const s=d?.security||{};
    return {
      configured:true,
      country:String(g.country_code||g.countryCode||gatewayCountry||"").toUpperCase(),
      vpn:s.is_vpn===true||s.isVpn===true||s.vpn===true,
      proxy:s.is_proxy===true||s.isProxy===true||s.proxy===true,
      tor:s.is_tor===true||s.isTor===true||s.tor===true,
      hosting:s.is_hosting===true||s.isHosting===true||s.hosting===true
    };
  }catch(e){
    console.error("IP intelligence failed",e);
    return {configured:false,country:gatewayCountry,vpn:false,proxy:false,tor:false,hosting:false};
  }
}
function message(username:string){
 return "Dear User\n\nYou did not follow the restrictions regarding your connection type to the platform, our team has decided to keep your account suspended until you log in with a local IP.\nTherefore, until this happens, unfortunately, you will be suspended.\nThe reason for this is so that we can provide the best services to Iranians inside and outside the country.\nPlease accept our apologies for such a message.\nFROM: Langblue Team\nTO: ("+username+")";
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const auth=req.headers.get("Authorization")||"";
 const token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token)return json({ok:false,error:"UNAUTHORIZED"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return json({ok:false,error:"SERVER_CONFIGURATION_ERROR"},500);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await admin.auth.getUser(token);
 if(userError||!user)return json({ok:false,error:"UNAUTHORIZED"},401);
 const {data:p,error:pError}=await admin.from("profiles").select("id,username,country,connection_policy_status,connection_grace_started_at,connection_grace_expires_at").eq("id",user.id).maybeSingle();
 if(pError||!p)return json({ok:false,error:"PROFILE_NOT_FOUND"},404);
 const connection=await inspect(req);
 if(connection.configured && connection.tor){
   await admin.from("profiles").update({connection_policy_status:"suspended",connection_suspended_at:new Date().toISOString(),connection_last_country:connection.country||null,connection_last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",user.id);
   return json({ok:false,status:"suspended",username:p.username,message:message(p.username),reason:"TOR_NOT_ALLOWED"},403);
 }
 if(String(p.country||"").toUpperCase()!=="IR"||!connection.configured){
   return json({ok:true,status:p.connection_policy_status||"normal",configured:connection.configured});
 }
 const anonymized=connection.vpn||connection.proxy||connection.tor||connection.hosting;
 const now=Date.now();
 if(!anonymized && connection.country === "IR"){
   await admin.from("profiles").update({connection_policy_status:"normal",connection_suspended_at:null,connection_last_country:connection.country||null,connection_last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",user.id);
   return json({ok:true,status:"normal",configured:true});
 }
 const expiry=p.connection_grace_expires_at?new Date(p.connection_grace_expires_at).getTime():0;
 if(expiry&&now>=expiry){
   await admin.from("profiles").update({connection_policy_status:"suspended",connection_suspended_at:new Date().toISOString(),connection_last_country:connection.country||null,connection_last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",user.id);
   return json({ok:false,status:"suspended",username:p.username,message:message(p.username)},403);
 }
 const grace=expiry||now+86400000;
 if(!expiry){
   await admin.from("profiles").update({connection_policy_status:"vpn_grace",connection_grace_started_at:new Date(now).toISOString(),connection_grace_expires_at:new Date(grace).toISOString(),connection_last_country:connection.country||null,connection_last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",user.id);
 }
 return json({ok:true,status:"vpn_grace",configured:true,grace_expires_at:new Date(grace).toISOString(),hours_remaining:Math.max(0,Math.ceil((grace-now)/3600000))});
});