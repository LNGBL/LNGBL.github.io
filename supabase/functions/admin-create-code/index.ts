import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
async function sha256(value:string){const data=new TextEncoder().encode(value);const hash=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}
function randomCode(){const bytes=crypto.getRandomValues(new Uint8Array(18));return "LB-"+Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response(JSON.stringify({ok:false,error:"METHOD_NOT_ALLOWED"}),{status:405,headers:{"Content-Type":"application/json"}});
 const secret=Deno.env.get("LANGBLUE_ADMIN_SECRET"); if(!secret||req.headers.get("x-langblue-admin-secret")!==secret)return new Response(JSON.stringify({ok:false,error:"ADMIN_REQUIRED"}),{status:403,headers:{"Content-Type":"application/json"}});
 const body=await req.json().catch(()=>({})); const planId=String(body.planId||""); const productIds=Array.from(new Set(Array.isArray(body.productIds)?body.productIds.map(String):[])); const maxUses=Math.max(1,Number(body.maxUses||1));
 if(!planId||!productIds.length)return new Response(JSON.stringify({ok:false,error:"PLAN_AND_PRODUCTS_REQUIRED"}),{status:400,headers:{"Content-Type":"application/json"}});
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); const code=randomCode(); const hash=await sha256(code);
 const {data,error}=await admin.from("activation_codes").insert({code_hash:hash,plan_id:planId,product_ids:productIds,max_uses:maxUses}).select("id,plan_id,product_ids,max_uses,created_at").single();
 if(error)return new Response(JSON.stringify({ok:false,error:"CODE_CREATE_FAILED"}),{status:500,headers:{"Content-Type":"application/json"}});
 return new Response(JSON.stringify({ok:true,code,record:data}),{headers:{"Content-Type":"application/json"}});
});
