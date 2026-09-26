/* LangBlue Supabase client — publishable key only. */
window.LangBlueSupabase=(()=>{const URL='https://ocxeyponzzcvlrvwndji.supabase.co';const KEY='sb_publishable_Ciwi3i81I-1_h-rtFF5Djw_ZPthKnRg';let client=null;
const publicKey=KEY;
 function getClient(){if(!window.supabase||typeof window.supabase.createClient!=='function')return null;if(!client)client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});return client}
function authEmail(username){
  const value=String(username||'').trim().toLowerCase();
  const bytes=new TextEncoder().encode(value);
  let binary='';
  for(let i=0;i<bytes.length;i++) binary+=String.fromCharCode(bytes[i]);
  const token=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return 'u-'+token+'@accounts.langblue.local';
}
async function invokeAuth(action, username, password, profile){
  const sb=getClient();
  if(!sb)return {ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};
  const url=URL + '/functions/v1/langblue-auth';
  try{
    const response=await fetch(url,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':KEY
      },
      body:JSON.stringify({
        action,
        username,
        password,
        profile:profile || {}
      })
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok || !data || !data.ok){
      return {ok:false,error:data&&data.error || 'BACKEND_AUTH_FAILED'};
    }
    if(data.session && data.session.access_token && data.session.refresh_token){
      const {error}=await sb.auth.setSession({
        access_token:data.session.access_token,
        refresh_token:data.session.refresh_token
      });
      if(error)return {ok:false,error:error.message||'SESSION_SETUP_FAILED'};
    }
    return data;
  }catch(error){
    return {ok:false,error:error.message||'BACKEND_AUTH_FAILED'};
  }
}
async function signUpLocal(username,password,profile){
  return invokeAuth('signup',username,password,profile);
}
async function signInLocal(username,password,profile){
  return invokeAuth('login',username,password,profile);
}
async function signOut(){const sb=getClient();if(!sb)return false;await sb.auth.signOut();return true}
async function getAuthSession(){const sb=getClient();if(!sb)return null;const {data}=await sb.auth.getSession();return data&&data.session||null}
function localUserId(){try{const s=JSON.parse(localStorage.getItem('lb:session')||'null');return s?.userId||null}catch{return null}}
async function getAccess(){const sb=getClient(),uid=localUserId();if(!sb||!uid)return null;const {data,error}=await sb.from('foreign_access').select('*').eq('local_user_id',uid).maybeSingle();if(error){console.warn('[LangBlue] Supabase access read failed:',error.message);return null}return data||null}
async function saveAccess(state){const sb=getClient(),uid=localUserId();if(!sb||!uid)return null;const row={local_user_id:uid,share_started:!!state.shareStarted,share_completed:!!state.shareDone,share_platform:state.platform||null,share_at:state.shareAt?new Date(state.shareAt).toISOString():null,comment_completed:!!state.commentDone,completed_at:state.completedAt?new Date(state.completedAt).toISOString():null,updated_at:new Date().toISOString()};const {data,error}=await sb.from('foreign_access').upsert(row,{onConflict:'local_user_id'}).select().single();if(error){console.warn('[LangBlue] Supabase access write failed:',error.message);return null}return data}
async function saveComment(comment){const sb=getClient(),uid=localUserId();if(!sb||!uid)return null;const {data,error}=await sb.from('comments').insert({local_user_id:uid,comment:String(comment).trim().slice(0,1000)}).select().single();if(error){console.warn('[LangBlue] Supabase comment write failed:',error.message);return null}return data}
return{available:()=>!!getClient(),getClient,publicKey,authEmail,signUpLocal,signInLocal,signOut,getAuthSession,localUserId,getAccess,saveAccess,saveComment}})();