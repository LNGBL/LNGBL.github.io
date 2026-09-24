import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
async function sha256(value:string){const data=new TextEncoder().encode(value.trim());const hash=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({ok:false,error:"METHOD_NOT_ALLOWED"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
 const authHeader=req.headers.get("Authorization"); if(!authHeader?.startsWith("Bearer "))return new Response(JSON.stringify({ok:false,error:"AUTH_REQUIRED"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
 const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}}); const admin=createClient(url,service);
 const {data:{user}}=await userClient.auth.getUser(); if(!user)return new Response(JSON.stringify({ok:false,error:"AUTH_REQUIRED"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
 const body=await req.json().catch(()=>({})); const code=String(body.code||"").trim(); const requested=Array.isArray(body.productIds)?body.productIds.map(String):[];
 if(!code)return new Response(JSON.stringify({ok:false,error:"CODE_REQUIRED"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
 const hash=await sha256(code); const {data:row}=await admin.from("activation_codes").select("id,plan_id,product_ids,max_uses,uses,active,expires_at").eq("code_hash",hash).maybeSingle();
 if(!row||!row.active||row.uses>=row.max_uses||(row.expires_at&&new Date(row.expires_at)<=new Date()))return new Response(JSON.stringify({ok:false,error:"INVALID_OR_USED_CODE"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
 const products=Array.from(new Set((row.product_ids||[]).map(String))); const selected=requested.length?requested.filter((p:string)=>products.includes(p)):products;
 if(!selected.length)return new Response(JSON.stringify({ok:false,error:"PRODUCT_NOT_INCLUDED"}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
 const {data:plan}=await admin.from("plans").select("id,label,days,months,price_irt").eq("id",row.plan_id).eq("active",true).single();
 if(!plan)return new Response(JSON.stringify({ok:false,error:"PLAN_NOT_FOUND"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 const now=new Date(), expires=new Date(now.getTime()+Number(plan.days)*86400000);
 const {error:updateError}=await admin.from("activation_codes").update({uses:row.uses+1,used_at:now.toISOString(),active:row.uses+1<row.max_uses}).eq("id",row.id).eq("uses",row.uses);
 if(updateError)return new Response(JSON.stringify({ok:false,error:"ACTIVATION_CONFLICT"}),{status:409,headers:{...cors,"Content-Type":"application/json"}});
 const {data:sub,error:subError}=await admin.from("subscriptions").insert({user_id:user.id,plan_id:plan.id,product_ids:selected,activation_code_id:row.id,status:"active",starts_at:now.toISOString(),expires_at:expires.toISOString()}).select("id,plan_id,product_ids,status,starts_at,expires_at").single();
 if(subError)return new Response(JSON.stringify({ok:false,error:"SUBSCRIPTION_WRITE_FAILED"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 return new Response(JSON.stringify({ok:true,subscription:sub,plan:{id:plan.id,label:plan.label,days:plan.days,months:plan.months}}),{headers:{...cors,"Content-Type":"application/json"}});
});
