(function(window,document){
'use strict';
async function refreshSubscription(){
  try{
    if(window.LangBlueCore&&window.LangBlueCore.subscription&&window.LangBlueCore.subscription.refresh){
      return await window.LangBlueCore.subscription.refresh();
    }
  }catch(e){console.warn('[LangBlue] central subscription refresh failed',e)}
  return null;
}
function ensureGateStyles(){
  if(document.getElementById('lb-subscription-gate-style'))return;
  const style=document.createElement('style');style.id='lb-subscription-gate-style';
  style.textContent='.lb-subscription-gate{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(3,12,20,.82);backdrop-filter:blur(14px)}.lb-subscription-gate-card{width:min(560px,100%);padding:28px;border:1px solid rgba(91,192,255,.28);border-radius:22px;background:#0b2235;color:#fff;box-shadow:0 30px 100px rgba(0,0,0,.45);text-align:center}.lb-subscription-gate-card h2{margin:0 0 8px}.lb-subscription-gate-card p{color:#b8cdd3;line-height:1.9;margin:0 0 18px}';
  document.head.appendChild(style);
}
function centralUrl(){return '/?account=required';}
function hidePricing(){
  ['pricingGrid','pricing-grid','paidPlanGrid','vocabGatePlans'].forEach(id=>{const e=document.getElementById(id);if(e){e.innerHTML='';e.style.display='none';}});
  document.querySelectorAll('.pricing-grid,.paid-plan-grid,.vocab-plan-grid,.price-card,.vocab-plan-card,.pricing-note,.paid-howto,.vocab-telegram-box,.vocab-verify-box,.invoice-overlay,#code-form').forEach(e=>e.style.display='none');
}
function centralNotice(host){
  if(!host||host.dataset.lbCentralNotice)return;
  host.dataset.lbCentralNotice='1';
  host.innerHTML='<div style="padding:16px;border:1px solid rgba(22,138,173,.28);border-radius:14px;background:rgba(22,138,173,.06);line-height:1.9"><strong>🔐 مرجع واحد برای اشتراک LangBlue</strong><div style="margin-top:6px;color:var(--muted,#68757a)">قیمت‌گذاری و فعال‌سازی داخل Grammar، Vocabulary و Deutsch حذف شده است. وضعیت اشتراک فقط از حساب مرکزی بررسی می‌شود.</div><a href="'+centralUrl()+'" style="display:inline-flex;margin-top:12px;padding:9px 14px;border-radius:10px;background:#168AAD;color:#fff;text-decoration:none;font-weight:800">ورود به حساب مرکزی و فعال‌سازی</a></div>';
}
function patchGrammar(){
  hidePricing();
  const g=document.getElementById('pricingIntro'); if(g)g.textContent='اشتراک و دسترسی فقط از حساب مرکزی LangBlue مدیریت می‌شود.';
  const h=document.getElementById('howToBox'); if(h)centralNotice(h);
  if(window.__requestPlanIRT)window.__requestPlanIRT=function(){location.href=centralUrl();};
}
function patchGerman(){
  hidePricing();
  if(window.License){
    const old=window.License.isPro;
    window.License.isPro=function(){return !!(window.LangBlueCore&&window.LangBlueCore.subscription&&window.LangBlueCore.subscription.current()&&!window.LangBlueCore.subscription.current().expired);};
    window.License._centralPreviousIsPro=old;
  }
  const grid=document.getElementById('pricing-grid'); if(grid)centralNotice(grid.parentElement||grid);
  window.__lbOpenPricing=function(){location.href=centralUrl();};
  window._openPricing=function(){location.href=centralUrl();};
}
function patchVocab(){
  hidePricing();
  if(window.PaidAccess){
    const pa=window.PaidAccess;
    pa.PLANS=[];
    pa.open=function(){const intro=document.getElementById('paidAccessIntro');if(intro)intro.innerHTML='برای دریافت یا تمدید اشتراک، فقط حساب مرکزی LangBlue را استفاده کن.';const grid=document.getElementById('paidPlanGrid');if(grid)centralNotice(grid);const m=document.getElementById('paidAccessModal');if(m){m.classList.add('active');m.setAttribute('aria-hidden','false');}};
    pa.request=function(){location.href=centralUrl();};
    pa.activate=function(){location.href=centralUrl();};
    pa.isActive=function(){const s=window.LangBlueCore&&window.LangBlueCore.subscription&&window.LangBlueCore.subscription.current();return !!(s&&!s.expired);};
  }
  const gatePlans=document.getElementById('vocabGatePlans');if(gatePlans)centralNotice(gatePlans);
}
function showConnectionSuspension(result){
  if(document.getElementById('lbConnectionSuspension'))return;
  const username=String(result&&result.username||window.LangBlueCore?.Auth?.current?.()?.username||'USER');
  const message=String(result&&result.message||'Dear User\\n\\nYou did not follow the restrictions regarding your connection type to the platform, our team has decided to keep your account suspended until you log in with a local IP.\\nTherefore, until this happens, unfortunately, you will be suspended.\\nThe reason for this is so that we can provide the best services to Iranians inside and outside the country.\\nPlease accept our apologies for such a message.\\nFROM: Langblue Team\\nTO: ('+username+')');
  const lines=message.split('\\n').map(function(x){return x?'<div style="margin:7px 0">'+x.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'</div>':'<div style="height:8px"></div>';}).join('');
  const root=document.createElement('div');root.id='lbConnectionSuspension';root.className='lb-subscription-gate';
  root.innerHTML='<div class="lb-subscription-gate-card" style="max-width:700px;text-align:left"><div style="font-size:38px;text-align:center">⛔</div><div style="font-family:Arial,sans-serif;line-height:1.65">'+lines+'</div><div style="text-align:center;margin-top:22px;color:#9fb4bd;font-size:12px">Access will be restored after a verified local IP is detected.</div></div>';
  document.body.appendChild(root);
}
async function enforceConnectionPolicy(){
  try{
    if(!window.LangBlueSupabase||typeof window.LangBlueSupabase.checkConnectionPolicy!=='function')return true;
    const result=await window.LangBlueSupabase.checkConnectionPolicy();
    if(result&&result.status==='suspended'){showConnectionSuspension(result);return false;}
    return true;
  }catch(e){return true;}
}

function productIdForPage(){
  const p=location.pathname.toLowerCase();
  if(p.indexOf('langblue-grammer')!==-1)return 'grammar';
  if(p.indexOf('vocab')!==-1)return 'vocabulary';
  if(p.indexOf('langblue-de')!==-1)return 'deutsch';
  if(p.indexOf('langdesert')!==-1)return 'arabic';
  if(p.indexOf('langjp')!==-1)return 'langjp';
  return null;
}
function hasProductAccess(productId){
  const s=window.LangBlueCore&&window.LangBlueCore.subscription&&window.LangBlueCore.subscription.current();
  if(!s||s.expired)return false;
  const ids=Array.isArray(s.productIds)?s.productIds:(Array.isArray(s.product_ids)?s.product_ids:null);
  if(!productId||!ids||!ids.length)return true;
  return ids.indexOf(productId)!==-1;
}
function showSubscriptionGate(productId){
  ensureGateStyles();
  if(document.getElementById('lbSubscriptionGate'))return;
  const root=document.createElement('div');root.id='lbSubscriptionGate';root.className='lb-subscription-gate';
  root.innerHTML='<div class="lb-subscription-gate-card"><div style="font-size:42px">🔒</div><h2>دوره رایگان ۴۸ ساعته تمام شده است</h2><p>برای ادامه استفاده از این محصول، یک اشتراک فعال لازم است. دسترسی از حساب مرکزی LangBlue مدیریت می‌شود.</p><div class="lb-central-actions" style="justify-content:center"><a class="btn btn-primary" href="/?account=required">🔑 ورود به حساب مرکزی</a><button class="btn btn-secondary" type="button" id="lbGateBack">بازگشت</button></div></div>';
  document.body.appendChild(root);
  document.getElementById('lbGateBack').onclick=()=>history.back();
}
function enforceProductAccess(){
  if(location.pathname==='/'||location.pathname.endsWith('/index.html'))return true;
  const product=productIdForPage();
  if(!product)return true;
  if(hasProductAccess(product))return true;
  showSubscriptionGate(product);
  return false;
}
async function init(){
  if(window.LangBlueMaintenance&&window.LangBlueMaintenance.active())return;
  await refreshSubscription();
  if(!(await enforceConnectionPolicy()))return;
  patchGrammar();patchGerman();patchVocab();enforceProductAccess();
  setInterval(enforceConnectionPolicy,300000);
  setTimeout(function(){hidePricing();if(window.PaidAccess&&window.PaidAccess.refreshButtons)window.PaidAccess.refreshButtons();},300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.LangBlueCentralAccess={refreshSubscription,patchGrammar,patchGerman,patchVocab,enforceProductAccess,hasProductAccess,enforceConnectionPolicy};
})(window,document);