/* LangBlue Grammar Learning Engine
   Spaced repetition + mastery + daily review queue.
   Uses the existing Grammar graph and Supabase user_state for cross-device sync.
*/
(function(window){
  'use strict';

  const KEY='grammar:mastery:v1';
  const SYNC_KEY='grammar:mastery:sync:v1';

  function store(){ return window.Store; }
  function now(){ return Date.now(); }
  function dayMs(){ return 86400000; }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

  function blank(){
    return {score:0,streak:0,reps:0,lapses:0,correct:0,wrong:0,total:0,
      intervalDays:0,nextReviewAt:now(),lastReviewedAt:null,ease:2.3};
  }

  function all(){
    return store().get(KEY,{});
  }

  function get(id){
    const data=all();
    if(!data[id]) data[id]=blank();
    return data[id];
  }

  function save(data,remote){
    store().set(KEY,data);
    if(remote!==false) scheduleSync();
    return data;
  }

  let syncTimer=null;
  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(syncRemote,500);
  }

  async function syncRemote(){
    const sb=window.LangBlueSupabase;
    if(!sb || typeof sb.getUserState!=='function' || typeof sb.saveUserState!=='function') return;
    try{
      const remote=await sb.getUserState();
      const local=all();
      if(remote && remote[KEY] && typeof remote[KEY]==='object'){
        const merged=merge(local,remote[KEY]);
        store().set(KEY,merged);
      }
      const state=Object.assign({},remote||{});
      state[KEY]=all();
      await sb.saveUserState(state);
      store().set(SYNC_KEY,now());
    }catch(e){ console.warn('[LangBlue] Grammar mastery sync failed:',e); }
  }

  function merge(a,b){
    const out=Object.assign({},b||{});
    Object.keys(a||{}).forEach(id=>{
      const x=a[id], y=out[id];
      if(!y){ out[id]=x; return; }
      const xLast=Number(x.lastReviewedAt||0), yLast=Number(y.lastReviewedAt||0);
      out[id]=xLast>=yLast ? x : y;
    });
    return out;
  }

  function review(id,correct,meta){
    const data=all();
    const s=Object.assign(blank(),data[id]||{});
    const elapsed=s.lastReviewedAt ? Math.max(0,now()-s.lastReviewedAt) : 0;
    const seconds=Number(meta&&meta.responseSeconds||0);
    const hint=!!(meta&&meta.hint);
    const quality=correct ? (hint?3:(seconds>0 && seconds<=6?5:4)) : 1;

    s.total++;
    if(correct){
      s.correct++;
      s.streak++;
      s.reps++;
      s.lapses=Math.max(0,s.lapses-1);
      s.ease=clamp(s.ease + (quality>=5?0.08:0.03),1.3,2.8);
      const base=[0.5,1,3,7,14,30,60][Math.min(s.reps,6)];
      s.intervalDays=clamp(Math.max(base,s.intervalDays*s.ease),0.25,120);
      const gain=quality>=5?12:(quality>=4?9:6);
      s.score=clamp(s.score+gain+(s.streak>=3?2:0),0,100);
    }else{
      s.wrong++;
      s.streak=0;
      s.lapses++;
      s.ease=clamp(s.ease-0.12,1.3,2.8);
      s.intervalDays=0.08;
      s.score=clamp(s.score-15,0,100);
    }

    s.lastReviewedAt=now();
    s.nextReviewAt=now()+s.intervalDays*dayMs();
    data[id]=s;
    save(data,true);
    return s;
  }

  function due(id){
    return get(id).nextReviewAt<=now();
  }

  function masteryLabel(score){
    if(score>=90)return 'Mastered';
    if(score>=75)return 'Strong';
    if(score>=55)return 'Developing';
    if(score>0)return 'Learning';
    return 'New';
  }

  function pick(ids){
    const candidates=(ids||[]).map(id=>({id,s:get(id)}));
    const dueItems=candidates.filter(x=>x.s.nextReviewAt<=now());
    const pool=dueItems.length?dueItems:candidates;
    pool.sort((a,b)=>{
      if(a.s.score!==b.s.score)return a.s.score-b.s.score;
      return Number(a.s.nextReviewAt||0)-Number(b.s.nextReviewAt||0);
    });
    return pool[0] ? pool[0].id : null;
  }

  function stats(ids){
    const list=(ids||[]).map(get);
    const total=list.length;
    const mastered=list.filter(s=>s.score>=90).length;
    const dueCount=list.filter(s=>s.nextReviewAt<=now()).length;
    const practiced=list.filter(s=>s.total>0).length;
    const avg=total?Math.round(list.reduce((n,s)=>n+s.score,0)/total):0;
    const correct=list.reduce((n,s)=>n+s.correct,0);
    const wrong=list.reduce((n,s)=>n+s.wrong,0);
    const streak=Math.max(0,...list.map(s=>s.streak||0));
    return {total,mastered,dueCount,practiced,avg,correct,wrong,streak};
  }

  function injectReviewPanel(){
    if(!document.getElementById('tab-home') || document.getElementById('grammarReviewPanel')) return;
    const panel=document.createElement('div');
    panel.id='grammarReviewPanel';
    panel.className='card';
    panel.innerHTML='<h2>🧠 مرور هوشمند امروز</h2><div id="grammarReviewBody"></div>';
    document.getElementById('tab-home').prepend(panel);
    renderPanel();
  }

  function renderPanel(){
    const body=document.getElementById('grammarReviewBody');
    const graph=window.LangBlueGrammarRuntime&&window.LangBlueGrammarRuntime.Graph;
    if(!body||!graph)return;
    const ids=Object.keys(graph.nodes);
    const s=stats(ids);
    const pickId=pick(ids);
    const node=pickId&&graph.nodes[pickId];
    body.innerHTML=
      '<div class="stat-grid">'+
      '<div class="stat"><div class="num">'+s.dueCount+'</div><div class="lbl">نیازمند مرور</div></div>'+
      '<div class="stat"><div class="num">'+s.mastered+'</div><div class="lbl">تسلط کامل</div></div>'+
      '<div class="stat"><div class="num">'+s.avg+'٪</div><div class="lbl">میانگین تسلط</div></div>'+
      '<div class="stat"><div class="num">'+s.streak+'</div><div class="lbl">بیشترین تداوم</div></div>'+
      '</div>'+
      (node?'<div style="padding:14px;background:var(--panel-2);border-radius:8px;margin-top:10px;">'+
        '<strong>🎯 پیشنهاد بعدی: '+escapeHtml(node.label)+'</strong>'+
        '<div style="font-size:12px;color:var(--muted);margin-top:5px;">'+
        masteryLabel(get(node.id).score)+' • '+get(node.id).score+'٪ تسلط'+
        '</div><button class="small" id="grammarSmartPractice" style="margin-top:10px;">شروع مرور</button></div>':
        '<div class="empty">هنوز قاعده‌ای برای مرور ثبت نشده.</div>');
    const btn=document.getElementById('grammarSmartPractice');
    if(btn)btn.onclick=function(){
      const tab=document.querySelector('.tab[data-tab="flashcard"]');
      if(tab)tab.click();
    };
  }

  function decorateTable(){
    const graph=window.LangBlueGrammarRuntime&&window.LangBlueGrammarRuntime.Graph;
    const tbody=document.querySelector('#grammarTable tbody');
    if(!graph||!tbody)return;
    tbody.querySelectorAll('tr').forEach(row=>{
      const button=row.querySelector('button[onclick*="__practice"]');
      if(!button||row.querySelector('.mastery-cell'))return;
      const m=button.getAttribute('onclick').match(/__practice\('([^']+)'\)/);
      if(!m)return;
      const s=get(m[1]);
      const cell=document.createElement('td');
      cell.className='mastery-cell';
      cell.innerHTML='<div style="min-width:100px"><div style="font-size:11px;font-weight:700">'+
        masteryLabel(s.score)+' · '+s.score+'٪</div><div class="progress"><div style="width:'+s.score+'%"></div></div>'+
        '<div style="font-size:10px;color:var(--muted);margin-top:3px">'+
        (due(m[1])?'🔔 مرور امروز':'بعداً مرور می‌شود')+'</div></div>';
      row.insertBefore(cell,row.lastElementChild);
    });
  }

  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  function init(){
    injectReviewPanel();
    const tbody=document.querySelector('#grammarTable tbody');
    if(tbody)new MutationObserver(decorateTable).observe(tbody,{childList:true});
    decorateTable();
    syncRemote();
  }

  window.LangBlueGrammarEngine={
    KEY,get,all,review,due,pick,stats,masteryLabel,renderPanel,decorateTable,syncRemote
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
