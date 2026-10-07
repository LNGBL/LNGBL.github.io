(function(window,document){
'use strict';
const ENDPOINT='https://ocxeyponzzcvlrvwndji.supabase.co/functions/v1/langblue-public-stats';
function animate(el,target){
  if(!el)return;
  const value=Math.max(0,Number(target)||0),start=performance.now(),duration=850;
  function frame(now){
    const p=Math.min(1,(now-start)/duration),e=1-Math.pow(1-p,3);
    el.textContent=Math.round(value*e).toLocaleString('fa-IR');
    if(p<1)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
async function load(){
  if(!document.getElementById('lbStatViews'))return;
  try{
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'view'}),cache:'no-store'});
    const data=await res.json();
    if(!data||!data.ok)throw new Error('stats');
    animate(document.getElementById('lbStatViews'),data.page_views);
    animate(document.getElementById('lbStatUsers'),data.user_accounts);
    animate(document.getElementById('lbStatWords'),data.vocabulary_count);
    animate(document.getElementById('lbStatGoogle'),data.google_users);
  }catch(e){
    ['lbStatViews','lbStatUsers','lbStatWords','lbStatGoogle'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})(window,document);