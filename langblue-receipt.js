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

  function renderSummary(){
    var box=qs('receiptSummary');
    if(!box) return;
    var order=getOrder();
    if(!order){
      box.innerHTML='<div class="receipt-summary-row"><span>وضعیت</span><strong>حداقل یک محصول را انتخاب کن.</strong></div>';
      return;
    }
    var discount=order.bundleDiscount || 0;
    box.innerHTML=
      '<div class="receipt-summary-row"><span>محصولات</span><strong>'+escapeHtml(order.products.map(function(p){return p.label;}).join('، '))+'</strong></div>'+\
      '<div class="receipt-summary-row"><span>مدت</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+\
      '<div class="receipt-summary-row"><span>جمع اولیه</span><strong>'+formatPrice(order.subtotal)+'</strong></div>'+\
      (discount ? '<div class="receipt-summary-row"><span>تخفیف بسته</span><strong>'+discount+'٪</strong></div>' : '')+\
      '<div class="receipt-summary-row receipt-summary-total"><span>مبلغ فیش</span><strong>'+formatPrice(order.total)+'</strong></div>';
  }

  function renderReceipt(){
    var output=qs('receiptOutput');
    if(!output) return;
    var order=getOrder();
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
        '<div><strong>LangBlue</strong><br><small>فیش درخواست اشتراک</small></div>'+\
        '<div><strong>'+escapeHtml(order.id)+'</strong><br><small>'+new Date(order.createdAt).toLocaleString('fa-IR')+'</small></div>'+\
      '</div>'+\
      order.products.map(function(p){
        return '<div class="receipt-line"><span>'+escapeHtml(p.icon+' '+p.label)+'</span><strong>'+formatPrice(order.plan.finalPrice)+'</strong></div>';
      }).join('')+\
      '<div class="receipt-line"><span>مدت اشتراک</span><strong>'+escapeHtml(order.plan.label)+'</strong></div>'+\
      (order.bundleDiscount ? '<div class="receipt-line"><span>تخفیف بسته</span><strong>'+order.bundleDiscount+'٪</strong></div>' : '')+\
      '<div class="receipt-total"><span>مبلغ کل</span><strong>'+formatPrice(order.total)+'</strong></div>'+\
      '<div class="receipt-note">این فیش «درخواست خرید» است و به معنی پرداخت یا فعال‌شدن اشتراک نیست. شناسه فیش را برای ادمین LangBlue در تلگرام ارسال کن. کد فعال‌سازی فقط از مسیر سرور صادر و بررسی می‌شود و داخل فیش نمایش داده نمی‌شود.</div>';
    output.classList.add('show');
    var print=qs('printReceipt'); if(print) print.style.display='inline-flex';
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
