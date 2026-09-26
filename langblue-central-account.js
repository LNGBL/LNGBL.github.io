/* LangBlue Central Account — one account for Landing, Grammar, Vocabulary and Deutsch. */
(function(window, document){
  'use strict';
  const RETURN_KEY='lb:return_after_account';
  function isLanding(){const p=location.pathname.replace(/\/+$/,'');return p===''||p==='/index.html';}
  function setCentralCookie(active){try{document.cookie=active?'lb_central_session=1; Max-Age=2592000; Path=/; SameSite=Lax; Secure':'lb_central_session=; Max-Age=0; Path=/; SameSite=Lax; Secure';}catch(e){}}
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  async function session(){try{const sb=window.LangBlueSupabase;if(sb&&typeof sb.getAuthSession==='function')return await sb.getAuthSession();}catch(e){}return null;}
  function returnPath(){const value=sessionStorage.getItem(RETURN_KEY)||'';sessionStorage.removeItem(RETURN_KEY);return value;}
  async function hydrate(){if(window.LangBlueCore&&window.LangBlueCore.Auth&&typeof window.LangBlueCore.Auth.init==='function')await window.LangBlueCore.Auth.init();const s=await session();setCentralCookie(!!s);return s;}
  function injectLandingStyles(){
    if(document.getElementById('lb-central-account-style'))return;
    const style=document.createElement('style');style.id='lb-central-account-style';
    style.textContent='.lb-central-account-btn{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:750;cursor:pointer}.lb-central-account-btn:hover{background:rgba(255,255,255,.11)}#lbCentralModal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,10,18,.72);backdrop-filter:blur(12px)}#lbCentralModal.open{display:flex}.lb-central-card{width:min(520px,100%);max-height:min(760px,92vh);overflow:auto;background:#0b2235;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:24px;box-shadow:0 30px 100px rgba(0,0,0,.4)}.lb-central-card h2{margin:0 0 7px}.lb-central-muted{color:#a9c0c7;font-size:13px}.lb-central-tabs{display:flex;gap:8px;margin:18px 0 14px}.lb-central-tabs button{flex:1}.lb-central-field{display:grid;gap:6px;margin:10px 0}.lb-central-field label{font-size:13px;color:#cfe2e6}.lb-central-field input,.lb-central-field select{width:100%;padding:11px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.15);background:#071a29;color:#fff;font:inherit}.lb-central-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.lb-central-error{min-height:20px;color:#ffb3a8;font-size:12px;margin-top:8px}.lb-central-profile{display:grid;gap:10px;margin-top:18px}.lb-central-product-links{display:grid;gap:8px;margin-top:16px}.lb-central-product-links a{padding:11px 13px;border:1px solid rgba(255,255,255,.12);border-radius:12px;text-decoration:none;background:rgba(255,255,255,.04)}.lb-central-legacy-hidden{display:none!important}';
    document.head.appendChild(style);
  }
  function modal(){
    let root=document.getElementById('lbCentralModal');if(root)return root;
    root=document.createElement('div');root.id='lbCentralModal';
    root.innerHTML='<div class="lb-central-card" role="dialog" aria-modal="true" aria-labelledby="lbCentralTitle"><div id="lbCentralBody"></div></div>';
    document.body.appendChild(root);root.addEventListener('click',function(e){if(e.target===root)root.classList.remove('open');});return root;
  }
  function openAccount(){
    if(!isLanding())return location.href='/?account=required';
    injectLandingStyles();const root=modal();const body=root.querySelector('#lbCentralBody');
    const u=window.LangBlueCore&&window.LangBlueCore.Auth?window.LangBlueCore.Auth.current():null;
    if(u){
      body.innerHTML='<h2 id="lbCentralTitle">حساب مرکزی LangBlue</h2><div class="lb-central-muted">همین حساب برای Grammar، Vocabulary و Deutsch استفاده می‌شود.</div><div class="lb-central-profile"><div><strong>نام:</strong> '+escapeHtml(u.name||'—')+'</div><div><strong>نام کاربری:</strong> @'+escapeHtml(u.username||'—')+'</div><div><strong>شناسه:</strong> <code>'+escapeHtml(u.id||'—')+'</code></div></div><div class="lb-central-product-links"><a href="LangBlue-grammer.html">📐 ورود به Grammar</a><a href="vocab.html">📚 ورود به Vocabulary</a><a href="LangBlue-De.html">🇩🇪 ورود به Deutsch</a></div><div class="lb-central-actions"><button class="btn btn-primary" id="lbCentralLogout">🚪 خروج از حساب</button><button class="btn btn-secondary" id="lbCentralClose">بستن</button></div>';
      body.querySelector('#lbCentralLogout').onclick=async function(){await window.LangBlueCore.Auth.logout();setCentralCookie(false);root.classList.remove('open');renderLandingAccount();};
      body.querySelector('#lbCentralClose').onclick=()=>root.classList.remove('open');
    }else{
      body.innerHTML='<h2 id="lbCentralTitle">حساب مرکزی LangBlue</h2><div class="lb-central-muted">یک حساب بساز؛ بعد از آن در هیچ‌کدام از محصولات دوباره ثبت‌نام نمی‌کنی.</div><div class="lb-central-tabs"><button class="btn btn-primary" id="lbCentralRegisterTab">ساخت حساب</button><button class="btn btn-secondary" id="lbCentralLoginTab">ورود</button></div><form id="lbCentralForm"><div class="lb-central-field" id="lbCentralNameWrap"><label>نام</label><input id="lbCentralName" autocomplete="name"></div><div class="lb-central-field"><label>نام کاربری</label><input id="lbCentralUsername" autocomplete="username" required minlength="3"></div><div class="lb-central-field"><label>رمز عبور</label><input id="lbCentralPassword" type="password" autocomplete="new-password" required minlength="6"></div><div class="lb-central-field" id="lbCentralConfirmWrap"><label>تکرار رمز عبور</label><input id="lbCentralConfirm" type="password" autocomplete="new-password"></div><div class="lb-central-error" id="lbCentralError"></div><div class="lb-central-actions"><button class="btn btn-primary" type="submit" id="lbCentralSubmit">ساخت حساب</button><button class="btn btn-secondary" type="button" id="lbCentralClose">انصراف</button></div></form>';
      let register=true;const form=body.querySelector('#lbCentralForm'),nameWrap=body.querySelector('#lbCentralNameWrap'),confirmWrap=body.querySelector('#lbCentralConfirmWrap'),submit=body.querySelector('#lbCentralSubmit'),error=body.querySelector('#lbCentralError');
      const syncMode=()=>{nameWrap.style.display=register?'grid':'none';confirmWrap.style.display=register?'grid':'none';submit.textContent=register?'ساخت حساب':'ورود';body.querySelector('#lbCentralRegisterTab').className='btn '+(register?'btn-primary':'btn-secondary');body.querySelector('#lbCentralLoginTab').className='btn '+(!register?'btn-primary':'btn-secondary');body.querySelector('#lbCentralPassword').autocomplete=register?'new-password':'current-password';error.textContent='';};
      body.querySelector('#lbCentralRegisterTab').onclick=()=>{register=true;syncMode();};body.querySelector('#lbCentralLoginTab').onclick=()=>{register=false;syncMode();};body.querySelector('#lbCentralClose').onclick=()=>root.classList.remove('open');
      form.onsubmit=async function(e){e.preventDefault();error.textContent='';const username=body.querySelector('#lbCentralUsername').value.trim(),password=body.querySelector('#lbCentralPassword').value,name=body.querySelector('#lbCentralName').value.trim();if(register&&password!==body.querySelector('#lbCentralConfirm').value){error.textContent='رمزهای عبور یکسان نیستند';return;}const result=await window.LangBlueCore.Auth[register?'register':'login'](register?{name,username,password}:{username,password});if(!result||!result.ok){error.textContent=(result&&result.error)||'عملیات حساب ناموفق بود';return;}setCentralCookie(true);root.classList.remove('open');renderLandingAccount();const back=returnPath();if(back)location.href=back;};
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
    if(isLanding()){await hydrate();renderLandingAccount();const params=new URLSearchParams(location.search);if(params.get('account')==='required')setTimeout(openAccount,80);}
    else await gateProduct();
  }
  window.LangBlueCentralAccount={open:openAccount,refresh:renderLandingAccount,session,logout:async function(){if(window.LangBlueCore&&window.LangBlueCore.Auth)await window.LangBlueCore.Auth.logout();setCentralCookie(false);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
