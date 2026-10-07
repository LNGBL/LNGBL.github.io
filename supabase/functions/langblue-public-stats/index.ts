import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://lngbl.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
function clientIp(req:Request){return req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";}
async function hashIp(address:string,secret:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret+":"+address));return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{...headers,"Access-Control-Max-Age":"86400"}});
 if(req.method!=="POST"||req.headers.get("Origin")!==ORIGIN)return json({ok:false,error:"REQUEST_NOT_ALLOWED"},403);
 const url=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!serviceRole)return json({ok:false,error:"CONFIG"},500);
 const db=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
 let body:{action?:string}={};try{body=await req.json();}catch{}
 const increment=String(body.action||"stats")==="view";
 const address=clientIp(req);
 const ipHash=increment&&address?await hashIp(address,serviceRole):null;
 const {data,error}=await db.rpc("get_public_landing_stats_internal",{p_increment:increment,p_ip_hash:ipHash});
 if(error||!data){console.error("public landing stats failed",error);return json({ok:false,error:"STATS_UNAVAILABLE"},500);}
 return json({ok:true,...data});
});