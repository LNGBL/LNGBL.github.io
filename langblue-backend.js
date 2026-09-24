async function invoke(name,body){
  if(!CONFIG.enabled)return{ok:false,error:'BACKEND_NOT_ENABLED'};

  const sb=window.LangBlueSupabase&&window.LangBlueSupabase.getClient
    ? window.LangBlueSupabase.getClient()
    : null;

  if(!sb)return{ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};

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
    : (data||{ok:false,error:'EMPTY_BACKEND_RESPONSE'});
}
