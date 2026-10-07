/* LangBlue daily learning rewards + anonymous Markov peer learning. */
(function(window,document){
  'use strict';
  const URL_BASE='https://ocxeyponzzcvlrvwndji.supabase.co/functions/v1/';
  function client(){return window.LangBlueSupabase&&window.LangBlueSupabase.getClient?window.LangBlueSupabase.getClient():null;}
  async function invoke(name,body){
    const sb=client(); if(!sb)return {ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};
    const {data,error}=await sb.functions.invoke(name,{body});
    if(error){
      let msg=error.message||'FUNCTION_ERROR';
      try{if(error.context&&typeof error.context.json==='function'){const p=await error.context.json();msg=p&&(p.error||p.message)||msg;}}catch(e){}
      return {ok:false,error:msg};
    }
    return data||{ok:false,error:'EMPTY_RESPONSE'};
  }
  function uid(){
    try{
      const s=JSON.parse(localStorage.getItem('lb:session')||'null');
      return s&&s.userId?s.userId:null;
    }catch(e){return null}
  }
  function words(){
    const id=uid(); if(!id)return [];
    try{
      const raw=localStorage.getItem('lb:user:'+id+':LangBlue_WORDS');
      const arr=raw?JSON.parse(raw):[];
      return Array.isArray(arr)?arr:[];
    }catch(e){return []}
  }
  async function sync(language){
    const arr=words().slice(-200);
    const payload=arr.map(w=>({word:w.word||w.term||w.en||'',persian:w.persian||w.fa||w.translation||''}));
    if(payload.length<2)return {ok:false,error:'NOT_ENOUGH_WORDS'};
    return invoke('langblue-peer-markov',{action:'sync',language:language||'english',words:payload});
  }
  async function sample(language){
    return invoke('langblue-peer-markov',{action:'sample',language:language||'english'});
  }
  async function spin(reroll){
    const key='spin_'+crypto.randomUUID().replace(/-/g,'');
    return invoke('langblue-spin',{idempotency_key:key,reroll:!!reroll});
  }
  function spinText(){
    return '📚 ۲۵ توکن آموزشی روزانه دریافت کردی.';
  }
  function injectStyles(){
    if(document.getElementById('lb-engagement-style'))return;
    const s=document.createElement('style');s.id='lb-engagement-style';
    s.textContent='.lb-engagement-panel{margin-top:16px;padding:15px;border:1px solid rgba(88,199,232,.22);border-radius:16px;background:rgba(22,138,173,.06)}.lb-engagement-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.lb-engagement-note{font-size:12px;color:#8faeb7;line-height:1.8;margin-top:7px}.lb-markov-card{margin-top:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}';
    document.head.appendChild(s);
  }
  function installSpinInAccount(){
    const body=document.getElementById('lbCentralBody'); if(!body||!window.LangBlueCore?.Auth?.current())return;
    injectStyles();
    if(document.getElementById('lbDailySpinPanel'))return;
    const panel=document.createElement('section');panel.id='lbDailySpinPanel';panel.className='lb-engagement-panel';
    panel.innerHTML='<strong>🎯 پاداش روزانه</strong><div class="lb-engagement-note">هر ۲۴ ساعت یک بار؛ پاداش ثابت آموزشی روی سرور ثبت می‌شود.</div><div class="lb-engagement-actions"><button class="btn btn-primary" type="button" id="lbDailySpinBtn">دریافت پاداش روزانه</button></div><div id="lbDailySpinResult" class="lb-central-error"></div>';
    body.querySelector('.lb-central-actions')?.before(panel);
    panel.querySelector('#lbDailySpinBtn').onclick=async function(){
      const btn=this,out=panel.querySelector('#lbDailySpinResult');btn.disabled=true;out.textContent='در حال ثبت…';
      let r=await spin(false);
      if(!r.ok){out.textContent=r.error==='SPIN_COOLDOWN'?'هنوز ۲۴ ساعت کامل نشده است.':r.error;btn.disabled=false;return;}
      out.style.color='#9be7b4';out.textContent=spinText();
    };
  }
  function installMarkovInVocab(){
    if(!/\/pages\/vocab\.html$/i.test(location.pathname))return;
    injectStyles();
    if(document.getElementById('lbMarkovPanel'))return;
    const panel=document.createElement('section');panel.id='lbMarkovPanel';panel.className='lb-markov-card';
    panel.innerHTML='<strong>🧠 شبکهٔ یادگیری واژگان</strong><div class="lb-engagement-note">نمونه‌های رضایت‌داده‌شده به‌صورت ناشناس در یک زنجیرهٔ مارکوف سطح‌بندی‌شده استفاده می‌شوند؛ نام صاحب واژه نمایش داده نمی‌شود.</div><div class="lb-engagement-actions"><button class="btn btn-secondary" id="lbMarkovSync" type="button">همگام‌سازی واژه‌ها</button><button class="btn btn-primary" id="lbMarkovSample" type="button">🎲 دریافت زنجیرهٔ تصادفی</button></div><div id="lbMarkovResult" class="lb-engagement-note"></div>';
    const target=document.querySelector('main')||document.querySelector('.container')||document.body;
    target.insertBefore(panel,target.firstChild);
    panel.querySelector('#lbMarkovSync').onclick=async function(){
      const out=panel.querySelector('#lbMarkovResult');out.textContent='در حال همگام‌سازی…';
      const r=await sync('english');out.textContent=r.ok?'واژه‌های مجاز و زنجیره‌ها روی سرور ثبت شدند.':(r.error||'همگام‌سازی ناموفق بود.');
    };
    panel.querySelector('#lbMarkovSample').onclick=async function(){
      const out=panel.querySelector('#lbMarkovResult');out.textContent='در حال نمونه‌گیری…';
      const r=await sample('english');
      if(!r.ok){out.textContent=r.error==='NO_OTHER_CONTRIBUTOR'?'هنوز نمونهٔ ناشناس دیگری برای سطح تو موجود نیست.':(r.error||'نمونه‌گیری انجام نشد.');return;}
      const items=r.delivery?.content?.items||[];
      out.innerHTML='<strong>زنجیرهٔ پیشنهادی:</strong> '+items.map(x=>String(x.word||'')).join(' → ')+(items.some(x=>x.translation)?'<br><small>'+items.map(x=>x.translation||'—').join(' · ')+'</small>':'');
    };
    setTimeout(function(){sync('english').catch(function(){});},1500);
  }
  window.LangBlueEngagement={spin,sync,sample,installSpinInAccount,installMarkovInVocab};
  function init(){
    if(window.LangBlueCentralAccount){
      const oldOpen=window.LangBlueCentralAccount.open;
      window.LangBlueCentralAccount.open=function(){const r=oldOpen.apply(this,arguments);setTimeout(installSpinInAccount,80);return r;};
    }
    installMarkovInVocab();
    setTimeout(installSpinInAccount,120);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
