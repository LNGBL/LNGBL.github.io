/* LangBlue Receipt — purchase summary, Telegram sharing and activation UI. */
(function(){
'use strict';
(function(){
  function money(n){return Number(n||0).toLocaleString('en-US')+' T';}
  function selected(){
    return Array.from(document.querySelectorAll('#receiptProducts input:checked')).map(function(x){return x.value;});
  }
  function plan(){
    return document.getElementById('receiptPlan').value;
  }
  function renderSummary(){
    var ids=selected(), planId=plan(), p=window.LangBlueCommerce.displayPlan(planId);
    var box=document.getElementById('receiptSummary');
    if(!ids.length){
      box.innerHTML='<div style="color:#ffb6b6">حداقل یک محصول را انتخاب کن.</div>';
      return;
    }
    var subtotal=p.finalPrice*ids.length;
    var isBundle=window.LangBlueCommerce.isAllProducts12M?window.LangBlueCommerce.isAllProducts12M(ids,planId):(planId==='irt_12m'&&ids.length===3);
    var bundleDiscount=isBundle?(window.LangBlueCommerce.ALL_PRODUCTS_12M_DISCOUNT||15):0;
    var total=window.LangBlueCommerce.discountedPrice(subtotal,bundleDiscount);
    var discount=p.discount?p.discount+'٪ تخفیف جشنواره‌ای':''; 
    box.innerHTML='<div class="receipt-summary-row"><span>تعداد محصولات</span><strong>'+ids.length+'</strong></div>'+
      '<div class="receipt-summary-row"><span>قیمت پایه هر محصول</span><strong>'+money(p.finalPrice)+'</strong></div>'+
      (discount?'<div class="receipt-summary-row"><span>تخفیف جشنواره</span><strong>'+discount+'</strong></div>':'')+
      (bundleDiscount?'<div class="receipt-summary-row"><span>تخفیف بسته کامل ۱۲ ماهه</span><strong>'+bundleDiscount+'٪</strong></div>':'')+
      '<div class="receipt-summary-row receipt-summary-total"><span>مبلغ نهایی</span><strong>'+money(total)+'</strong></div>';
  }
  function build(){
    var ids=selected(), out=document.getElementById('receiptOutput');
    if(!ids.length){renderSummary();return;}
    var order=window.LangBlueCommerce.buildOrder(ids,plan());
    var date=new Date(order.createdAt).toLocaleString('fa-IR');
    out.innerHTML='<div class="receipt-head"><div><strong>LangBlue</strong><br><small>فیش سفارش</small></div><div><small>شماره فیش: '+order.id+'<br>'+date+'</small></div></div>'+
      order.products.map(function(p){return '<div class="receipt-line"><span>'+p.icon+' '+p.label+'</span><strong>'+money(order.plan.finalPrice)+'</strong></div>';}).join('')+
      '<div class="receipt-line"><span>پلن</span><strong>'+order.plan.label+'</strong></div>'+
      (order.plan.festival?'<div class="receipt-line"><span>تخفیف '+order.plan.festival.title+'</span><strong>'+order.plan.discount+'٪</strong></div>':'')+
      (order.bundleDiscount?'<div class="receipt-line"><span>تخفیف بسته کامل ۱۲ ماهه</span><strong>'+order.bundleDiscount+'٪</strong></div>':'')+
      '<div class="receipt-total"><span>مبلغ نهایی</span><span>'+order.totalStr+'</span></div>'+
      '<div class="receipt-note">'+((order.plan.days===7||order.plan.days===14||order.plan.days===21)?'کد وریفای پلن‌های روزانه در فیش نمایش داده می‌شود.':'کد وریفای پلن‌های ماهانه برای کاربر نمایش داده نمی‌شود و پس از بررسی سفارش توسط مدیریت صادر می‌شود.')+'</div>'+
      '<div class="receipt-actions"><button id="sendReceiptTelegram" class="btn btn-primary" type="button">📨 ارسال سفارش به تلگرام</button><button id="activateReceiptPlan" class="btn btn-secondary" type="button">🔑 فعال‌سازی پلن‌ها</button></div>';
    out.classList.add('show');
    document.getElementById('printReceipt').style.display='inline-flex';
    var telegramText='درخواست خرید LangBlue\nشماره فیش: '+order.id+'\nمحصولات: '+order.products.map(function(p){return p.label;}).join('، ')+'\nپلن: '+order.plan.label+'\n'+(order.plan.festival?'تخفیف فستیوال: '+order.plan.discount+'٪\n':'')+(order.bundleDiscount?'تخفیف بسته کامل ۱۲ ماهه: '+order.bundleDiscount+'٪\n':'')+'مبلغ نهایی: '+order.totalStr+'\nلطفاً سفارش را بررسی و کد وریفای را ارسال کنید.';
    document.getElementById('sendReceiptTelegram').addEventListener('click',function(){
      var url='https://t.me/share/url?url='+encodeURIComponent('https://lngbl.github.io/')+'&text='+encodeURIComponent(telegramText);
      window.open(url,'_blank','noopener,noreferrer');
    });
    document.getElementById('activateReceiptPlan').addEventListener('click',function(){
      var ids=selected();
      if(!window.LangBlueCore.session()){
        var go=confirm('برای فعال‌سازی باید حساب LangBlue داشته باشی. اگر حساب نداری، ثبت‌نام کن و بعد به این صفحه برگرد.\n\nرفتن به صفحه حساب؟');
        if(go) window.location.href='LangBlue-grammer.html#accountGate';
        return;
      }
      var code=window.prompt('کد فعال‌سازی را وارد کن:');
      if(!code)return;
      var result=window.LangBlueCore.subscription.activate(code,ids);
      if(!result.ok){alert('❌ '+result.error);return;}
      var sub=result.subscription||window.LangBlueCore.subscription.current();
      alert('✅ پلن «'+result.plan.label+'» برای '+ids.length+' محصول انتخاب‌شده فعال شد.\n\nمحصولات: '+ids.map(function(id){return window.LangBlueCommerce.PRODUCTS[id].label;}).join('، '));
      window.dispatchEvent(new StorageEvent('storage',{key:'lb:user:'+window.LangBlueCore.userId()+':subscription',newValue:JSON.stringify(sub)}));
    });
    out.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  document.querySelectorAll('#receiptProducts input').forEach(function(x){x.addEventListener('change',renderSummary);});
  document.getElementById('receiptPlan').addEventListener('change',renderSummary);
  document.getElementById('buildReceipt').addEventListener('click',build);
  document.getElementById('printReceipt').addEventListener('click',function(){window.print();});
  renderSummary();
})();

})();
