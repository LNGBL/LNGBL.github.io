/* LangBlue backend bridge. No secret keys are stored here. */
(function(window){'use strict';
 const CONFIG=Object.assign({enabled:true,supabaseUrl:'https://ocxeyponzzcvlrvwndji.supabase.co'},window.LangBlueBackendConfig||{});
 window.LangBlueBackendConfig=CONFIG;
 async function invoke(name,body){
 const {data:{session}}=await sb.auth.getSession();

alert(session ? "SESSION_OK" : "NO_SESSION");

if(!session)return{ok:false,error:'AUTH_REQUIRED'};

alert("CALLING_FUNCTION");

const {data,error}=await sb.functions.invoke(name,{
  body,
  headers:{Authorization:'Bearer '+session.access_token}
});

alert(error ? "FUNCTION_ERROR: "+error.message : "FUNCTION_OK");

return error
 ? {ok:false,error:error.message||'BACKEND_REQUEST_FAILED'}
 : (data||{ok:false,error:'EMPTY_BACKEND_RESPONSE'});}
 async function activateCode(code,productIds){return invoke('activate-code',{code:String(code||'').trim(),productIds:Array.isArray(productIds)?productIds:[]});}
 window.LangBlueBackend={CONFIG,invoke,activateCode};
                  setTimeout(()=>alert(typeof window.LangBlueBackend),1000);
                  console.log("LangBlueBackend exporting", window.LangBlueBackend);
})(window);
