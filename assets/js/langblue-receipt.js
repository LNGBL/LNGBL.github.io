/* LangBlue purchase-request slip.
   This is a non-payment request slip. It does not create or activate an entitlement.
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
  function buildId(){
    return 'LB-REQ-' + Date.now().toString(36).toUpperCase() + '-' +
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
      '<div class="receipt-summary-row receipt-summary-total"><span>مبلغ و شرایط نهایی</span><strong>پس از بررسی ادمین اعلام می‌شود</strong></div>';
  }
  function renderReceipt(){
    var output=qs('receiptOutput');
    if(!output) return;
    var order=getOrder();
    if(!order){
      alert('حداقل یک محصول را انتخاب کن.');
      return;
    }
    var requestId=buildId();
    var createdAt=Date.now();
    var productIds=order.products.map(function(p){return p.id;});
    var saved={
      id:requestId,createdAt:createdAt,planId:order.plan.id,
      productIds:productIds,requestType:'purchase_request',
      status:'pending_admin_review'
    };
    try{localStorage.setItem('lb:purchase-request:last',JSON.stringify(saved));}catch(e){}

    output.innerHTML=
      '<div class="receipt-head">'+
        '<div><strong>LangBlue</strong><br><small>فیش درخواست خرید — غیرمالی</small></div>'+
        '<div><strong>'+escapeHtml(requestId)+'</strong><br><small>'+new Date(createdAt).toLocaleString('fa-IR')+'</small></div>'+
      '</div>'+
      '<div class="receipt-line"><span>محصولات</span><strong>'+escapeHtml(order.products.map(function(p){return p.icon+' '+p.label;}).join('، '))+'</strong></div>'+
      '<div class="receipt-line"><span>مدت درخواستی</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+
      '<div class="receipt-line"><span>وضعیت</span><strong>در انتظار بررسی ادمین</strong></div>'+
      '<div class="receipt-total"><span>مبلغ نهایی</span><strong>پس از بررسی اعلام می‌شود</strong></div>'+
      '<div class="receipt-note">این فیش فقط «درخواست خرید» است؛ رسید پرداخت نیست و به معنی پرداخت، تأیید وجه یا فعال‌شدن اشتراک نیست. این صفحه هیچ وجه یا اطلاعات بانکی دریافت نمی‌کند. شناسه در این مرورگر ساخته می‌شود و تا وقتی پیام تلگرام را ارسال نکنی، ادمین از درخواست باخبر نمی‌شود. کد فعال‌سازی داخل فیش نمایش داده نمی‌شود و صدور و بررسی آن فقط از مسیر سرور انجام می‌شود.</div>';

    var share=document.createElement('a');
    share.className='btn btn-primary receipt-share';
    share.href='https://t.me/share/url?url='+encodeURIComponent('https://lngbl.github.io/')+
      '&text='+encodeURIComponent(
        'درخواست خرید LangBlue\nشناسه فیش: '+requestId+
        '\nمحصولات: '+order.products.map(function(p){return p.label;}).join('، ')+
        '\nمدت درخواستی: '+order.plan.label+
        '\nوضعیت: در انتظار بررسی ادمین'+
        '\nاین پیام درخواست است و رسید پرداخت نیست.'
      );
    share.target='_blank';
    share.rel='noopener noreferrer';
    share.textContent='ارسال شناسهٔ فیش در تلگرام';
    share.setAttribute('aria-label','ارسال شناسه فیش درخواست خرید از طریق انتخاب گفت‌وگو در تلگرام');
    output.appendChild(share);
    output.classList.add('show');
    var print=qs('printReceipt');
    if(print) print.style.display='inline-flex';
  }
  function init(){
    var build=qs('buildReceipt');
    var print=qs('printReceipt');
    if(!build) return;
    document.querySelectorAll('#receiptProducts input[type="checkbox"]').forEach(function(input){
      input.addEventListener('change',renderSummary);
    });
    if(qs('receiptPlan')) qs('receiptPlan').addEventListener('change',renderSummary);
    build.addEventListener('click',renderReceipt);
    if(print) print.addEventListener('click',function(){window.print();});
    renderSummary();
  }
  window.LangBlueReceipt={
    selectedProducts:selectedProducts,
    getOrder:getOrder,
    renderSummary:renderSummary,
    renderReceipt:renderReceipt
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})(window);
