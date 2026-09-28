(function(window,document){
'use strict';
const MESSAGE = 'Dear user ($name), due to the fact that we are currently in the server\'s rest and self-purification peak, we are unable to host you.\nTherefore, we consider it our duty to inform you that this operation will continue until the coming hours (6 AM). The site will be temporarily closed. We hope you will accept our apologies for this inconvenience.';
function tehranParts(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const o={};p.forEach(x=>o[x.type]=x.value);return o;
}
function active(){
  const p=tehranParts(), h=Number(p.hour), m=Number(p.minute), min=h*60+m;
  const now=new Date();
  const week=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric'}).format(now));
  // ISO week is calculated from the Tehran calendar date to avoid browser-local timezone drift.
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const date=new Date(Date.UTC(Number(parts.find(x=>x.type==='year').value),Number(parts.find(x=>x.type==='month').value)-1,Number(parts.find(x=>x.type==='day').value)));
  const thurs=new Date(date); thurs.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  const isoWeek=Math.ceil((((date-thurs)/86400000)+1)/7)+Math.floor((thurs.getUTCMonth()+1)/12);
  const dow=(date.getUTCDay()===0?7:date.getUTCDay());
  return (dow===4 && isoWeek%2===0 && min>=1410) || (dow===5 && isoWeek%2===0 && min<360);
}
function overlay(){
  if(document.getElementById('lbMaintenanceOverlay'))return;
  const s=document.createElement('style');s.textContent='#lbMaintenanceOverlay{position:fixed;inset:0;z-index:2147483647;background:#071521;color:#f7fbff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.lb-maintenance-box{max-width:760px;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:30px;background:#0b2235;box-shadow:0 30px 100px rgba(0,0,0,.45)}.lb-maintenance-box h1{font-size:24px;margin:0 0 16px}.lb-maintenance-box p{white-space:pre-line;line-height:2;color:#d5e2e7;margin:0}.lb-maintenance-time{margin-top:18px;color:#72cbd7;font-weight:800;font-size:13px}';
  document.head.appendChild(s);
  const d=document.createElement('div');d.id='lbMaintenanceOverlay';
  const u=window.LangBlueCore&&window.LangBlueCore.Auth?window.LangBlueCore.Auth.current():null;
  const name=u&&u.name?u.name:'user';
  d.innerHTML='<div class="lb-maintenance-box"><h1>LangBlue · Server Rest</h1><p>'+MESSAGE.replace('($name)',name).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p><div class="lb-maintenance-time">23:30 → 06:00 · Tehran · biweekly Thursday</div></div>';
  document.body.appendChild(d);
}
function apply(){if(active()){document.documentElement.setAttribute('data-lb-maintenance','1');overlay();}}
window.LangBlueMaintenance={active,apply,message:MESSAGE};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})(window,document);