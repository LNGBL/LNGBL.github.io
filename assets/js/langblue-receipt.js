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
      '<div class="receipt-note">در ادامه متن آماده درخواست اشتراک نمایش داده می‌شود. ابتدا آن را کپی کن و در دایرکت تلگرام برای مدیر بفرست. شماره کارت را از مدیر دریافت کن؛ پس از پرداخت، تصویر رسید بانکی را همراه همین متن برای مدیر ارسال کن. پس از بررسی دستی، کد وریفای مخصوص درخواستت را دریافت می‌کنی.</div>'+
      '<div class="receipt-panel" id="lbReceiptSubmit" style="margin-top:16px;padding:16px;border:1px solid rgba(196,168,130,.28);border-radius:12px">'+
        '<h3>ارسال رسید برای بررسی</h3>'+
        '<input id="lbReceiptLearner" type="hidden" value=""><div id="lbReceiptLearnerChoices" class="receipt-account-choices" role="group" aria-label="انتخاب حساب مقصد"><p class="receipt-note">در حال دریافت حساب‌های مرتبط…</p></div>'+
        '<section id="lbGuardianConsentPanel" hidden style="margin-top:14px;padding:14px;border:1px solid rgba(196,168,130,.32);border-radius:10px">'+
          '<h3>رضایت والد یا سرپرست قانونی</h3>'+
          '<p class="receipt-note">برای حساب یادگیرنده‌ای که به این سرپرست متصل است، ابتدا باید والد یا سرپرستِ تأییدشده پیام صوتی رضایت یا عدم رضایت را ثبت کند. مدیر LangBlue محتوا را بررسی می‌کند. تا تأیید رضایت، پرداخت و فعال‌سازی ممکن نیست.</p>'+
          '<label for="lbGuardianFamilyName">نام خانوادگی والد/سرپرست</label><input id="lbGuardianFamilyName" type="text" maxlength="100" autocomplete="family-name" style="display:block;width:100%;margin:6px 0;padding:9px;border-radius:8px">'+
          '<label for="lbGuardianDecision">نتیجه اعلام‌شده</label><select id="lbGuardianDecision" class="receipt-select"><option value="consent">رضایت می‌دهم</option><option value="declined">رضایت نمی‌دهم</option></select>'+
          '<p id="lbGuardianStatement" class="receipt-note" style="padding:10px;background:rgba(255,255,255,.05);border-radius:8px"></p>'+
          '<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0"><input id="lbGuardianAudioNotice" type="checkbox"><span class="receipt-note">اطلاع دارم که فایل صوتی فقط برای بررسی مدیران مجاز ذخیره می‌شود؛ در صورت تأیید رضایت تا دو سال نگهداری و سپس حذف می‌شود. در صورت رد یا عدم رضایت، فایل حداکثر تا ۳۰ روز پس از تعیین وضعیت برای ثبت نتیجه نگهداری می‌شود. دسترسی عمومی یا ارسال به تلگرام انجام نمی‌شود. می‌توانم درخواست بررسی یا حذف اطلاعات را از پشتیبانی مطرح کنم.</span></label>'+
          '<div class="actions" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="lbStartGuardianRecord" type="button">شروع ضبط صدا</button><button class="btn" id="lbStopGuardianRecord" type="button" disabled>پایان ضبط</button></div>'+
          '<audio id="lbGuardianAudioPreview" controls hidden style="display:block;max-width:100%;margin-top:10px"></audio>'+
          '<button class="btn btn-primary" id="lbSubmitGuardianConsent" type="button" disabled style="margin-top:10px">ارسال صدای والد برای بررسی مدیر</button>'+
          '<p id="lbGuardianConsentStatus" class="receipt-note" role="status" aria-live="polite"></p>'+
        '</section>'+
        '<div id="lbReceiptPaymentPanel" style="margin-top:12px">'+
          '<h3>متن درخواست برای ارسال به مدیر</h3>'+
          '<pre id="lbReceiptRequestText" class="receipt-note" dir="rtl" style="white-space:pre-wrap;padding:12px;border:1px solid rgba(196,168,130,.28);border-radius:10px;background:rgba(0,0,0,.12)"></pre>'+
          '<div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">'+
            '<button class="btn" id="lbCopyRequestText" type="button">کپی متن درخواست</button>'+
            '<button class="btn btn-primary" id="lbSubmitReceipt" type="button">رفتن به دایرکت تلگرام</button>'+
          '</div>'+
          '<p class="receipt-note">در تلگرام، متن کپی‌شده را برای مدیر بفرست. شماره کارت را از او بگیر و پس از پرداخت، تصویر رسید بانکی را در همان گفت‌وگو ارسال کن.</p>'+
        '</div>'+
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
    var consentPanel=qs('lbGuardianConsentPanel');
    var paymentPanel=qs('lbReceiptPaymentPanel');
    var familyName=qs('lbGuardianFamilyName');
    var decision=qs('lbGuardianDecision');
    var notice=qs('lbGuardianAudioNotice');
    var startRecord=qs('lbStartGuardianRecord');
    var stopRecord=qs('lbStopGuardianRecord');
    var submitConsent=qs('lbSubmitGuardianConsent');
    var consentStatus=qs('lbGuardianConsentStatus');
    var statement=qs('lbGuardianStatement');
    var audioPreview=qs('lbGuardianAudioPreview');
    var recorder=null,stream=null,chunks=[],recordedBlob=null,approvedConsentId=null;
    var learnerRows=[];

    function selectedLearner(){
      return learnerRows.find(function(row){return row.user_id===select.value;})||null;
    }
    function guardianSelected(){
      var learner=selectedLearner();
      return !!learner && learner.is_self!==true;
    }
    function learnerUsername(){
      var learner=selectedLearner();
      return learner&&learner.username ? '@'+learner.username : 'حساب خودم';
    }
    function updatePaymentRequestText(){
      var host=qs('lbReceiptRequestText');
      if(!host)return;
      var learner=selectedLearner();
      var accountName=learner ? (learner.is_self ? 'حساب خودم' : (learner.name||'حساب یادگیرنده')) : 'حساب کاربری';
      host.textContent=
        'سلام. من درخواست فعال‌سازی اشتراک LangBlue را دارم.\n'+
        'شناسه درخواست: '+order.id+'\n'+
        'حساب کاربری: '+accountName+' ('+learnerUsername()+')\n'+
        'محصول(ها): '+order.products.map(function(p){return p.label;}).join('، ')+'\n'+
        'مدت اشتراک: '+order.plan.label+'\n'+
        'مبلغ قابل پرداخت: '+formatPrice(order.total)+'\n'+
        'لطفاً شماره کارت را برای واریز ارسال کنید. پس از پرداخت، تصویر رسید بانکی را در همین گفت‌وگو می‌فرستم.';
    }
    function renderLearnerChoices(){
      var host=qs('lbReceiptLearnerChoices');
      if(!host)return;
      host.innerHTML=learnerRows.map(function(row){
        var label=row.is_self?'حساب خودم':(row.name||row.username||'حساب یادگیرنده');
        if(row.username)label+=' · @'+row.username;
        return '<button type="button" class="receipt-account-choice'+(row.user_id===select.value?' is-selected':'')+'" data-learner-id="'+escapeHtml(row.user_id)+'" aria-pressed="'+(row.user_id===select.value?'true':'false')+'" style="display:block;width:100%;text-align:right;margin:6px 0;padding:11px 13px;border:1px solid '+(row.user_id===select.value?'#b89568':'rgba(196,168,130,.28)')+';border-radius:9px;background:'+(row.user_id===select.value?'rgba(184,149,104,.14)':'transparent')+';color:inherit;cursor:pointer">'+escapeHtml(label)+'</button>';
      }).join('');
    }
    function updateStatement(){
      if(!statement)return;
      var surname=(familyName&&familyName.value.trim())||'…';
      var account=learnerUsername();
      statement.textContent=decision&&decision.value==='declined'
        ? 'اینجانب '+surname+'، والد یا سرپرست قانونی حساب کاربری '+account+' در LangBlue هستم و برای استفاده از خدمات اشتراکی انتخاب‌شده برای این حساب رضایت نمی‌دهم.'
        : 'اینجانب '+surname+'، والد یا سرپرست قانونی حساب کاربری '+account+' در LangBlue هستم. برای استفاده از خدمات اشتراکی انتخاب‌شده برای این حساب رضایت خود را اعلام می‌کنم. مسئولیت صحت این اعلام و اختیار قانونی خود برای ارائه رضایت را می‌پذیرم. می‌دانم این فایل فقط برای بررسی رضایت توسط مدیر LangBlue ذخیره می‌شود و این اعلام، مسئولیت‌های قانونی LangBlue در حفاظت از اطلاعات را ساقط نمی‌کند.';
    }
    function setGuardianMode(){
      var guardian=guardianSelected();
      if(consentPanel)consentPanel.hidden=!guardian;
      if(paymentPanel)paymentPanel.hidden=guardian&&!approvedConsentId;
      if(button)button.disabled=guardian&&!approvedConsentId;
      updateStatement();
    }
    async function lookupConsent(){
      approvedConsentId=null;
      if(!guardianSelected()){
        setGuardianMode();
        if(consentStatus)consentStatus.textContent='';
        return;
      }
      setGuardianMode();
      if(consentStatus)consentStatus.textContent='در حال بررسی وضعیت رضایت ثبت‌شده…';
      try{
        var result=await client.functions.invoke('langblue-guardian-subscription-consent',{body:{
          action:'latest_status',
          learnerUserId:select.value,
          productIds:order.products.map(function(p){return p.id;}),
          planId:order.plan.id,
          amountIrt:Math.round(Number(order.total))
        }});
        if(result.error||!result.data||!result.data.ok)throw new Error(result.data&&result.data.error||'CONSENT_STATUS_FAILED');
        if(result.data.approved){
          approvedConsentId=result.data.consentId;
          if(consentStatus)consentStatus.textContent='رضایت صوتی والد توسط مدیر تأیید شده است. اکنون می‌توانید رسید پرداخت را ارسال کنید.';
          if(submitConsent)submitConsent.disabled=true;
          if(familyName)familyName.disabled=true;
          if(decision)decision.disabled=true;
          if(notice)notice.disabled=true;
          if(startRecord)startRecord.disabled=true;
        }else if(result.data.found&&result.data.reviewStatus==='pending_admin_review'){
          if(consentStatus)consentStatus.textContent='فایل صوتی ثبت شده و در انتظار بررسی مدیر است. تا زمان تأیید، امکان ارسال رسید و فعال‌سازی وجود ندارد.';
          if(submitConsent)submitConsent.disabled=true;
          if(familyName)familyName.disabled=true;
          if(decision)decision.disabled=true;
          if(notice)notice.disabled=true;
          if(startRecord)startRecord.disabled=true;
        }else if(result.data.found&&result.data.decision==='declined'){
          if(consentStatus)consentStatus.textContent='عدم رضایت ثبت شده است؛ درخواست پرداخت و فعال‌سازی برای این انتخاب انجام نمی‌شود.';
          if(submitConsent)submitConsent.disabled=true;
          if(familyName)familyName.disabled=true;
          if(decision)decision.disabled=true;
          if(notice)notice.disabled=true;
          if(startRecord)startRecord.disabled=true;
        }else if(result.data.found&&result.data.reviewStatus==='rejected'){
          if(consentStatus)consentStatus.textContent='رضایت صوتی تأیید نشد. در صورت نیاز، سرپرست می‌تواند پس از بررسی موضوع، فایل تازه‌ای ثبت کند.';
          if(submitConsent){submitConsent.disabled=true;submitConsent.textContent='ثبت رضایت تازه پس از ضبط صدا';}
          if(familyName)familyName.disabled=false;
          if(decision)decision.disabled=false;
          if(notice)notice.disabled=false;
          if(startRecord)startRecord.disabled=false;
        }else{
          if(consentStatus)consentStatus.textContent='برای این حساب یادگیرنده، ابتدا باید سرپرست رضایت خود را با پیام صوتی ثبت کند.';
        }
      }catch(e){
        if(consentStatus)consentStatus.textContent='بررسی رضایت والد ممکن نشد: '+(e.message||'خطا');
      }
      setGuardianMode();
    }

    try{
      var linked=await client.functions.invoke('langblue-subscription-requests',{body:{action:'linked_learners'}});
      if(linked.error||!linked.data||!linked.data.ok){
        var serverError=linked.data&&linked.data.error||'';
        if(!serverError&&linked.error&&linked.error.context&&typeof linked.error.context.clone==='function'){
          try{var errorBody=await linked.error.context.clone().json();serverError=errorBody&&errorBody.error||'';}catch(e){}
        }
        var choices=qs('lbReceiptLearnerChoices');
        if(choices)choices.innerHTML='<p class="receipt-note">حساب مقصد در دسترس نیست.</p>';
        status.textContent=serverError==='ADULT_VERIFICATION_REQUIRED'
          ? 'برای ادامه، باید سرپرست قانونی با حساب خودش وارد شود و تأیید سنی معتبر داشته باشد.'
          : serverError==='ORIGIN_NOT_ALLOWED'||serverError==='REQUEST_NOT_ALLOWED'
            ? 'درخواست از دامنهٔ مجاز ارسال نشده است. صفحه را از https://lngbl.github.io باز کنید.'
            : 'دریافت حساب‌ها با خطای دسترسی (403) یا خطای ارتباطی روبه‌رو شد. اگر سرپرست وارد شده، تأیید سنی و اتصال حساب‌ها باید بررسی شود.';
        button.disabled=true;
        return;
      }
      learnerRows=linked.data.learners||[];
      if(!learnerRows.length){status.textContent='حسابی برای این درخواست پیدا نشد.';button.disabled=true;return;}
      select.value=learnerRows[0].user_id;
      renderLearnerChoices();
      updatePaymentRequestText();
      var copyButton=qs('lbCopyRequestText');
      if(copyButton)copyButton.addEventListener('click',async function(){
        var requestText=qs('lbReceiptRequestText');
        if(!requestText)return;
        try{
          await navigator.clipboard.writeText(requestText.textContent);
          status.textContent='متن درخواست کپی شد. آن را در دایرکت تلگرام برای مدیر بفرست.';
        }catch(e){
          status.textContent='کپی خودکار ممکن نشد؛ متن نمایش‌داده‌شده را انتخاب و کپی کن.';
        }
      });
      var choices=qs('lbReceiptLearnerChoices');
      if(choices)choices.addEventListener('click',function(event){
        var target=event.target.closest('[data-learner-id]');
        if(!target)return;
        select.value=target.getAttribute('data-learner-id');
        renderLearnerChoices();
        updatePaymentRequestText();
        lookupConsent();
      });
      if(familyName)familyName.addEventListener('input',updateStatement);
      if(decision)decision.addEventListener('change',function(){recordedBlob=null;if(audioPreview){audioPreview.removeAttribute('src');audioPreview.hidden=true;}updateStatement();});
      updateStatement();
      await lookupConsent();
    }catch(e){
      status.textContent='اتصال به حساب مرکزی ناموفق بود.';
      button.disabled=true;
      return;
    }

    if(startRecord)startRecord.addEventListener('click',async function(){
      try{
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)
          throw new Error('ضبط صدا در این مرورگر پشتیبانی نمی‌شود.');
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        var mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':
          (MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':
          (MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':''));
        recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
        chunks=[];
        recorder.ondataavailable=function(event){if(event.data&&event.data.size)chunks.push(event.data);};
        recorder.onstop=function(){
          var type=recorder.mimeType||'audio/webm';
          recordedBlob=new Blob(chunks,{type:type});
          if(audioPreview){audioPreview.src=URL.createObjectURL(recordedBlob);audioPreview.hidden=false;}
          if(submitConsent)submitConsent.disabled=!(recordedBlob&&notice&&notice.checked&&familyName&&familyName.value.trim());
          if(stream)stream.getTracks().forEach(function(track){track.stop();});
          stream=null;
        };
        recorder.start();
        startRecord.disabled=true;
        if(stopRecord)stopRecord.disabled=false;
        if(consentStatus)consentStatus.textContent='در حال ضبط صدا… پس از خواندن متن، ضبط را متوقف کن.';
      }catch(e){
        if(consentStatus)consentStatus.textContent=e.message||'دسترسی به میکروفون ممکن نشد.';
      }
    });
    if(stopRecord)stopRecord.addEventListener('click',function(){
      if(recorder&&recorder.state!=='inactive')recorder.stop();
      if(startRecord)startRecord.disabled=false;
      stopRecord.disabled=true;
    });
    if(notice)notice.addEventListener('change',function(){
      if(submitConsent)submitConsent.disabled=!(recordedBlob&&notice.checked&&familyName&&familyName.value.trim());
    });
    if(familyName)familyName.addEventListener('input',function(){
      if(submitConsent)submitConsent.disabled=!(recordedBlob&&notice&&notice.checked&&familyName.value.trim());
    });

    if(submitConsent)submitConsent.addEventListener('click',async function(){
      submitConsent.disabled=true;
      if(!guardianSelected()){if(consentStatus)consentStatus.textContent='ابتدا حساب یادگیرنده را انتخاب کن.';return;}
      if(!familyName||!familyName.value.trim()||!notice||!notice.checked||!recordedBlob){
        if(consentStatus)consentStatus.textContent='نام خانوادگی، تأیید اطلاعیه نگهداری فایل و ضبط صدا الزامی است.';
        submitConsent.disabled=false;return;
      }
      try{
        var sessionResult=await client.auth.getSession();
        var session=sessionResult&&sessionResult.data&&sessionResult.data.session;
        if(!session)throw new Error('ابتدا وارد حساب والد/سرپرست شوید.');
        var mime=recordedBlob.type||'audio/webm';
        var ext=mime.indexOf('mp4')>=0?'m4a':mime.indexOf('ogg')>=0?'ogg':mime.indexOf('mpeg')>=0?'mp3':mime.indexOf('wav')>=0?'wav':'webm';
        var path=session.user.id+'/'+crypto.randomUUID()+'.'+ext;
        var uploaded=await client.storage.from('langblue-guardian-consent-audio').upload(path,recordedBlob,{upsert:false,contentType:mime.split(';')[0]});
        if(uploaded.error)throw new Error('بارگذاری فایل صوتی انجام نشد.');
        var submitted=await client.functions.invoke('langblue-guardian-subscription-consent',{body:{
          action:'submit',
          learnerUserId:select.value,
          productIds:order.products.map(function(p){return p.id;}),
          planId:order.plan.id,
          amountIrt:Math.round(Number(order.total)),
          decision:decision?decision.value:'consent',
          guardianFamilyName:familyName.value.trim(),
          audioPath:path,
          policyVersion:'2026-11-09-iran-v1'
        }});
        if(submitted.error||!submitted.data||!submitted.data.ok)
          throw new Error(submitted.data&&submitted.data.error||'ثبت رضایت صوتی ناموفق بود.');
        if(decision&&decision.value==='declined'){
          if(consentStatus)consentStatus.textContent='عدم رضایت والد ثبت شد. هیچ رسید پرداختی ارسال و هیچ اشتراکی فعال نمی‌شود.';
          if(paymentPanel)paymentPanel.hidden=true;
        }else{
          if(consentStatus)consentStatus.textContent='فایل صوتی برای بررسی محرمانه مدیر ارسال شد. پس از تأیید مدیر، صفحه را تازه‌سازی و وضعیت رضایت را بررسی کن؛ تا آن زمان پرداخت و فعال‌سازی انجام نمی‌شود.';
        }
        submitConsent.textContent='فایل صوتی ثبت شد';
      }catch(e){
        if(consentStatus)consentStatus.textContent=e.message||'خطا در ثبت رضایت صوتی';
        submitConsent.disabled=false;
      }
    });

    button.addEventListener('click',function(){
      if(guardianSelected()&&!approvedConsentId){
        status.textContent='برای حساب یادگیرنده، ابتدا باید رضایت سرپرست برای همین انتخاب تأیید شود.';
        return;
      }
      window.open('https://t.me/LangBlue','_blank','noopener,noreferrer');
      status.textContent='متن درخواست را در دایرکت برای مدیر بفرست، شماره کارت را دریافت کن و پس از پرداخت تصویر رسید بانکی را در همان گفت‌وگو ارسال کن. مدیر پس از بررسی پرداخت، کد وریفای مخصوص درخواست را صادر می‌کند.';
    });;
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
