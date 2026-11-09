/* LangBlue Landing Receipt Builder
   Purchase-request receipt only. Activation is handled by Supabase Edge Functions.
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
  function formatPrice(value){
    return Number(value || 0).toLocaleString('en-US') + ' T';
  }
  function buildId(){
    return 'LB-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).slice(2,7).toUpperCase();
  }

  function getOrder(){
    var commerce=window.LangBlueCommerce;
    if(!commerce || typeof commerce.buildOrder!=='function') return null;
    var ids=selectedProducts();
    var planId=qs('receiptPlan') && qs('receiptPlan').value;
    if(!ids.length || !planId) return null;
    return commerce.buildOrder(ids,planId,new Date());
  }

  async function getDiscountedOrder(){
    var order=getOrder();
    if(!order) return null;
    var client=window.LangBlueSupabase&&window.LangBlueSupabase.getClient?window.LangBlueSupabase.getClient():null;
    if(!client) return order;
    try{
      var result=await client.functions.invoke('langblue-community-access',{body:{action:'status'}});
      var request=result&&result.data&&result.data.request;
      if(!result.error&&request&&request.status==='approved'&&request.discount_active===true){
        var originalSubtotal=order.subtotal;
        order.originalSubtotal=originalSubtotal;
        order.plan=Object.assign({},order.plan);
        order.plan.finalPrice=Math.round(Number(order.plan.finalPrice)*0.9);
        order.plan.finalPriceStr=formatPrice(order.plan.finalPrice);
        order.subtotal=order.plan.finalPrice*order.quantity;
        order.communityDiscount=10;
        order.communityDiscountAmount=originalSubtotal-order.subtotal;
        order.total=Math.round(order.subtotal*(100-(order.bundleDiscount||0))/100);
        order.totalStr=formatPrice(order.total);
      }
    }catch(e){console.warn('[LangBlue] community discount status unavailable',e)}
    return order;
  }

  async function renderSummary(){
    var box=qs('receiptSummary');
    if(!box) return;
    var order=await getDiscountedOrder();
    if(!order){
      box.innerHTML='<div class="receipt-summary-row"><span>وضعیت</span><strong>حداقل یک محصول را انتخاب کن.</strong></div>';
      return;
    }
    var discount=order.bundleDiscount || 0;
    box.innerHTML=
      '<div class="receipt-summary-row"><span>محصولات</span><strong>'+escapeHtml(order.products.map(function(p){return p.label;}).join('، '))+'</strong></div>'+
      '<div class="receipt-summary-row"><span>مدت</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+
      '<div class="receipt-summary-row"><span>جمع اولیه</span><strong>'+formatPrice(order.communityDiscount?order.originalSubtotal:order.subtotal)+'</strong></div>'+
      (order.communityDiscount ? '<div class="receipt-summary-row"><span>تخفیف اجتماعی</span><strong>'+order.communityDiscount+'٪ (−'+formatPrice(order.communityDiscountAmount)+')</strong></div>' : '')+
      (discount ? '<div class="receipt-summary-row"><span>تخفیف بسته</span><strong>'+discount+'٪</strong></div>' : '')+
      '<div class="receipt-summary-row receipt-summary-total"><span>مبلغ فیش</span><strong>'+formatPrice(order.total)+'</strong></div>';
  }

  async function renderReceipt(){
    var output=qs('receiptOutput');
    if(!output) return;
    var order=await getDiscountedOrder();
    if(!order){
      alert('حداقل یک محصول را انتخاب کن.');
      return;
    }
    if(!order.id) order.id=buildId();
    var saved={
      id:order.id, createdAt:order.createdAt, planId:order.plan.id,
      productIds:order.products.map(function(p){return p.id;}),
      total:order.total
    };
    try{ localStorage.setItem('lb:receipt:last',JSON.stringify(saved)); }catch(e){}

    output.innerHTML=
      '<div class="receipt-head">'+
        '<div><strong>LangBlue</strong><br><small>فیش درخواست اشتراک</small></div>'+
        '<div><strong>'+escapeHtml(order.id)+'</strong><br><small>'+new Date(order.createdAt).toLocaleString('fa-IR')+'</small></div>'+
      '</div>'+
      order.products.map(function(p){
        return '<div class="receipt-line"><span>'+escapeHtml(p.icon+' '+p.label)+'</span><strong>'+formatPrice(order.plan.finalPrice)+'</strong></div>';
      }).join('')+
      '<div class="receipt-line"><span>مدت اشتراک</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+
      (order.communityDiscount ? '<div class="receipt-line"><span>تخفیف اجتماعی</span><strong>'+order.communityDiscount+'٪ (−'+formatPrice(order.communityDiscountAmount)+')</strong></div>' : '')+
      (order.bundleDiscount ? '<div class="receipt-line"><span>تخفیف بسته</span><strong>'+order.bundleDiscount+'٪</strong></div>' : '')+
      '<div class="receipt-total"><span>مبلغ کل</span><strong>'+formatPrice(order.total)+'</strong></div>'+
      '<div class="receipt-note">برای بررسی پرداخت، تصویر رسید را از همین بخش ارسال کن. پس از تأیید مدیر، اشتراک مستقیماً روی حساب یادگیرنده فعال می‌شود و نیازی به کد وریفای نیست. شمارهٔ کامل کارت بانکی درخواست یا ذخیره نمی‌شود.</div>'+
      '<div class="receipt-panel" id="lbReceiptSubmit" style="margin-top:16px;padding:16px;border:1px solid rgba(196,168,130,.28);border-radius:12px">'+
        '<h3>ارسال رسید برای بررسی</h3>'+
        '<label for="lbReceiptLearner">حساب یادگیرنده</label><select id="lbReceiptLearner" class="receipt-select"><option value="">در حال دریافت حساب‌ها…</option></select>'+
        '<label for="lbReceiptFile" style="display:block;margin-top:10px">تصویر رسید (JPG، PNG یا WebP؛ حداکثر ۵ مگابایت)</label><input id="lbReceiptFile" type="file" accept="image/jpeg,image/png,image/webp" style="display:block;margin:8px 0">'+
        '<div class="receipt-note">مبلغ اعلام‌شده: '+formatPrice(order.total)+' · مدیر مبلغ و تصویر رسید را پیش از فعال‌سازی تطبیق می‌دهد.</div>'+
        '<button class="btn btn-primary" id="lbSubmitReceipt" type="button">ارسال رسید و ثبت درخواست</button>'+
        '<p id="lbReceiptSubmitStatus" class="receipt-note" role="status" aria-live="polite"></p>'+
      '</div>';
    output.classList.add('show');
    var print=qs('printReceipt'); if(print) print.style.display='inline-flex';
    setupReceiptSubmission(order);
  }

  async function setupReceiptSubmission(order){
    var client=window.LangBlueSupabase&&window.LangBlueSupabase.getClient?window.LangBlueSupabase.getClient():null;
    var select=qs('lbReceiptLearner'),button=qs('lbSubmitReceipt'),status=qs('lbReceiptSubmitStatus');
    if(!client||!select||!button||!status)return;
    try{
      var linked=await client.functions.invoke('langblue-subscription-requests',{body:{action:'linked_learners'}});
      if(linked.error||!linked.data||!linked.data.ok){
        select.innerHTML='<option value="">حساب سرپرست تأییدشده لازم است</option>';
        status.textContent=linked.data&&linked.data.error==='ADULT_VERIFICATION_REQUIRED'
          ? 'برای ثبت درخواست، سرپرستِ دارای تأیید سنی باید وارد حساب شود.'
          : 'دریافت حساب‌های مجاز ممکن نشد: '+(linked.data&&linked.data.error||'خطا');
        button.disabled=true;
        return;
      }
      select.innerHTML=(linked.data.learners||[]).map(function(x){
        var label=x.is_self?'حساب خودم':(x.name||x.username||'حساب یادگیرنده');
        if(x.username)label+=' · @'+x.username;
        return '<option value="'+escapeHtml(x.user_id)+'">'+escapeHtml(label)+'</option>';
      }).join('');
      if(!select.options.length){status.textContent='حساب یادگیرندهٔ مجازی برای این سرپرست پیدا نشد.';button.disabled=true;return;}
    }catch(e){
      status.textContent='اتصال به حساب مرکزی ناموفق بود.';
      button.disabled=true;
      return;
    }
    button.addEventListener('click',async function(){
      button.disabled=true;
      status.textContent='در حال بارگذاری و ثبت رسید…';
      try{
        var sessionResult=await client.auth.getSession();
        var session=sessionResult&&sessionResult.data&&sessionResult.data.session;
        if(!session)throw new Error('ابتدا وارد حساب مرکزی شوید.');
        var file=qs('lbReceiptFile')&&qs('lbReceiptFile').files[0];
        if(!file)throw new Error('تصویر رسید را انتخاب کنید.');
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)
          throw new Error('فقط تصویر JPG، PNG یا WebP تا سقف ۵ مگابایت پذیرفته می‌شود.');
        var ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
        var path=session.user.id+'/'+crypto.randomUUID()+'.'+ext;
        var uploaded=await client.storage.from('langblue-payment-receipts').upload(path,file,{upsert:false,contentType:file.type});
        if(uploaded.error)throw new Error('بارگذاری تصویر رسید انجام نشد.');
        var created=await client.functions.invoke('langblue-subscription-requests',{body:{
          action:'create',
          learnerUserId:select.value,
          productIds:order.products.map(function(p){return p.id;}),
          planId:order.plan.id,
          receiptPath:path,
          amountIrt:Math.round(Number(order.total))
        }});
        if(created.error||!created.data||!created.data.ok)
          throw new Error(created.data&&created.data.error==='ADULT_VERIFICATION_REQUIRED'
            ? 'ثبت درخواست باید توسط سرپرستِ دارای تأیید سنی انجام شود.'
            : created.data&&created.data.error||'ثبت درخواست ناموفق بود.');
        status.textContent='رسید ثبت شد. شناسه پیگیری: '+(created.data.request.request_ref||'ثبت‌شده')+' · پس از تأیید مدیر، اشتراک مستقیماً فعال می‌شود.';
        button.textContent='رسید ثبت شد';
      }catch(e){
        status.textContent=e.message||'خطا در ثبت رسید';
        button.disabled=false;
      }
    });
  }

  function init(){
    var build=qs('buildReceipt');
    var print=qs('printReceipt');
    if(!build) return;
    document.querySelectorAll('#receiptProducts input[type="checkbox"]').forEach(function(input){input.addEventListener('change',renderSummary);});
    if(qs('receiptPlan')) qs('receiptPlan').addEventListener('change',renderSummary);
    build.addEventListener('click',renderReceipt);
    if(print) print.addEventListener('click',function(){window.print();});
    renderSummary();
  }

  window.LangBlueReceipt={selectedProducts:selectedProducts,getOrder:getOrder,renderSummary:renderSummary,renderReceipt:renderReceipt};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})(window);
