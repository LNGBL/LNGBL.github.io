/* LangBlue Central Account — one account for Landing, Grammar, Vocabulary, Deutsch and LangDesert. */
(function(window, document){
  'use strict';
  const RETURN_KEY='lb:return_after_account';
  function isLanding(){const p=location.pathname.replace(/\/+$/,'');return p===''||p==='/index.html';}
  function setCentralCookie(active){try{document.cookie=active?'lb_central_session=1; Max-Age=2592000; Path=/; SameSite=Lax; Secure':'lb_central_session=; Max-Age=0; Path=/; SameSite=Lax; Secure';}catch(e){}}
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  async function session(){try{const sb=window.LangBlueSupabase;if(sb&&typeof sb.getAuthSession==='function')return await sb.getAuthSession();}catch(e){}return null;}
  let activityTimer=null;
  let activityStopped=false;
  async function activityHeartbeat(){
    if(activityStopped||document.visibilityState==='hidden')return;
    try{
      const result=await window.LangBlueBackend.invoke('langblue-activity',{});
      if(result&&result.ok){
        window.dispatchEvent(new CustomEvent('lb:activity-updated',{detail:result}));
      }else if(result&&result.error==='ACCOUNT_NOT_REGISTERED'){
        activityStopped=true;
      }
    }catch(e){}
  }
  function startActivityHeartbeat(){
    if(activityTimer||!window.LangBlueBackend)return;
    activityStopped=false;
    activityHeartbeat();
    activityTimer=setInterval(activityHeartbeat,300000);
  }
  function returnPath(){
  const value=sessionStorage.getItem(RETURN_KEY)||'';
  sessionStorage.removeItem(RETURN_KEY);
  if(!value)return '';
  try{
    const u=new URL(value,location.origin);
    if(u.origin!==location.origin)return '';
    if(u.pathname==='/'&&u.searchParams.get('account')==='profile')return '';
    if(u.pathname==='/'&&u.searchParams.get('account')==='required')return '';
    return u.pathname+u.search+u.hash;
  }catch(e){return '';}
}
  async function hydrate(){if(window.LangBlueCore&&window.LangBlueCore.Auth&&typeof window.LangBlueCore.Auth.init==='function')await window.LangBlueCore.Auth.init();const s=await session();setCentralCookie(!!s);return s;}
  function injectLandingStyles(){
    if(document.getElementById('lb-central-account-style'))return;
    const style=document.createElement('style');style.id='lb-central-account-style';
    style.textContent='.lb-central-account-btn{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:750;cursor:pointer}.lb-central-account-btn:hover{background:rgba(255,255,255,.11)}#lbCentralModal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,10,18,.72);backdrop-filter:blur(12px)}#lbCentralModal.open{display:flex}.lb-central-card{width:min(520px,100%);max-height:min(760px,92vh);overflow:auto;background:#0b2235;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:24px;box-shadow:0 30px 100px rgba(0,0,0,.4)}.lb-central-card h2{margin:0 0 7px}.lb-central-muted{color:#a9c0c7;font-size:13px}.lb-central-tabs{display:flex;gap:8px;margin:18px 0 14px}.lb-central-tabs button{flex:1}.lb-central-field{display:grid;gap:6px;margin:10px 0}.lb-central-field label{font-size:13px;color:#cfe2e6}.lb-central-field input,.lb-central-field select{width:100%;padding:11px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.15);background:#071a29;color:#fff;font:inherit}.lb-central-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.lb-central-error{min-height:20px;color:#ffb3a8;font-size:12px;margin-top:8px}.lb-central-profile{display:grid;gap:10px;margin-top:18px}.lb-central-product-links{display:grid;gap:8px;margin-top:16px}.lb-central-product-links a{padding:11px 13px;border:1px solid rgba(255,255,255,.12);border-radius:12px;text-decoration:none;background:rgba(255,255,255,.04)}.lb-profile-setup{margin-top:18px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.035)}.lb-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lb-profile-grid select{width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#071a29;color:#fff;font:inherit}.lb-music-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lb-music-card{padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:13px}.lb-music-card.selected{border-color:#58c7e8;background:rgba(22,138,173,.12)}.lb-music-card img{width:100%;height:180px;object-fit:cover;margin-top:8px;border-radius:10px;display:block}.lb-music-credit{display:block;margin-top:5px;color:#8faeb7;font-size:10px}.lb-central-legacy-hidden{display:none!important}';
    document.head.appendChild(style);
  }
  function modal(){
    let root=document.getElementById('lbCentralModal');if(root)return root;
    root=document.createElement('div');root.id='lbCentralModal';
    root.innerHTML='<div class="lb-central-card" role="dialog" aria-modal="true" aria-labelledby="lbCentralTitle"><div id="lbCentralBody"></div></div>';
    document.body.appendChild(root);root.addEventListener('click',function(e){if(e.target===root)root.classList.remove('open');});return root;
  }
  async function loadProfilePreferences(body){const sb=window.LangBlueSupabase,client=sb&&sb.getClient?sb.getClient():null;if(!client)return null;const {data}=await client.from('profiles').select('english_level,german_level,peer_learning_consent,peer_learning_notifications,favorite_artists,trial_expires_at').maybeSingle();if(!data)return null;const set=(id,v)=>{const el=body.querySelector(id);if(el)el.value=v||''};set('#lbEnglishLevel',data.english_level);set('#lbGermanLevel',data.german_level);const pc=body.querySelector('#lbPeerConsent'),pn=body.querySelector('#lbPeerNotifications');if(pc)pc.checked=!!data.peer_learning_consent;if(pn)pn.checked=data.peer_learning_notifications!==false;const fav=Array.isArray(data.favorite_artists)?data.favorite_artists:[];body.querySelectorAll('.lb-music-card').forEach(card=>card.classList.toggle('selected',fav.includes(card.dataset.artist)));body.querySelectorAll('.lb-music-pick').forEach(cb=>cb.checked=fav.includes(cb.value));const trial=body.querySelector('#lbTrialStatus');if(trial&&data.trial_expires_at){const left=Math.max(0,new Date(data.trial_expires_at).getTime()-Date.now());trial.textContent=left>0?'آزمایشی رایگان: '+Math.ceil(left/3600000)+' ساعت باقی مانده':'دوره آزمایشی ۴۸ ساعته به پایان رسیده است'}return data;}
  async function saveProfilePreferences(body){const sb=window.LangBlueSupabase,client=sb&&sb.getClient?sb.getClient():null;if(!client)return {ok:false,error:'BACKEND_NOT_ENABLED'};const fav=[...body.querySelectorAll('.lb-music-pick:checked')].map(x=>x.value);if(!body.querySelector('#lbEnglishLevel').value||!body.querySelector('#lbGermanLevel').value)return {ok:false,error:'سطح انگلیسی و آلمانی را مشخص کن.'};if(fav.length<1||fav.length>2)return {ok:false,error:'حداقل یک و حداکثر دو خواننده انتخاب کن.'};const {data,error}=await client.rpc('save_profile_preferences',{p_english_level:body.querySelector('#lbEnglishLevel').value,p_german_level:body.querySelector('#lbGermanLevel').value,p_peer_consent:body.querySelector('#lbPeerConsent').checked,p_notifications:body.querySelector('#lbPeerNotifications').checked,p_favorite_artists:fav});if(error)return {ok:false,error:error.message};return {ok:true,data};}
  async function ensureProfileComplete(){try{const client=window.LangBlueSupabase&&window.LangBlueSupabase.getClient&&window.LangBlueSupabase.getClient();if(!client)return true;const {data}=await client.from('profiles').select('english_level,german_level,favorite_artists').maybeSingle();return !!(data&&data.english_level&&data.german_level&&Array.isArray(data.favorite_artists)&&data.favorite_artists.length>=1&&data.favorite_artists.length<=2);}catch(e){return true;}}
  function openAccount(){
    if(!isLanding())return location.href='/?account=required';
    injectLandingStyles();const root=modal();const body=root.querySelector('#lbCentralBody');
    if(!body){console.error('[LangBlue] account modal body missing');return;}
    const u=window.LangBlueCore&&window.LangBlueCore.Auth?window.LangBlueCore.Auth.current():null;
    if(u){
      body.innerHTML='<h2 id="lbCentralTitle">حساب مرکزی LangBlue</h2><div class="lb-central-muted">همین حساب برای Grammar، Vocabulary، Deutsch و LangDesert استفاده می‌شود.</div><div class="lb-central-profile"><div><strong>نام:</strong> '+escapeHtml(u.name||'—')+'</div><div><strong>نام کاربری:</strong> @'+escapeHtml(u.username||'—')+'</div><div><strong>شناسه:</strong> <code>'+escapeHtml(u.id||'—')+'</code></div></div><div class="lb-central-product-links"><a href="LangBlue-grammer.html">📐 ورود به Grammar</a><a href="vocab.html">📚 ورود به Vocabulary</a><a href="LangBlue-De.html">🇩🇪 ورود به Deutsch</a><a href="LangDesert.html">🏜️ ورود به LangDesert · Arabic</a><a href="exam.html">📝 سامانه آزمون سالانه</a></div><div class="lb-central-subscription" style="margin-top:18px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.04)"><strong>🔑 فعال‌سازی اشتراک مرکزی</strong><div class="lb-central-muted" style="margin-top:5px">کد دریافتی از ادمین را فقط اینجا وارد کن؛ فعال‌سازی برای محصولات موجود در همان کد انجام می‌شود.</div><div class="lb-central-field"><label>کد فعال‌سازی</label><input id="lbCentralActivationCode" autocomplete="off" placeholder="کد را وارد کن"></div><div class="lb-central-actions"><button class="btn btn-primary" id="lbCentralActivate">فعال‌سازی</button></div><div class="lb-central-error" id="lbCentralActivationError"></div></div><div class="lb-central-actions"><button class="btn btn-primary" id="lbCentralLogout">🚪 خروج از حساب</button><button class="btn btn-secondary" id="lbCentralClose">بستن</button></div><div style="margin-top:18px;padding:12px;border:1px solid rgba(255,120,100,.22);border-radius:14px"><strong style="color:#ffb3a8">حذف حساب و تمام داده‌ها</strong><div class="lb-central-muted" style="margin-top:5px">قبل از حذف، می‌توانی مشخص کنی که چند مورد از واژه‌ها و گرامرهای تو به‌صورت ناشناس برای بانک آزمون باقی بماند.</div><div class="lb-central-actions"><button class="btn btn-secondary" id="lbCentralDeleteAccount">حذف حساب</button></div></div>';            body.querySelector('#lbCentralActivate').onclick=async function(){const input=body.querySelector('#lbCentralActivationCode'),err=body.querySelector('#lbCentralActivationError');const code=(input.value||'').trim();if(!code){err.textContent='کد فعال‌سازی را وارد کن.';return;}const selected=['grammar','vocabulary','deutsch','arabic'];const result=await window.LangBlueCore.subscription.activateAsync(code,selected);if(!result||!result.ok){err.textContent=(result&&result.error)||'فعال‌سازی انجام نشد.';return;}err.style.color='#9be7b4';err.textContent='اشتراک با موفقیت فعال شد.';input.value='';};body.querySelector('#lbCentralLogout').onclick=async function(){await window.LangBlueCore.Auth.logout();setCentralCookie(false);root.classList.remove('open');renderLandingAccount();};
      body.querySelector('#lbCentralClose').onclick=()=>root.classList.remove('open');body.querySelector('#lbCentralDeleteAccount').onclick=async function(){const keep=confirm('آیا اجازه می‌دهی محتوای آموزشی منتخب تو، بدون نام و شناسه، برای بانک آزمون باقی بماند؟\\n\\nOK = اجازه\\nCancel = حذف کامل محتوای شخصی');const confirmDelete=confirm('حذف حساب برگشت‌پذیر نیست. همه اطلاعات حساب، اشتراک، وضعیت و گزارش‌های شخصی حذف می‌شوند. ادامه می‌دهی؟');if(!confirmDelete)return;const result=await window.LangBlueBackend.invoke('langblue-account-delete',{confirm:true,keep_exam_content:keep});if(!result||!result.ok){alert((result&&result.error)||'حذف حساب انجام نشد.');return;}try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&/langblue|lb[-_]/i.test(k))localStorage.removeItem(k);}for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k&&/langblue|lb[-_]/i.test(k))sessionStorage.removeItem(k);}}catch(e){}try{await window.LangBlueSupabase.getClient().auth.signOut({scope:'global'});}catch(e){}location.href='/?account=deleted';};
    }else{
      body.innerHTML=`<h2 id="lbCentralTitle">حساب مرکزی LangBlue</h2><div class="lb-central-muted">یک حساب بساز؛ بعد از آن در هیچ‌کدام از محصولات دوباره ثبت‌نام نمی‌کنی.</div><div class="lb-central-tabs"><button class="btn btn-primary" id="lbCentralRegisterTab">ساخت حساب</button><button class="btn btn-secondary" id="lbCentralLoginTab">ورود</button></div><form id="lbCentralForm">
<div class="lb-central-field" id="lbCentralNameWrap"><label>نام</label><input id="lbCentralName" autocomplete="name"></div>
<div class="lb-central-field"><label>نام کاربری</label><input id="lbCentralUsername" autocomplete="username" required minlength="3"></div>
<div class="lb-central-field"><label>رمز عبور</label><input id="lbCentralPassword" type="password" autocomplete="new-password" required minlength="6"></div>
<div class="lb-central-field" id="lbCentralConfirmWrap"><label>تکرار رمز عبور</label><input id="lbCentralConfirm" type="password" autocomplete="new-password"></div>
<div id="lbInitialLearningSetup" style="margin-top:14px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:15px;background:rgba(255,255,255,.035)">
<strong>اطلاعات شروع یادگیری</strong>
<div class="lb-central-muted" style="margin-top:4px">این موارد فقط در زمان ساخت حساب ثبت می‌شوند و بعداً در صفحه حساب نمایش داده نمی‌شوند. حساب جدید ۴۸ ساعت دسترسی آزمایشی کامل دارد.</div>
<div class="lb-profile-grid" style="margin-top:10px">
<div><label for="lbTargetLanguage">زبان موردنظر</label><select id="lbTargetLanguage"><option value="">انتخاب</option><option value="english">English</option><option value="german">Deutsch</option><option value="arabic">العربية</option></select></div>
<div><label for="lbTargetLevel">سطح</label><select id="lbTargetLevel"><option value="">انتخاب سطح</option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option></select></div>
</div>
<div class="lb-central-field" style="margin-top:10px"><label for="lbAccountCountry">کشور محل استفاده</label><select id="lbAccountCountry"><option value="">انتخاب کشور</option><option value="IR">Iran</option><option value="AF">Afghanistan</option><option value="OTHER">Other</option></select></div>
<div class="lb-central-field" style="margin-top:10px"><label for="lbFavoriteArtist">خواننده مورد علاقه</label><select id="lbFavoriteArtist"><option value="">انتخاب خواننده</option><option value="taylor_swift">Taylor Swift</option><option value="billie_eilish">Billie Eilish</option><option value="john_lennon">John Lennon</option><option value="dua_lipa">Dua Lipa</option></select></div>
</div>
<div class="lb-central-error" id="lbCentralError"></div>
<div class="lb-central-actions"><button class="btn btn-primary" type="submit" id="lbCentralSubmit">ساخت حساب</button><button class="btn btn-secondary" type="button" id="lbCentralClose">انصراف</button></div>
</form>`;
      let register=true;const form=body.querySelector('#lbCentralForm'),nameWrap=body.querySelector('#lbCentralNameWrap'),confirmWrap=body.querySelector('#lbCentralConfirmWrap'),setup=body.querySelector('#lbInitialLearningSetup'),submit=body.querySelector('#lbCentralSubmit'),error=body.querySelector('#lbCentralError');
      const syncMode=()=>{nameWrap.style.display=register?'grid':'none';confirmWrap.style.display=register?'grid':'none';if(setup)setup.style.display=register?'block':'none';submit.textContent=register?'ساخت حساب':'ورود';body.querySelector('#lbCentralRegisterTab').className='btn '+(register?'btn-primary':'btn-secondary');body.querySelector('#lbCentralLoginTab').className='btn '+(!register?'btn-primary':'btn-secondary');body.querySelector('#lbCentralPassword').autocomplete=register?'new-password':'current-password';error.textContent='';};
      body.querySelector('#lbCentralRegisterTab').onclick=()=>{register=true;syncMode();};body.querySelector('#lbCentralLoginTab').onclick=()=>{register=false;syncMode();};body.querySelector('#lbCentralClose').onclick=()=>root.classList.remove('open');
      form.onsubmit=async function(e){
e.preventDefault();error.textContent='';
const username=body.querySelector('#lbCentralUsername').value.trim(),password=body.querySelector('#lbCentralPassword').value,name=body.querySelector('#lbCentralName').value.trim();
if(register&&password!==body.querySelector('#lbCentralConfirm').value){error.textContent='رمزهای عبور یکسان نیستند';return;}
let payload={name,username,password};
if(register){
  const language=body.querySelector('#lbTargetLanguage').value, level=body.querySelector('#lbTargetLevel').value, artist=body.querySelector('#lbFavoriteArtist').value, country=body.querySelector('#lbAccountCountry').value;
  if(!language||!level||!artist||!country){error.textContent='زبان، سطح، کشور و خواننده مورد علاقه را مشخص کن.';return;}
  payload=Object.assign(payload,{
    language_level:level,
    english_level:language==='english'?level:null,
    german_level:language==='german'?level:null,
    arabic_level:language==='arabic'?level:null,
    country,
    favorite_artists:[artist]
  });
}
const result=await window.LangBlueCore.Auth[register?'register':'login'](payload);
if(!result||!result.ok){error.textContent=(result&&result.connection_policy&&result.connection_policy.message)||(result&&result.error)||'عملیات حساب ناموفق بود';error.style.whiteSpace='pre-line';return;}
setCentralCookie(true);root.classList.remove('open');renderLandingAccount();const back=returnPath();
if(register){return;}
if(back)location.href=back;
};
      syncMode();
    }
    root.classList.add('open');
  }
  function renderLandingAccount(){
    if(!isLanding())return;injectLandingStyles();const nav=document.querySelector('header .nav');if(!nav)return;
    let btn=document.getElementById('lbCentralAccountButton');if(!btn){btn=document.createElement('button');btn.id='lbCentralAccountButton';btn.className='lb-central-account-btn';nav.appendChild(btn);btn.onclick=openAccount;}
    const u=window.LangBlueCore&&window.LangBlueCore.Auth?window.LangBlueCore.Auth.current():null;btn.textContent=u?'👤 حساب من':'👤 حساب مرکزی';
  }
  async function gateProduct(){
    if(isLanding())return;injectLandingStyles();const s=await hydrate();
    if(!s){try{sessionStorage.setItem(RETURN_KEY,location.pathname+location.search+location.hash);}catch(e){}location.replace('/?account=required');return;}
    document.documentElement.classList.add('lb-central-ready');
    ['btnAccount','btnSwitchAccount','vocabCreateAccountBtn','userModal','overlay-signup'].forEach(function(id){const el=document.getElementById(id);if(el)el.classList.add('lb-central-legacy-hidden');});
    document.querySelectorAll('[data-account-gate],[data-local-account]').forEach(function(el){el.classList.add('lb-central-legacy-hidden');});
    ['btnLogout','btn-logout'].forEach(function(id){const el=document.getElementById(id);if(!el||el.dataset.lbCentralBound)return;el.dataset.lbCentralBound='1';el.addEventListener('click',async function(e){e.preventDefault();e.stopImmediatePropagation();await window.LangBlueCore.Auth.logout();setCentralCookie(false);location.replace('/?account=required');},true);});
    window.dispatchEvent(new CustomEvent('lb:central-session-ready',{detail:{user:window.LangBlueCore.Auth.current()}}));
  }
  async function init(){
    if(isLanding()){const s=await hydrate();renderLandingAccount();if(s)startActivityHeartbeat();const params=new URLSearchParams(location.search);if(params.get('account')==='required')setTimeout(openAccount,80);}
    else {await gateProduct();if(window.LangBlueCore&&window.LangBlueCore.Auth&&window.LangBlueCore.Auth.current())startActivityHeartbeat();}
  }
  window.LangBlueCentralAccount={open:openAccount,refresh:renderLandingAccount,session,logout:async function(){if(window.LangBlueCore&&window.LangBlueCore.Auth)await window.LangBlueCore.Auth.logout();setCentralCookie(false);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
