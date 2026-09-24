/* LangBlue backend bridge. No secret keys are stored here. */
(function(window){'use strict';
 const CONFIG=Object.assign({enabled:false,supabaseUrl:'https://ocxeyponzzcvlrvwndji.supabase.co'},window.LangBlueBackendConfig||{});
 async function invoke(name,body){
  if(!CONFIG.enabled)return{ok:false,error:'BACKEND_NOT_ENABLED'};
  const sb=window.LangBlueSupabase&&window.LangBlueSupabase.getClient?window.LangBlueSupabase.getClient():null;
  if(!sb)return{ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};
  const {data:{session}}=await sb.auth.getSession(); if(!session)return{ok:false,error:'AUTH_REQUIRED'};
  const {data,error}=await sb.functions.invoke(name,{body,headers:{Authorization:'Bearer '+session.access_token}});
  return error?{ok:false,error:error.message||'BACKEND_REQUEST_FAILED'}:(data||{ok:false,error:'EMPTY_BACKEND_RESPONSE'});
 }
 async function activateCode(code,productIds){return invoke('activate-code',{code:String(code||'').trim(),productIds:Array.isArray(productIds)?productIds:[]});}
 window.LangBlueBackend={CONFIG,invoke,activateCode};
})(window);
