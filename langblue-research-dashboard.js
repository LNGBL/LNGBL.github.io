(function(){
  'use strict';

  const state={data:null};

  function $(id){return document.getElementById(id);}
  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtNumber(value){return Number(value||0).toLocaleString('fa-IR');}
  function fmtDate(value){
    if(!value)return '—';
    try{return new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
    catch(_){return String(value);}
  }
  function pct(a,b){return b?Math.round((a/b)*100):0;}

  function setStatus(message,type){
    const el=$('researchStatus');
    if(!el)return;
    el.textContent=message;
    el.dataset.type=type||'';
  }

  function renderSummary(s){
    $('kpiEvents').textContent=fmtNumber(s.total_events);
    $('kpiUsers').textContent=fmtNumber(s.unique_learners);
    $('kpiSessions').textContent=fmtNumber(s.unique_sessions);
    $('kpiDays').textContent=fmtNumber(s.active_days);
    $('lastEvent').textContent=s.last_event_at?('آخرین رویداد: '+fmtDate(s.last_event_at)):'هنوز رویدادی ثبت نشده است';
  }

  function renderFunnel(rows){
    const body=$('funnelBody');
    if(!rows.length){
      body.innerHTML='<tr><td colspan="7" class="empty">هنوز داده‌ای برای تحلیل قیف وجود ندارد.</td></tr>';
      return;
    }
    body.innerHTML=rows.map(r=>{
      const pv=Number(r.page_view_users||0);
      return '<tr>'+
        '<td><strong>'+esc(r.product_id||'بدون محصول')+'</strong></td>'+
        '<td>'+fmtNumber(pv)+'</td>'+
        '<td>'+fmtNumber(r.learning_started_users)+'</td>'+
        '<td>'+fmtNumber(r.learning_completed_users)+'</td>'+
        '<td>'+fmtNumber(r.weakness_opened_users)+'</td>'+
        '<td>'+fmtNumber(r.subscription_selected_users)+'</td>'+
        '<td>'+fmtNumber(r.activation_completed_users)+'</td>'+
      '</tr>';
    }).join('');
  }

  function renderDaily(rows){
    const body=$('dailyBody');
    if(!rows.length){
      body.innerHTML='<tr><td colspan="6" class="empty">هنوز رویدادی ثبت نشده است. بعد از ورود یک کاربر به LangBlue، داده‌های واقعی اینجا ظاهر می‌شوند.</td></tr>';
      return;
    }
    const recent=rows.slice(0,80);
    body.innerHTML=recent.map(r=>
      '<tr><td>'+esc(r.event_date)+'</td><td>'+esc(r.product_id||'—')+'</td><td>'+esc(r.event_name)+'</td><td>'+fmtNumber(r.event_count)+'</td><td>'+fmtNumber(r.unique_users)+'</td><td>'+fmtNumber(r.unique_sessions)+'</td></tr>'
    ).join('');
  }

  async function load(){
    const sb=window.LangBlueSupabase&&window.LangBlueSupabase.getClient?window.LangBlueSupabase.getClient():null;
    if(!sb){
      setStatus('اتصال Supabase در این صفحه آماده نیست.','error');
      return;
    }

    const session=await window.LangBlueSupabase.getAuthSession();
    if(!session){
      setStatus('برای مشاهده Research Dashboard ابتدا وارد حساب مرکزی LangBlue شو.','warn');
      $('loginBtn').hidden=false;
      $('dashboard').hidden=true;
      return;
    }

    $('loginBtn').hidden=true;
    setStatus('در حال دریافت داده‌های پژوهشی…','loading');

    const {data,error}=await sb.functions.invoke('langblue-research-dashboard',{body:{}});
    if(error || !data || !data.ok){
      const code=(data&&data.error)||'DASHBOARD_LOAD_FAILED';
      if(code==='RESEARCH_ADMIN_REQUIRED'){
        setStatus('این حساب احراز هویت شده است، اما دسترسی Research Admin برای آن فعال نشده است.','warn');
      }else{
        setStatus('دریافت داده‌ها انجام نشد: '+code,'error');
      }
      $('dashboard').hidden=true;
      return;
    }

    state.data=data;
    $('dashboard').hidden=false;
    setStatus('داده‌ها با موفقیت از Supabase دریافت شد.','ok');
    $('generatedAt').textContent='آخرین به‌روزرسانی: '+fmtDate(data.generated_at);
    renderSummary(data.summary||{});
    renderFunnel(data.funnel||[]);
    renderDaily(data.daily||[]);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    $('loginBtn')?.addEventListener('click',()=>{
      if(window.LangBlueCentralAccount&&typeof window.LangBlueCentralAccount.open==='function'){
        window.LangBlueCentralAccount.open();
        setTimeout(load,1200);
      }
    });
    $('refreshBtn')?.addEventListener('click',load);
    load();
  });
})();