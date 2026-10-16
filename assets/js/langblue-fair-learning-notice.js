(function(w,d){
'use strict';
if(d.getElementById('lb-fair-learning-notice'))return;
function add(){
 if(d.getElementById('lb-fair-learning-notice'))return;
 var bar=d.createElement('aside');bar.id='lb-fair-learning-notice';bar.setAttribute('role','region');bar.setAttribute('aria-label','دسترسی منصفانه به یادگیری');
 bar.style.cssText='position:sticky;top:0;z-index:99990;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 16px;background:#e7f1e7;color:#173e2c;border-bottom:1px solid #b8d0bb;box-shadow:0 3px 14px rgba(0,0,0,.08);font:600 14px/1.65 system-ui,Tahoma,sans-serif;text-align:center';
 var msg=d.createElement('span');msg.textContent='🌿 دسترسی منصفانه به یادگیری: برنامهٔ تخفیف اجتماعی برای سنین ۱۰ تا ۶۹ سال؛ در صورت تأیید، ۱۰٪ تخفیف تا شش ماه و امکان جمع‌شدن با تخفیف بستهٔ واجدشرایط.';
 var link=d.createElement('a');link.href=(w.location.pathname.indexOf('/pages/')!==-1?'community-access.html':'pages/community-access.html');link.textContent='شرایط و درخواست';link.style.cssText='color:#155d3a;font-weight:850;text-decoration:underline;white-space:nowrap';
 var close=d.createElement('button');close.type='button';close.textContent='بستن';close.setAttribute('aria-label','بستن اعلان');close.style.cssText='border:1px solid #9bb9a0;border-radius:9px;padding:3px 10px;background:#fff;color:#24543a;font:inherit;cursor:pointer';
 close.addEventListener('click',function(){bar.remove();try{sessionStorage.setItem('lbFairNoticeDismissed','1')}catch(e){}});
 bar.append(msg,link,close);if(d.body)d.body.insertBefore(bar,d.body.firstChild);
}
try{if(sessionStorage.getItem('lbFairNoticeDismissed')==='1')return}catch(e){}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',add,{once:true});else add();
})(window,document);