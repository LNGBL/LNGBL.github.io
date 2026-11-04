/* LangBlue Premium payment receipt flow. */
(function(window){
  'use strict';
  var BUCKET='langblue-payment-receipts';
  function qs(id){return document.getElementById(id);}
  function selectedProducts(){
    return Array.from(document.querySelectorAll('#receiptProducts input[type="checkbox"]:checked')).map(function(x){return x.value;});
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function money(v){return Number(v||0).toLocaleString('fa-IR')+' تومان';}
  function getOrder(){
    var commerce=window.LangBlueCommerce;
    if(!commerce||typeof commerce.buildOrder!=='function')return null;
    var ids=selectedProducts(),plan=qs('receiptPlan')&&qs('receiptPlan').value;
    if(!ids.length||!plan)return null;
    return commerce.buildOrder(ids,plan,new Date());
  }
  function renderSummary(){
    var box=qs('receiptSummary');if(!box)return;
    var order=getOrder();
    box.innerHTML=order
      ? '<div class="receipt-summary-row"><span>محصولات</span><strong>'+esc(order.products.map(function(p){return p.label;}).join('، '))+'</strong></div><div class="receipt-summary-row"><span>مدت</span><strong>'+esc(order.plan.label)+'</strong></div><div class="receipt-summary-row"><span>مبلغ</span><strong>پس از ثبت، مبلغ قطعی از سرور نمایش داده می‌شود</strong></div>'
      : '<div class="receipt-summary-row"><span>وضعیت</span><strong>حداقل یک محصول و مدت اشتراک را انتخاب کن.</strong></div>';
  }
  async function client(){
    var api=window.LangBlueSupabase,sb=api&&api.getClient&&api.getClient();
    if(!sb)throw new Error('SUPABASE_CLIENT_UNAVAILABLE');
    var session=await api.getAuthSession();
    if(!session||!session.access_token)throw new Error('AUTH_REQUIRED');
    return sb;
  }
  async function invoke(action,payload){
    var sb=await client();
    var result=await sb.functions.invoke('langblue-subscription-requests',{body:Object.assign({action:action},payload||{})});
    if(result.error&&!result.data)throw result.error;
    if(!result.data||!result.data.ok)throw new Error(result.data&&result.data.error||'REQUEST_FAILED');
    return result.data;
  }
  function message(error){
    var code=String(error&&error.message||error||'');
    var map={
      AUTH_REQUIRED:'ابتدا وارد حساب LangBlue شو.',
      ADULT_VERIFICATION_REQUIRED:'برای این عملیات، تأیید بزرگسال لازم است.',
      ACTIVE_GUARDIAN_LINK_REQUIRED:'پیوند فعال حساب بزرگسال با حساب یادگیرنده پیدا نشد.',
      INVALID_PRODUCTS:'محصولات انتخاب‌شده معتبر نیستند.',
      INVALID_PLAN:'مدت اشتراک معتبر نیست.',
      PLAN_UNAVAILABLE:'این پلن در حال حاضر فعال نیست.',
      REQUEST_SAVE_FAILED:'ثبت درخواست انجام نشد.',
      RECEIPT_UPLOAD_URL_FAILED:'ساخت لینک امن بارگذاری رسید انجام نشد.',
      SUPABASE_CLIENT_UNAVAILABLE:'ارتباط با سرور در دسترس نیست.'
    };
    return map[code]||'عملیات انجام نشد: '+code;
  }
  async function loadLearners(){
    var select=qs('receiptLearnerAccount'),status=qs('receiptAccountStatus');if(!select)return;
    select.innerHTML='<option value="">در حال بررسی حساب…</option>';
    try{
      var data=await invoke('linked_learners');
      select.innerHTML='';
      (data.learners||[]).forEach(function(a){
        var o=document.createElement('option');o.value=a.user_id;
        o.textContent=(a.is_self?'حساب خودم':'حساب یادگیرنده')+' · '+(a.username?'@'+a.username:(a.name||a.user_id.slice(0,8)));
        select.appendChild(o);
      });
      if(!data.learners||!data.learners.length)throw new Error('NO_LINKED_LEARNERS');
      status.textContent='حساب برای ثبت درخواست آماده است.';
    }catch(e){
      select.innerHTML='<option value="">حساب مجاز در دسترس نیست</option>';
      status.textContent=message(e);
    }
  }
  async function submit(){
    var output=qs('receiptOutput'),button=qs('buildReceipt'),fileInput=qs('receiptImage');
    var order=getOrder(),file=fileInput&&fileInput.files&&fileInput.files[0];
    if(!order){alert('محصول و مدت اشتراک را انتخاب کن.');return;}
    if(!file){alert('تصویر رسید واریز را انتخاب کن.');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){alert('فقط تصویر JPG، PNG یا WebP تا ۵ مگابایت مجاز است.');return;}
    var learnerId=qs('receiptLearnerAccount')&&qs('receiptLearnerAccount').value;
    if(!learnerId){alert('حساب یادگیرنده را انتخاب کن.');return;}
    button.disabled=true;output.classList.add('show');output.innerHTML='<div class="receipt-note">در حال ثبت درخواست و بارگذاری امن رسید…</div>';
    try{
      var data=await invoke('create',{learnerUserId:learnerId,productIds:order.products.map(function(p){return p.id;}),planId:order.plan.id,receiptMime:file.type});
      var sb=await client();
      var upload=await sb.storage.from(BUCKET).uploadToSignedUrl(data.upload.path,data.upload.token,file,{contentType:file.type,upsert:false});
      if(upload.error)throw new Error('RECEIPT_UPLOAD_FAILED');
      var req=data.request;
      output.innerHTML='<div class="receipt-head"><strong>'+esc(req.request_ref)+'</strong><small>ثبت شده</small></div>'+
        '<div class="receipt-line"><span>محصولات</span><strong>'+esc(order.products.map(function(p){return p.label;}).join('، '))+'</strong></div>'+
        '<div class="receipt-line"><span>مدت</span><strong>'+esc(order.plan.label)+'</strong></div>'+
        '<div class="receipt-line"><span>مبلغ قابل پرداخت</span><strong>'+money(req.amount_irt)+'</strong></div>'+
        '<div class="receipt-line"><span>رسید</span><strong>بارگذاری شد</strong></div>'+
        '<div class="receipt-line"><span>وضعیت</span><strong>در انتظار تأیید ادمین</strong></div>'+
        '<p class="receipt-note">رسید با موفقیت در فضای خصوصی ذخیره شد. پس از بررسی و تأیید واریز، اشتراک Premium مستقیماً روی حساب انتخاب‌شده فعال می‌شود. تا پیش از تأیید ادمین، دسترسی Premium فعال نیست.</p>';
      var refresh=document.createElement('button');refresh.type='button';refresh.className='btn btn-secondary';refresh.textContent='بررسی وضعیت درخواست';
      refresh.addEventListener('click',async function(){
        refresh.disabled=true;
        try{
          var history=await invoke('my_requests');
          var current=(history.requests||[]).find(function(x){return x.request_ref===req.request_ref;});
          var labels={pending_admin_review:'در انتظار تأیید ادمین',needs_info:'نیازمند بررسی بیشتر',approved:'تأیید شد؛ Premium فعال است',rejected:'پرداخت تأیید نشد',reviewed:'بررسی‌شده',closed:'بسته‌شده'};
          var status=output.querySelector('[data-live-status]');
          if(status)status.textContent=current?(labels[current.status]||current.status)+(current.admin_note?' · '+current.admin_note:''):'درخواست پیدا نشد.';
        }catch(e){var status=output.querySelector('[data-live-status]');if(status)status.textContent=message(e);}
        finally{refresh.disabled=false;}
      });
      var statusLine=document.createElement('div');statusLine.className='receipt-line';statusLine.innerHTML='<span>آخرین وضعیت</span><strong data-live-status>در انتظار تأیید ادمین</strong>';
      output.appendChild(statusLine);output.appendChild(refresh);
    }catch(e){
      output.innerHTML='<div class="receipt-note">'+esc(message(e))+(String(e.message)==='RECEIPT_UPLOAD_FAILED'?' درخواست ثبت شده، اما بارگذاری رسید ناموفق بود؛ با پشتیبانی تماس بگیر.':'')+'</div>';
    }finally{button.disabled=false;}
  }
  function init(){
    var button=qs('buildReceipt');if(!button)return;
    document.querySelectorAll('#receiptProducts input[type="checkbox"]').forEach(function(x){x.addEventListener('change',renderSummary);});
    if(qs('receiptPlan'))qs('receiptPlan').addEventListener('change',renderSummary);
    button.addEventListener('click',submit);renderSummary();loadLearners();
  }
  window.LangBlueReceipt={selectedProducts:selectedProducts,getOrder:getOrder,renderSummary:renderSummary,submit:submit,loadLearners:loadLearners};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
