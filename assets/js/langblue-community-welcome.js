(function(window,document){
'use strict';
if(window.__LBCommunityWelcomeLoaded)return;
window.__LBCommunityWelcomeLoaded=true;
var shown=false;
function client(){return window.LangBlueSupabase&&window.LangBlueSupabase.getClient?window.LangBlueSupabase.getClient():null;}
function invoke(client,action){return client.functions.invoke('langblue-community-access',{body:{action:action}});}
function show(client){
 if(shown)return;shown=true;
 var overlay=document.createElement('div');
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','خوش‌آمدگویی LangBlue');
 overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:auto;padding:22px;background:rgba(18,49,34,.97);color:#fff;text-align:center;font-family:system-ui,Tahoma,sans-serif';
 var card=document.createElement('div');card.style.cssText='max-width:850px;margin:auto';
 var roses=document.createElement('div');roses.textContent='🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹 🌹';roses.style.cssText='font-size:clamp(24px,5vw,48px);line-height:1.8';
 var title=document.createElement('h2');title.textContent='به LangBlue خوش آمدی!';title.style.cssText='font-size:clamp(28px,5vw,44px);margin:14px 0;color:#fff';
 var note=document.createElement('p');note.textContent='مشارکت تو ارزشمند است؛ یادگیری باید برای همه دسترس‌پذیرتر باشد.';note.style.cssText='color:#f0e9dc;line-height:1.9';
 var button=document.createElement('button');button.type='button';button.textContent='ادامه';button.style.cssText='border:0;border-radius:12px;padding:12px 24px;background:#86B99A;color:#14251D;font-weight:800;font-size:16px;cursor:pointer';
 button.addEventListener('click',function(){invoke(client,'welcome_seen').catch(function(){});overlay.remove();});
 card.append(roses,title,note,roses.cloneNode(true),button);overlay.appendChild(card);document.body.appendChild(overlay);
}
async function check(){
 var c=client();if(!c||shown)return;
 try{var s=await c.auth.getSession();if(!s.data||!s.data.session)return;
 var r=await invoke(c,'welcome');if(!r.error&&r.data&&r.data.showRoses)show(c);
 }catch(e){console.warn('[LangBlue] community welcome unavailable',e);}
}
function init(){
 var c=client();if(!c)return;
 c.auth.onAuthStateChange(function(){setTimeout(check,0);});
 check();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
