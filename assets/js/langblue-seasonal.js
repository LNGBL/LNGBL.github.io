(function(){
'use strict';
function tehranDate(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date());
 const o={}; parts.forEach(p=>o[p.type]=Number(p.value)); return o;
}
function isChristmas(){const d=tehranDate();return (d.month===12&&d.day>=20)||(d.month===1&&d.day<=1);}
function apply(){
 if(!isChristmas())return;
 document.body.classList.add('theme-christmas');
 if(document.getElementById('lbChristmasLayer'))return;
 const layer=document.createElement('div');
 layer.id='lbChristmasLayer';layer.className='lb-christmas-layer';layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<div class="lb-xmas-lights">●　●　●　●　●　●　●　●</div><div class="lb-xmas-snow">❄　·　❄　　·　❄　·　　❄　　·　❄</div><div class="lb-xmas-tree">🎄</div>';
 document.body.appendChild(layer);
}
const style=document.createElement('style');style.id='lb-christmas-style';
style.textContent='body.theme-christmas{position:relative;overflow-x:hidden} body.theme-christmas:after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9990;background:radial-gradient(circle at 8% 12%,rgba(255,255,255,.18),transparent 12%),radial-gradient(circle at 92% 18%,rgba(214,42,62,.13),transparent 15%),radial-gradient(circle at 50% 100%,rgba(20,128,82,.12),transparent 25%);mix-blend-mode:screen}.lb-christmas-layer{position:fixed;inset:0;pointer-events:none;z-index:9989;overflow:hidden}.lb-xmas-lights{position:absolute;left:3%;right:3%;top:0;height:42px;color:#f7d66a;font-size:15px;letter-spacing:9px;white-space:nowrap;text-align:center;text-shadow:0 0 9px rgba(247,214,106,.8),0 0 16px rgba(214,42,62,.45);opacity:.9}.lb-xmas-snow{position:absolute;inset:0;color:rgba(255,255,255,.55);font-size:19px;letter-spacing:18px;line-height:5.5;text-align:center;opacity:.36;animation:lbSnow 16s linear infinite}.lb-xmas-tree{position:absolute;right:18px;bottom:16px;font-size:34px;filter:drop-shadow(0 4px 14px rgba(255,255,255,.18));opacity:.78}@keyframes lbSnow{from{transform:translateY(-40px)}to{transform:translateY(70px)}} body.theme-christmas .occasion,body.theme-christmas .card,body.theme-christmas .receipt-builder,body.theme-christmas .central-activation-card{border-color:rgba(214,42,62,.22)} body.theme-christmas .btn-primary{background:#168a59;border-color:rgba(255,255,255,.22);box-shadow:0 10px 35px rgba(22,138,89,.28)} body.theme-christmas .brand-mark{background:#f5f1e9;color:#b72d3b;box-shadow:0 0 22px rgba(255,255,255,.5)}';
document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();