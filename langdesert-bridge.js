/* LangDesert ↔ LangBlue central integration. Arabic is an educational module connected to the central account. */
(function(window,document){
'use strict';
const LEVELS=['A1','A2','B1','B2','C1','C2'],WKEY='langDesert_words',VKEY='langDesert_verbs',OWNER='langDesert_owner_user_id';
let uid=null,timer=null,booted=false,booting=false;
const api=(action,body={})=>window.LangBlueBackend.invoke('langblue-arabic',{action,...body});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function user(){return window.LangBlueCore?.Auth?.current?.()||null}
function level(){return window.__LangDesertArabic?.level||'A1'}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync(),800)}
async function sha256(value){
 const data=new TextEncoder().encode(String(value));
 const hash=await crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function sync(){
 if(!uid||!window.LangBlueSupabase)return;
 try{
  const words=window.getWords?window.getWords():[],verbs=window.getVerbs?window.getVerbs():[];
  const state=await window.LangBlueSupabase.getUserState()||{};
  state.langDesert={version:3,level:level(),words,verbs,updatedAt:new Date().toISOString()};
  await window.LangBlueSupabase.saveUserState(state);

  const client=window.LangBlueSupabase.getClient?.();
  if(!client)return;
  const {data:profile,error:profileError}=await client.from('profiles').select('peer_learning_consent,exam_contribution_consent').eq('id',uid).maybeSingle();
  if(profileError||!profile?.peer_learning_consent)return;

  const items=[
   ...words.map(w=>({source_type:'vocabulary',source_content:w.word,translation_fa:w.persianTranslation,word_type:w.categories?.mainType,example_text:w.sentences?.[0]?.arabic})),
   ...verbs.map(v=>({source_type:'grammar',source_content:v.past||v.root,translation_fa:v.meaning,grammar_explanation_fa:[v.babName,v.babPattern,v.features?.join('، ')].filter(Boolean).join(' · '),example_text:v.example}))
  ].filter(x=>String(x.source_content||'').trim());
  if(!items.length)return;

  const prepared=[];
  for(const item of items){
   const canonical=JSON.stringify({language:'arabic',level:level(),source_type:item.source_type,source_content:String(item.source_content).trim(),translation_fa:item.translation_fa||'',word_type:item.word_type||'',grammar_explanation_fa:item.grammar_explanation_fa||'',example_text:item.example_text||''});
   prepared.push({item,hash:await sha256(canonical)});
  }
  const hashes=prepared.map(x=>x.hash);
  const {data:existing}=await client.from('content_contributions').select('source_hash').eq('user_id',uid).in('source_hash',hashes);
  const seen=new Set((existing||[]).map(x=>x.source_hash));
  const rows=prepared.filter(x=>!seen.has(x.hash)).map(x=>({
   user_id:uid,source_type:x.item.source_type,language:'arabic',language_level:level(),
   payload:x.item,source_hash:x.hash,consent_snapshot:true,
   exam_eligible:profile.exam_contribution_consent===true
  }));
  if(rows.length)await client.from('content_contributions').insert(rows);
 }catch(e){console.warn('[LangDesert] sync skipped',e)}
}
function mergeUnique(primary,legacy,key){
 const out=Array.isArray(primary)?primary.slice():[];
 const seen=new Set(out.map(x=>String(key(x))));
 legacy.forEach(x=>{const k=String(key(x));if(!seen.has(k)){seen.add(k);out.push(x)}});
 return out;
}
function migrate(state){
 const owner=localStorage.getItem(OWNER),remote=state.langDesert||{};
 let oldW=[],oldV=[];
 try{oldW=JSON.parse(localStorage.getItem(WKEY)||'[]')||[]}catch(_){}
 try{oldV=JSON.parse(localStorage.getItem(VKEY)||'[]')||[]}catch(_){}
 const canMigrateLegacy=!owner||owner===uid;
 const remoteWords=Array.isArray(remote.words)?remote.words:[];
 const remoteVerbs=Array.isArray(remote.verbs)?remote.verbs:[];
 const words=canMigrateLegacy?mergeUnique(remoteWords,oldW,x=>x?.id??x?.word??''):remoteWords;
 const verbs=canMigrateLegacy?mergeUnique(remoteVerbs,oldV,x=>x?.id??x?.root??x?.past??''):remoteVerbs;
 localStorage.setItem('lb:user:'+uid+':LangDesert_words',JSON.stringify(words));
 localStorage.setItem('lb:user:'+uid+':LangDesert_verbs',JSON.stringify(verbs));
 localStorage.removeItem(WKEY);localStorage.removeItem(VKEY);localStorage.setItem(OWNER,uid);
 localStorage.removeItem('langDesert_user');
}
let assessmentState=null;
function assessmentPanel(p){
 const old=document.getElementById('lbDesertAssessment');if(old)old.remove();
 const a=document.createElement('div');a.id='lbDesertAssessment';a.className='desert-card';a.style.cssText='margin-top:14px;padding:22px;max-width:1400px';
 a.innerHTML='<h3 style="margin-top:0">🧭 آزمون تعیین سطح عربی</h3><div id="lbArabicAssessmentBody">آزمون، سطح واقعی کاربر را از A1 تا C2 برآورد می‌کند و نتیجه را به حساب مرکزی و لایه پژوهشی می‌فرستد.</div><button id="lbArabicAssessmentStart" class="btn-desert-secondary" style="margin-top:12px">شروع آزمون</button>';
 p.insertAdjacentElement('afterend',a);
 a.querySelector('#lbArabicAssessmentStart').onclick=async()=>{const r=await api('placement_start');if(!r.ok){a.querySelector('#lbArabicAssessmentBody').textContent='آزمون در حال حاضر قابل شروع نیست: '+r.error;return}assessmentState={session_id:r.session_id,questions:r.questions,index:0,answers:[]};renderAssessment(a)};
}
function renderAssessment(a){
 const q=assessmentState.questions[assessmentState.index],body=a.querySelector('#lbArabicAssessmentBody'),total=assessmentState.questions.length;
 body.innerHTML='<div style="margin-bottom:10px;color:#6b5a4a">سؤال '+(assessmentState.index+1)+' از '+total+' · سطح آزمایشی '+esc(q.level)+'</div><div style="font-size:1.6em;font-weight:700;margin-bottom:12px">'+esc(q.prompt)+'</div>'+(q.example_text?'<div style="margin-bottom:12px;color:#6b5a4a">'+esc(q.example_text)+'</div>':'')+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+q.options.map((o,i)=>'<button data-i="'+i+'" class="btn-desert-secondary" style="background:#fff;color:#3d2b1f;border:2px solid #C4A882">'+esc(o)+'</button>').join('')+'</div>';
 body.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=async()=>{assessmentState.answers.push({question_id:q.id,selected_index:Number(btn.dataset.i)});if(assessmentState.index<total-1){assessmentState.index++;renderAssessment(a)}else{const res=await api('placement_submit',{session_id:assessmentState.session_id,answers:assessmentState.answers});if(res.ok){body.innerHTML='<strong>نتیجه تعیین سطح: '+esc(res.detected_level)+'</strong><br>امتیاز: '+esc(res.percent)+'٪<br><span style="color:#6b5a4a">این سطح اکنون مبنای دریافت محتوای عربی شخصی‌سازی‌شده است.</span>';window.__LangDesertArabic.level=res.detected_level;await loadContent();if(window.renderAll)window.renderAll()}else body.textContent='ثبت نتیجه انجام نشد: '+res.error}});
}
function panel(u){
 if(document.getElementById('lbDesertCentralPanel'))return;
 const header=document.querySelector('.desert-header');if(!header)return;
 const p=document.createElement('div');p.id='lbDesertCentralPanel';p.className='desert-card';p.style.cssText='margin-top:18px;padding:18px 22px;max-width:1400px';
 p.innerHTML='<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><strong>🔷 حساب مرکزی LangBlue</strong><div style="font-size:.9em;color:#6b5a4a;margin-top:4px">'+esc(u.name||u.username||'کاربر')+' · داده‌های عربی به همین حساب متصل است.</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label style="font-size:.9em">سطح عربی:</label><select id="lbDesertLevel" style="padding:8px 12px;border:1px solid #C4A882;border-radius:10px;background:#fff;font:inherit">'+LEVELS.map(x=>'<option value="'+x+'" '+(x===level()?'selected':'')+'>'+x+'</option>').join('')+'</select><button id="lbArabicAssessmentBtn" class="btn-desert-secondary" type="button">🧭 تعیین سطح</button><a href="/?account=required" style="padding:8px 13px;border-radius:10px;background:#2C5F2D;color:#fff;text-decoration:none;font-weight:700">حساب مرکزی</a></div></div><div id="lbDesertSyncStatus" style="margin-top:9px;font-size:.82em;color:#6b5a4a">در حال اتصال…</div>';
 header.insertAdjacentElement('afterend',p);
 p.querySelector('#lbArabicAssessmentBtn').addEventListener('click',()=>assessmentPanel(p));
 p.querySelector('#lbDesertLevel').addEventListener('change',async e=>{const r=await api('set_level',{level:e.target.value});if(r.ok){window.__LangDesertArabic.level=e.target.value;await loadContent();if(window.renderAll)window.renderAll()}});
}
async function loadContent(){
 const r=await api('bootstrap',{level:level()});
 const s=document.getElementById('lbDesertSyncStatus');
 if(!r.ok){if(s)s.textContent='حساب مرکزی فعال است؛ بارگذاری محتوای عربی موقتاً در دسترس نیست. داده‌های شخصی محلی همچنان حفظ می‌شوند.';return false;}
 if(s)s.textContent='اتصال مرکزی فعال · '+(r.vocabulary||[]).length+' واژه و '+(r.grammar||[]).length+' محتوای گرامری برای سطح '+r.level+'.';
 window.__LangDesertArabic.remote=r;
 let gp=document.getElementById('lbDesertGrammarPanel');
 if(!gp){gp=document.createElement('div');gp.id='lbDesertGrammarPanel';gp.className='desert-card';gp.style.cssText='margin-top:14px;padding:22px;max-width:1400px';const anchor=document.getElementById('lbDesertCentralPanel');if(anchor)anchor.insertAdjacentElement('afterend',gp);}
 gp.innerHTML='<h3 style="margin-top:0">📚 قواعد عربی · سطح '+esc(r.level)+'</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">'+(r.grammar||[]).slice(0,12).map(x=>'<article style="padding:14px;border:1px solid rgba(196,168,130,.35);border-radius:16px;background:rgba(255,255,255,.35)"><strong>'+esc(x.source_content)+'</strong><div style="margin-top:6px;color:#6b5a4a">'+esc(x.translation_fa||'')+'</div>'+(x.example_text?'<div style="margin-top:8px">'+esc(x.example_text)+'</div>':'')+'</article>').join('')+'</div>';
 const words=window.getWords?window.getWords():[],seen=new Set(words.map(x=>String(x.word||'').trim().toLowerCase()));
 (r.vocabulary||[]).forEach(x=>{const k=String(x.source_content||'').trim().toLowerCase();if(!k||seen.has(k))return;words.push({id:'remote-'+x.id,word:x.source_content,persianTranslation:x.translation_fa||'',categories:{mainType:x.word_type||'اسم'},sentences:x.example_text?[{arabic:x.example_text,persian:''}]:[],status:0,lastReviewed:null,correctCount:0,wrongCount:0,createdAt:x.created_at||new Date().toISOString(),source:'langblue-central',level:x.level});seen.add(k)});
 if(window.saveWords)window.saveWords(words);
 return true;
}
function patch(){
 if(window.__LangDesertPersistencePatched)return;
 if(typeof window.saveWords==='function'){const f=window.saveWords;window.saveWords=function(v){const r=f.apply(this,arguments);schedule();return r}}
 if(typeof window.saveVerbs==='function'){const f=window.saveVerbs;window.saveVerbs=function(v){const r=f.apply(this,arguments);schedule();return r}}
 window.__LangDesertPersistencePatched=true;
}
async function boot(){
 if(booted||booting)return;
 booting=true;
 try{
  if(!window.LangBlueBackend||!window.LangBlueSupabase)return;
  const u=user();
  if(!u){window.addEventListener('lb:central-session-ready',()=>boot(),{once:true});return;}
  uid=u.id;
  const state=await window.LangBlueSupabase.getUserState()||{};
  const initial=await api('bootstrap',{});
  window.__LangDesertArabic={version:3,userId:uid,level:initial.ok?(initial.level||state.langDesert?.level||'A1'):(state.langDesert?.level||'A1')};
  migrate(state);panel(u);patch();
  const reg=document.getElementById('registerSection'),app=document.getElementById('mainApp'),name=document.getElementById('userNameDisplay');
  if(reg)reg.classList.add('hidden');if(app)app.classList.remove('hidden');if(name)name.textContent=u.name||u.username||'';
  await loadContent();if(window.renderAll)window.renderAll();await sync();
  booted=true;
 }catch(e){console.warn('[LangDesert] boot skipped',e)}
 finally{booting=false}
}
window.LangDesertBridge={boot,sync,schedule,loadContent,assessmentPanel};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);