const KEY='langred_ru_items_v1', STATE_KEY='langred_ru';
const intervals=[4,24,72,168,336].map(h=>h*60*60*1000);
let items=[],due=[],current=null,revealed=false;
const $=id=>document.getElementById(id);
const localRead=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}};
const localWrite=()=>localStorage.setItem(KEY,JSON.stringify(items));
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function load(){
 const local=localRead(),api=window.LangBlueSupabase;
 if(api?.localUserId?.() && api?.getUserState){
   const remote=await api.getUserState();
   const remoteItems=remote?.[STATE_KEY]?.items;
   if(Array.isArray(remoteItems)){
     const map=new Map([...remoteItems,...local].map(x=>[x.id,x]));
     items=[...map.values()];
   } else items=local;
 } else items=local;
 localWrite(); await save(); render();
}
async function recordEncounter(item, eventName, extra={}){
 const api=window.LangBlueSupabase;
 try{
   const sb=api?.getClient?.(),session=await api?.getAuthSession?.();
   if(!sb||!session?.user?.id)return;
   const {error}=await sb.from('learning_encounters').insert({
     user_id:session.user.id,language:'russian',product_id:'langred',
     context_id:'langred_'+eventName,concept_key:item.id,
     source_type:eventName==='review'?'review':(item.kind==='grammar'?'grammar':'word'),
     source_ref:item.id,context_payload:{kind:item.kind,level:item.level,event:eventName,...extra},
     encountered_at:new Date().toISOString(),
     next_reencounter_at:item.nextReviewAt||null
   });
   if(error)console.warn('[LangRed] central learning event not saved',error.message);
 }catch(e){console.warn('[LangRed] central learning event deferred',e)}
}
async function save(){
 localWrite();
 const api=window.LangBlueSupabase;
 if(!api?.localUserId?.()||!api?.getUserState||!api?.saveUserState)return;
 try{const state=await api.getUserState()||{};state[STATE_KEY]={version:1,items,updatedAt:new Date().toISOString()};await api.saveUserState(state)}catch(e){console.warn('[LangRed] sync deferred',e)}
}
function render(){
 const now=Date.now();due=items.filter(x=>!x.nextReviewAt||new Date(x.nextReviewAt).getTime()<=now).sort((a,b)=>(a.nextReviewAt||'').localeCompare(b.nextReviewAt||''));
 $('count').textContent=items.length+' مورد';$('due-count').textContent=due.length+' مورد برای مرور';
 $('items').innerHTML=items.length?items.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(x=>'<article class="item"><div class="ru">'+escapeHtml(x.ru)+'</div><div class="ipa">'+escapeHtml(x.ipa||'')+'</div><div>'+escapeHtml(x.fa)+'</div><p class="muted">'+escapeHtml(x.example||'')+'</p><div class="row"><span class="pill">'+(x.kind==='grammar'?'گرامر':'واژگان')+'</span><span class="pill">'+escapeHtml(x.level)+'</span><button class="btn" data-delete="'+escapeHtml(x.id)+'">حذف</button></div></article>').join(''):'<div class="empty">هنوز محتوایی ثبت نشده است.</div>';
 current=due[0]||null;revealed=false;showReview();
}
function showReview(){
 if(!current){$('review-card').innerHTML='<div class="empty">فعلاً موردی برای مرور نداری. یک واژه یا قاعده اضافه کن.</div>';return}
 $('review-card').innerHTML='<div class="ru">'+escapeHtml(current.ru)+'</div><div class="ipa">'+escapeHtml(current.ipa||'')+'</div>'+(revealed?'<p>'+escapeHtml(current.fa)+'</p><p class="muted">'+escapeHtml(current.example||'')+'</p>':'<p class="muted">ابتدا معنی یا کاربرد را به خاطر بیاور، سپس پاسخ را نمایش بده.</p>');
}
function review(success){
 if(!current)return;
 const idx=Number(current.intervalIndex||0);
 current.intervalIndex=success?Math.min(idx+1,intervals.length-1):0;
 const delay=success?intervals[current.intervalIndex]:4*60*60*1000;
 current.nextReviewAt=new Date(Date.now()+delay).toISOString();current.updatedAt=new Date().toISOString();
 recordEncounter(current,'review',{grade:success?'remembered':'retry',intervalIndex:current.intervalIndex}).finally(()=>save().then(render));
}
$('item-form').addEventListener('submit',async e=>{
 e.preventDefault();const ru=$('ru').value.trim(),fa=$('fa').value.trim();if(!ru||!fa)return;
 items.push({id:crypto.randomUUID(),kind:$('kind').value,ru,fa,ipa:$('ipa').value.trim(),example:$('example').value.trim(),level:$('level').value,intervalIndex:0,nextReviewAt:new Date(Date.now()+4*60*60*1000).toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 const created=items[items.length-1];e.target.reset();await recordEncounter(created,'created');await save();render();
});
$('reveal').addEventListener('click',()=>{revealed=true;showReview()});
$('remember').addEventListener('click',()=>review(true));$('again').addEventListener('click',()=>review(false));
$('items').addEventListener('click',async e=>{const id=e.target?.dataset?.delete;if(!id)return;items=items.filter(x=>x.id!==id);await save();render()});
async function init(){
 const api=window.LangBlueSupabase;let connected=false;
 try{connected=!!(api?.available?.()&&api?.localUserId?.());}catch{}
 $('connection').textContent=connected?'حساب مرکزی شناسایی شد؛ همگام‌سازی فضای LangRed فعال است.':'در حالت محلی قابل استفاده است؛ برای همگام‌سازی، ابتدا وارد حساب مرکزی LangBlue شو.';
 await load();$('loading').classList.add('done');setTimeout(()=>$('loading')?.remove(),350);
}
init().catch(e=>{$('connection').textContent='همگام‌سازی انجام نشد؛ داده‌ها در این مرورگر نگهداری می‌شوند.';items=localRead();render();$('loading').classList.add('done');setTimeout(()=>$('loading')?.remove(),350);console.error(e)});
