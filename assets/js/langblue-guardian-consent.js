(function(window,document){
'use strict';
const POLICY_VERSION='2026-11-04-v1';
const SCOPE_LABELS={
  account_support:'کمک به مدیریت حساب',
  learning_progress:'مشاهدهٔ پیشرفت آموزشی',
  community_features:'ویژگی‌های اجتماعی و گروهی',
  research_participation:'مشارکت اختیاری در پژوهش'
};
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function message(text,type){
  const el=$('guardianMessage');if(!el)return;
  el.textContent=text||'';el.dataset.type=type||'info';el.hidden=!text;
}
async function invoke(action,payload={}){
  const client=window.LangBlueSupabase&&window.LangBlueSupabase.getClient();
  if(!client)throw new Error('اتصال به سامانه برقرار نیست.');
  const {data,error}=await client.functions.invoke('langblue-guardian-consent',{body:{action,...payload}});
  if(error)throw new Error(data&&data.error?data.error:(error.message||'ارتباط با سرور ناموفق بود.'));
  if(!data||!data.ok)throw new Error(data&&data.error||'درخواست انجام نشد.');
  return data;
}
function renderPending(rows,verified){
  const host=$('pendingForMe');
  if(!rows.length){host.innerHTML='<p class="muted">درخواست در انتظاری وجود ندارد.</p>';return;}
  host.innerHTML=rows.map(row=>{
    const who=row.otherAccount||{};
    const scopes=(row.requested_scopes||[]).map(s=>SCOPE_LABELS[s]||s);
    return '<article class="consent-item"><div><strong>'+escapeHtml(who.name||who.username||'حساب دانش‌آموز')+'</strong><div class="muted">درخواست در '+escapeHtml(new Date(row.created_at).toLocaleDateString('fa-IR'))+'</div><ul>'+scopes.map(s=>'<li>'+escapeHtml(s)+'</li>').join('')+'</ul></div><div class="actions">'+
      (verified?'<button class="primary" data-accept="'+escapeHtml(row.id)+'">پذیرش موارد بالا</button>':'<button class="primary" disabled title="تأیید سن بزرگسال هنوز ثبت نشده است">پذیرش پس از تأیید سن</button>')+
      '<button class="secondary" data-reject="'+escapeHtml(row.id)+'">رد درخواست</button></div></article>';
  }).join('');
  host.querySelectorAll('[data-accept]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    try{await invoke('accept',{requestId:btn.dataset.accept,scopes:rows.find(r=>r.id===btn.dataset.accept).requested_scopes});message('رضایت ثبت شد.','success');await load();}
    catch(e){message(e.message,'error');btn.disabled=false;}
  }));
  host.querySelectorAll('[data-reject]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    try{await invoke('reject',{requestId:btn.dataset.reject});message('درخواست رد شد.','success');await load();}
    catch(e){message(e.message,'error');btn.disabled=false;}
  }));
}
function renderMyRequests(rows){
  const host=$('myRequests');
  if(!rows.length){host.innerHTML='<p class="muted">هنوز درخواستی ثبت نکرده‌ای.</p>';return;}
  host.innerHTML=rows.map(row=>{
    const who=row.otherAccount||{};
    const status={pending:'در انتظار پاسخ',accepted:'پذیرفته‌شده',rejected:'ردشده',cancelled:'لغوشده',expired:'منقضی‌شده'}[row.status]||row.status;
    const scopes=(row.requested_scopes||[]).map(s=>SCOPE_LABELS[s]||s);
    return '<article class="consent-item"><div><strong>'+escapeHtml(who.name||who.username||'حساب سرپرست')+'</strong><div class="muted">'+escapeHtml(status)+'</div><div>'+scopes.map(escapeHtml).join('، ')+'</div></div>'+
      (row.status==='pending'?'<button class="secondary" data-cancel="'+escapeHtml(row.id)+'">لغو درخواست</button>':'')+'</article>';
  }).join('');
  host.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    try{await invoke('cancel',{requestId:btn.dataset.cancel});message('درخواست لغو شد.','success');await load();}
    catch(e){message(e.message,'error');btn.disabled=false;}
  }));
}
function renderRelationships(rows){
  const host=$('relationships');
  if(!rows.length){host.innerHTML='<p class="muted">هنوز رابطهٔ سرپرستی فعالی ثبت نشده است.</p>';return;}
  host.innerHTML=rows.map(row=>{
    const who=row.otherAccount||{};
    const role=row.role==='learner'?'سرپرست حساب تو':'حساب دانش‌آموز';
    const scopes=(row.scopes||[]).map(s=>SCOPE_LABELS[s]||s);
    return '<article class="consent-item"><div><strong>'+escapeHtml(who.name||who.username||'حساب مرتبط')+'</strong><div class="muted">'+role+' · '+(row.status==='active'?'فعال':'لغوشده')+'</div><div>'+scopes.map(escapeHtml).join('، ')+'</div></div>'+
      (row.status==='active'?'<button class="secondary" data-revoke="'+escapeHtml(row.id)+'">لغو رضایت</button>':'')+'</article>';
  }).join('');
  host.querySelectorAll('[data-revoke]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    try{await invoke('revoke',{relationshipId:btn.dataset.revoke});message('رضایت لغو شد و دسترسی‌های وابسته باید از این پس متوقف شوند.','success');await load();}
    catch(e){message(e.message,'error');btn.disabled=false;}
  }));
}
async function load(){
  const data=await invoke('overview');
  $('guardianVerificationNotice').hidden=!!data.guardianAgeVerified;
  $('guardianVerificationOk').hidden=!data.guardianAgeVerified;
  renderPending(data.pendingForMe||[],!!data.guardianAgeVerified);
  renderMyRequests(data.myRequests||[]);
  renderRelationships(data.relationships||[]);
}
async function init(){
  try{
    if(window.LangBlueCore?.Auth?.init)await window.LangBlueCore.Auth.init();
    const user=window.LangBlueCore?.Auth?.current?.();
    if(!user){$('loginRequired').hidden=false;$('guardianApp').hidden=true;return;}
    $('loginRequired').hidden=true;$('guardianApp').hidden=false;
    $('policyVersion').textContent=POLICY_VERSION;
    $('guardianRequestForm').addEventListener('submit',async event=>{
      event.preventDefault();message('');
      const checked=$('minorDeclaration').checked;
      if(!checked){message('برای ارسال درخواست باید تأیید کنی که زیر ۱۸ سال هستی.','error');return;}
      const scopes=[...document.querySelectorAll('[name="guardianScope"]:checked')].map(el=>el.value);
      if(!scopes.length){message('حداقل یک دامنهٔ رضایت را انتخاب کن.','error');return;}
      const submit=$('sendGuardianRequest');submit.disabled=true;
      try{
        await invoke('request',{confirmedUnder18:true,guardianUsername:$('guardianUsername').value.trim(),scopes});
        $('guardianRequestForm').reset();message('درخواست به حساب سرپرست ارسال شد. تا زمان پذیرش صریح، رضایتی ثبت نشده است.','success');await load();
      }catch(e){message(e.message,'error');}
      finally{submit.disabled=false;}
    });
    await load();
  }catch(e){message(e.message||'بارگذاری اطلاعات ناموفق بود.','error');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
