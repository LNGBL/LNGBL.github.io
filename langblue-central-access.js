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
async function init(){
  if(window.LangBlueMaintenance&&window.LangBlueMaintenance.active())return;
  await refreshSubscription();
  patchGrammar();patchGerman();patchVocab();
  setTimeout(function(){hidePricing();if(window.PaidAccess&&window.PaidAccess.refreshButtons)window.PaidAccess.refreshButtons();},300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.LangBlueCentralAccess={refreshSubscription,patchGrammar,patchGerman,patchVocab};
})(window,document);