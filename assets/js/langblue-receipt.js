/* LangBlue subscription request client.
   Requests are non-financial records. This script never accepts bank receipts,
   payment credentials, payment confirmations, or activation codes.
*/
(function(window){
  'use strict';
  function qs(id){ return document.getElementById(id); }
  function selectedProducts(){
    return Array.from(document.querySelectorAll('#receiptProducts input[type="checkbox"]:checked'))
      .map(function(input){ return input.value; });
  }
  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function getOrder(){
    var commerce=window.LangBlueCommerce;
    if(!commerce || typeof commerce.buildOrder!=='function') return null;
    var ids=selectedProducts();
    var planId=qs('receiptPlan') && qs('receiptPlan').value;
    if(!ids.length || !planId) return null;
    return commerce.buildOrder(ids,planId,new Date());
  }
  function renderSummary(){
    var box=qs('receiptSummary');
    if(!box) return;
    var order=getOrder();
    if(!order){
      box.innerHTML='<div class="receipt-summary-row"><span>وضعیت</span><strong>حداقل یک محصول را انتخاب کن.</strong></div>';
      return;
    }
    box.innerHTML=
      '<div class="receipt-summary-row"><span>محصولات انتخاب‌شده</span><strong>'+escapeHtml(order.products.map(function(p){return p.label;}).join('، '))+'</strong></div>'+
      '<div class="receipt-summary-row"><span>مدت درخواستی</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+
      '<div class="receipt-summary-row receipt-summary-total"><span>مبلغ و شرایط نهایی</span><strong>پس از بررسی اعلام می‌شود</strong></div>';
  }
  async function invoke(action,payload){
    var api=window.LangBlueSupabase;
    var sb=api&&api.getClient&&api.getClient();
    if(!sb) throw new Error('SUPABASE_CLIENT_UNAVAILABLE');
    var session=await api.getAuthSession();
    if(!session||!session.access_token) throw new Error('AUTH_REQUIRED');
    var result=await sb.functions.invoke('langblue-subscription-requests',{
      body:Object.assign({action:action},payload||{})
    });
    if(result.error && !result.data) throw result.error;
    if(!result.data || !result.data.ok) throw new Error(result.data&&result.data.error||'REQUEST_FAILED');
    return result.data;
  }
  function messageFor(error){
    var code=String(error&&error.message||error||'');
    var map={
      AUTH_REQUIRED:'ابتدا وارد حساب مرکزی LangBlue شو.',
      ADULT_VERIFICATION_REQUIRED:'برای ادامه، حساب بزرگسال باید از مسیر تأیید سن مستقل تأیید شده باشد.',
      ACTIVE_GUARDIAN_LINK_REQUIRED:'برای این یادگیرنده، پیوند فعال حساب بزرگسال در LangBlue پیدا نشد.',
      INVALID_PRODUCTS:'فهرست محصولات معتبر نیست.',
      INVALID_PLAN:'مدت انتخاب‌شده معتبر نیست.',
      REQUEST_SAVE_FAILED:'ثبت درخواست در سرور انجام نشد. کمی بعد دوباره تلاش کن.',
      SUPABASE_CLIENT_UNAVAILABLE:'ارتباط با سرور در دسترس نیست.'
    };
    return map[code]||'ثبت درخواست انجام نشد. ('+code+')';
  }
  async function loadLearners(){
    var select=qs('receiptLearnerAccount'),status=qs('receiptAccountStatus');
    if(!select) return;
    select.innerHTML='<option value="">در حال بررسی حساب بزرگسال…</option>';
    try{
      var data=await invoke('linked_learners');
      select.innerHTML='';
      (data.learners||[]).forEach(function(account){
        var option=document.createElement('option');
        option.value=account.user_id;
        option.textContent=(account.is_self?'حساب خودم':'حساب یادگیرنده')+' · '+(account.username?'@'+account.username:(account.name||account.user_id.slice(0,8)));
        select.appendChild(option);
      });
      if(!data.learners||!data.learners.length) throw new Error('NO_LINKED_LEARNERS');
      status.textContent='حساب بزرگسال تأییدشده است. برای ثبت درخواستِ یادگیرنده، پیوند فعال باید وجود داشته باشد.';
    }catch(error){
      select.innerHTML='<option value="">حساب بزرگسال تأییدشده در دسترس نیست</option>';
      status.textContent=messageFor(error);
    }
  }
  async function renderReceipt(){
    var output=qs('receiptOutput'),build=qs('buildReceipt');
    if(!output) return;
    var order=getOrder();
    if(!order){alert('حداقل یک محصول را انتخاب کن.');return;}
    var learnerId=qs('receiptLearnerAccount')&&qs('receiptLearnerAccount').value;
    if(!learnerId){alert('ابتدا حساب بزرگسالِ تأییدشده و حساب یادگیرنده را انتخاب کن.');return;}
    if(build) build.disabled=true;
    output.classList.add('show');
    output.innerHTML='<div class="receipt-note">در حال ثبت درخواست در سرور…</div>';
    try{
      var data=await invoke('create',{
        learnerUserId:learnerId,
        productIds:order.products.map(function(p){return p.id;}),
        planId:order.plan.id
      });
      var request=data.request, discount=request.discount_preview||{};
      output.innerHTML=
        '<div class="receipt-head">'+
          '<div><strong>'+escapeHtml(request.request_ref)+'</strong><br><small>'+new Date(request.created_at).toLocaleString('fa-IR')+'</small></div>'+
        '</div>'+
        '<div class="receipt-line"><span>محصولات</span><strong>'+escapeHtml(order.products.map(function(p){return p.icon+' '+p.label;}).join('، '))+'</strong></div>'+
        '<div class="receipt-line"><span>مدت درخواستی</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+
        '<div class="receipt-line"><span>وضعیت</span><strong>در انتظار بررسی ادمین</strong></div>'+
        '<div class="receipt-line receipt-summary-total"><span>مبلغ نهایی</span><strong>پس از بررسی اعلام می‌شود</strong></div>'+
        '<div class="receipt-note">این فیش فقط «درخواست خرید» است؛ رسید پرداخت نیست و به معنی پرداخت، تأیید وجه یا فعال‌شدن اشتراک نیست. این صفحه هیچ وجه یا اطلاعات بانکی دریافت نمی‌کند. شناسه درخواست در سرور ساخته و ثبت می‌شود و ادمین آن را در پنل درخواست‌ها می‌بیند؛ برای اطلاع‌رسانی سریع‌تر می‌توانی خلاصه درخواست را از طریق تلگرام ارسال کنی. کد فعال‌سازی داخل فیش نمایش داده نمی‌شود و صدور و بررسی آن فقط از مسیر سرور انجام می‌شود.</div>';
      var share=document.createElement('a');
      share.className='btn btn-primary receipt-share';
      share.href='https://t.me/share/url?url='+encodeURIComponent('https://lngbl.github.io/')+
        '&text='+encodeURIComponent(
          'درخواست اشتراک LangBlue\nشناسه: '+request.request_ref+
          '\nهش درخواست: '+request.request_hash+
          '\nحساب یادگیرنده: '+(data.learner.username?'@'+data.learner.username:data.learner.name||'حساب مرتبط')+
          '\nمحصولات: '+order.products.map(function(p){return p.label;}).join('، ')+
          '\nمدت: '+order.plan.label+
          '\nپیش‌نمایش: '+(discount.label||'بررسی شود')+
          '\nوضعیت: در انتظار بررسی ادمین'
        );
      share.target='_blank';share.rel='noopener noreferrer';share.textContent='ارسال فیش به ادمین در تلگرام';
      output.appendChild(share);
      var print=qs('printReceipt');if(print) print.style.display='inline-flex';
    }catch(error){
      output.innerHTML='<div class="receipt-note">'+escapeHtml(messageFor(error))+'</div>';
    }finally{
      if(build) build.disabled=false;
    }
  }
  function init(){
    var build=qs('buildReceipt'),print=qs('printReceipt');
    if(!build)return;
    document.querySelectorAll('#receiptProducts input[type="checkbox"]').forEach(function(input){input.addEventListener('change',renderSummary);});
    if(qs('receiptPlan'))qs('receiptPlan').addEventListener('change',renderSummary);
    build.addEventListener('click',renderReceipt);
    if(print)print.addEventListener('click',function(){window.print();});
    renderSummary();
    loadLearners();
  }
  window.LangBlueReceipt={selectedProducts:selectedProducts,getOrder:getOrder,renderSummary:renderSummary,renderReceipt:renderReceipt,loadLearners:loadLearners};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
