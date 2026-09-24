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
async function signUpLocal(username,password){
  const sb=getClient();
  if(!sb)return {ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};
  const email=authEmail(username);
  const {data,error}=await sb.auth.signUp({email,password});
  if(error)return {ok:false,error:error.message||'BACKEND_SIGNUP_FAILED'};
  return {ok:true,session:data&&data.session||null,user:data&&data.user||null,confirmationRequired:!!(data&&data.user&&!data.session)};
}
async function signInLocal(username,password){
  const sb=getClient();
  if(!sb)return {ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};
  const email=authEmail(username);
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(!error){
    return {ok:true,session:data&&data.session||null,user:data&&data.user||null,created:false};
  }

  // Existing LangBlue local accounts predate Supabase Auth. On their first
  // backend login, create the matching internal Auth identity automatically.
  // The local password has already been verified by Auth.login().
  const message=String(error.message||'');
  if(/invalid login credentials/i.test(message)){
    const created=await sb.auth.signUp({email,password});
    if(!created.error){
      return {
        ok:true,
        session:created.data&&created.data.session||null,
        user:created.data&&created.data.user||null,
        created:true
      };
    }
  }

  return {ok:false,error:message||'BACKEND_LOGIN_FAILED'};
}
async function signOut(){const sb=getClient();if(!sb)return false;await sb.auth.signOut();return true}
async function getAuthSession(){const sb=getClient();if(!sb)return null;const {data}=await sb.auth.getSession();return data&&data.session||null}
function localUserId(){try{const s=JSON.parse(localStorage.getItem('lb:session')||'null');return s?.userId||null}catch{return null}}
async function getAccess(){const sb=getClient(),uid=localUserId();if(!sb||!uid)return null;const {data,error}=await sb.from('foreign_access').select('*').eq('local_user_id',uid).maybeSingle();if(error){console.warn('[LangBlue] Supabase access read failed:',error.message);return null}return data||null}
async function saveAccess(state){const sb=getClient(),uid=localUserId();if(!sb||!uid)return null;const row={local_user_id:uid,share_started:!!state.shareStarted,share_completed:!!state.shareDone,share_platform:state.platform||null,share_at:state.shareAt?new Date(state.shareAt).toISOString():null,comment_completed:!!state.commentDone,completed_at:state.completedAt?new Date(state.completedAt).toISOString():null,updated_at:new Date().toISOString()};const {data,error}=await sb.from('foreign_access').upsert(row,{onConflict:'local_user_id'}).select().single();if(error){console.warn('[LangBlue] Supabase access write failed:',error.message);return null}return data}
async function saveComment(comment){const sb=getClient(),uid=localUserId();if(!sb||!uid)return null;const {data,error}=await sb.from('comments').insert({local_user_id:uid,comment:String(comment).trim().slice(0,1000)}).select().single();if(error){console.warn('[LangBlue] Supabase comment write failed:',error.message);return null}return data}
return{available:()=>!!getClient(),getClient,publicKey,authEmail,signUpLocal,signInLocal,signOut,getAuthSession,localUserId,getAccess,saveAccess,saveComment}})();