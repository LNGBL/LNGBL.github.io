/* LangBlue Landing Events — ceremonies, occasion UI and notification wiring. */
(function(){
'use strict';

(function(){
  const WIKI={
    cyrus:'https://en.wikipedia.org/wiki/Cyrus_the_Great_Day',
    amordadgan:'https://en.wikipedia.org/wiki/Amordadegan_festival',
    yalda:'https://en.wikipedia.org/wiki/Yalda_Night',
    islamic:'https://en.wikipedia.org/wiki/Islamic_holidays',
    fitr:'https://en.wikipedia.org/wiki/Eid_al-Fitr',
    adha:'https://en.wikipedia.org/wiki/Eid_al-Adha',
    ghadir:'https://en.wikipedia.org/wiki/Eid_al-Ghadir',
    christmas:'https://en.wikipedia.org/wiki/Christmas',
    blackfriday:'https://en.wikipedia.org/wiki/Black_Friday_(shopping)',
    halloween:'https://en.wikipedia.org/wiki/Halloween',
    women:'https://en.wikipedia.org/wiki/International_Women%27s_Day',
    men:'https://en.wikipedia.org/wiki/International_Men%27s_Day',
    valentine:'https://en.wikipedia.org/wiki/Valentine%27s_Day'
  };

  // Ceremony data is intentionally hidden from the landing page.
  // The system announces a ceremony only when its date arrives.
  const iranSolar=[
    {key:'cyrus',title:'👑 روز کوروش بزرگ',when:j=>j.month===8&&j.day===7},
    {key:'amordadgan',title:'🌿 امردادگان',when:j=>j.month===5&&j.day===7},
    {key:'deygan',title:'☀️ دیگان (خرم‌روز)',when:j=>j.month===10&&j.day===1},
    {key:'yalda',title:'🍉 یلدا',when:j=>j.month===9&&j.day===30}
  ];

  const iranIslamic=[
    {key:'fitr',title:'🌙 عید فطر',when:i=>i.month===10&&i.day===1},
    {key:'adha',title:'🐑 عید قربان',when:i=>i.month===12&&i.day===10},
    {key:'ghadir',title:'🕊️ عید غدیر',when:i=>i.month===12&&i.day===18}
  ];

  const global=[
    {key:'christmas',title:'🎄 Christmas',when:d=>d.getMonth()===11&&d.getDate()===25},
    {key:'blackfriday',title:'🛍️ Black Friday',when:d=>d.getMonth()===10&&d.getDate()===20},
    {key:'halloween',title:'🎃 Halloween',when:d=>d.getMonth()===9&&d.getDate()===31},
    {key:'men',title:'♂️ International Men’s Day',when:d=>d.getMonth()===10&&d.getDate()===19},
    {key:'women',title:'♀️ International Women’s Day',when:d=>d.getMonth()===2&&d.getDate()===8},
    {key:'valentine',title:'❤️ Valentine’s Day',when:d=>d.getMonth()===1&&d.getDate()===14}
  ];

  function jalali(d){
    const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d);
    const get=t=>Number(p.find(x=>x.type===t)?.value||0);
    return {year:get('year'),month:get('month'),day:get('day')};
  }

  function islamic(d){
    try{
      const p=new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura',{month:'numeric',day:'numeric'}).formatToParts(d);
      const get=t=>Number(p.find(x=>x.type===t)?.value||0);
      const month=get('month'),day=get('day');
      if(month&&day)return {month,day};
    }catch(e){}
    return null;
  }

  function ceremonyKey(e,d){
    const j=jalali(d),i=islamic(d);
    return e.key+':'+j.year+':'+j.month+':'+j.day+':'+(i?i.month+'-'+i.day:'-');
  }

  async function requestCeremonyPermission(){
    if(!('Notification' in window)){
      setCeremonyStatus('این مرورگر اعلان سیستمی را پشتیبانی نمی‌کند.');
      return false;
    }
    if(Notification.permission==='granted') return true;
    if(Notification.permission==='denied'){
      setCeremonyStatus('اعلان‌ها در مرورگر مسدود شده‌اند.');
      return false;
    }
    const permission=await Notification.requestPermission();
    setCeremonyStatus(permission==='granted'?'🔔 اعلان مناسبت‌ها فعال شد.':'اعلان مناسبت‌ها فعال نشد.');
    return permission==='granted';
  }

  function setCeremonyStatus(text){
    const el=document.getElementById('ceremonyStatus');
    if(el)el.textContent=text;
  }

  async function playCeremony(e,d,force=false){
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    const key=ceremonyKey(e,d);
    const storeKey='lb:ceremony:last';
    if(!force && localStorage.getItem(storeKey)===key)return;
    localStorage.setItem(storeKey,key);

    const options={
      body:'امروز زمان این مناسبت در LangBlue است.',
      tag:'langblue-ceremony-'+e.key,
      renotify:true,
      icon:'/favicon.svg',
      dir:'rtl',
      lang:'fa'
    };

    try{
      if(navigator.serviceWorker?.controller){
        const reg=await navigator.serviceWorker.getRegistration();
        if(reg) return await reg.showNotification('🔷 LangBlue · '+e.title,options);
      }
    }catch(err){}

    try{
      new Notification('🔷 LangBlue · '+e.title,options);
    }catch(err){}
  }

  async function checkCeremonies(now=new Date(),force=false){
    const j=jalali(now),i=islamic(now);
    const found=[
      ...iranSolar.filter(e=>e.when(j)),
      ...(i?iranIslamic.filter(e=>e.when(i)):[]),
      ...global.filter(e=>e.when(now))
    ];
    for(const e of found) await playCeremony(e,now,force);
  }

  function setupCeremonies(){
    const btn=document.getElementById('enableCeremonies');
    if(!btn)return;
    if('Notification' in window && Notification.permission==='granted'){
      btn.textContent='🔔 اعلان مناسبت‌ها فعال است';
      setCeremonyStatus('هر مناسبت در زمان خودش اعلام می‌شود.');
    }
    btn.addEventListener('click',async()=>{
      const ok=await requestCeremonyPermission();
      if(ok){
        btn.textContent='🔔 اعلان مناسبت‌ها فعال است';
        await checkCeremonies(new Date());
      }
    });

    // Check at load and at every minute while the page is open.
    checkCeremonies(new Date());
    setInterval(()=>checkCeremonies(new Date()),60000);
  }

  function typeText(el,text){
    el.innerHTML='';
    [...text].forEach((ch,i)=>{
      const s=document.createElement('span');
      s.textContent=ch;s.style.opacity='0';s.style.display='inline-block';s.style.transform='translateY(8px)';
      s.style.transition='opacity .28s ease,transform .28s ease';s.style.transitionDelay=(i*25)+'ms';
      el.appendChild(s);requestAnimationFrame(()=>{s.style.opacity='1';s.style.transform='translateY(0)'});
    });
  }

  function row(e,active=false){
    const shared=window.LangBlueCommerce&&window.LangBlueCommerce.FESTIVALS.find(x=>x.key===e.key);
    const wiki=WIKI[e.key] || '#';
    const date=e.date || '';
    const discount=shared?shared.discount:0;
    const badge=discount?'<span class="event-badge">'+discount+'٪ تخفیف</span>':'';
    return '<div class="event-row'+(active?' active':'')+'"><div class="event-main"><a class="event-name" href="'+wiki+'" target="_blank" rel="noopener noreferrer">'+e.title+'</a><span class="event-date">'+date+'</span></div>'+badge+'</div>';
  }

  function renderLists(now){
    const iranEl=document.getElementById('iranOccasions');
    const globalEl=document.getElementById('globalOccasions');
    if(!iranEl && !globalEl) return;
    const j=jalali(now), i=islamic(now);
    const iran=[...iranSolar,...iranIslamic];
    if(iranEl) iranEl.innerHTML=iran.map(e=>row(e,(e.when(j)||!!(i&&e.when(i))))).join('');
    if(globalEl) globalEl.innerHTML=global.map(e=>row(e,e.when(now))).join('');
  }

  function renderCurrent(now){
    const box=document.getElementById('occasionBanner');if(!box)return;
    const j=jalali(now),i=islamic(now);
    const e=iranSolar.find(x=>x.when(j)) || (i&&iranIslamic.find(x=>x.when(i))) || global.find(x=>x.when(now));
    document.body.classList.remove('theme-halloween','theme-yalda','theme-christmas','theme-valentine','theme-women','theme-men');
    if(!e){
      box.innerHTML='<div class="occasion-title">🔷 LangBlue</div><div class="occasion-note">مناسبت‌ها به‌صورت خودکار و در زمان خودشان اعلام می‌شوند.</div>';
      return;
    }
    if(e.key==='halloween')document.body.classList.add('theme-halloween');
    if(e.key==='yalda')document.body.classList.add('theme-yalda');
    if(e.key==='christmas')document.body.classList.add('theme-christmas');
    if(e.key==='valentine')document.body.classList.add('theme-valentine');
    if(e.key==='women')document.body.classList.add('theme-women');
    if(e.key==='men')document.body.classList.add('theme-men');
    const shared=window.LangBlueCommerce&&window.LangBlueCommerce.activeFestival(now);
    box.innerHTML='<div class="occasion-title"></div><div class="occasion-note"></div><div class="occasion-discount"></div>';
    typeText(box.querySelector('.occasion-title'),e.title);
    box.querySelector('.occasion-note').textContent='امروز زمان این مناسبت است — اعلان LangBlue آماده است.';
    const discountEl=box.querySelector('.occasion-discount');
    if(discountEl&&shared){discountEl.textContent=shared.discount+'٪ تخفیف جشنواره‌ای برای هر سه محصول';}
  }


  const now=new Date();
  renderCurrent(now);setupCeremonies();
  (function(){
    var btn=document.getElementById('enableNotifications'),status=document.getElementById('notificationStatus');
    if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
    if(!btn)return;
    function sync(){
      var p=window.LangBlueNotifications.permission();
      if(p==='granted'){btn.style.display='none';status.textContent=' اعلان‌ها فعال است';}
      else if(p==='denied'){btn.textContent='🔔 فعال‌سازی اعلان‌ها از تنظیمات مرورگر';status.textContent='اجازه اعلان توسط مرورگر مسدود شده است.';}
    }
    btn.addEventListener('click',async function(){
      var p=await window.LangBlueNotifications.request();
      if(p==='granted') await window.LangBlueNotifications.show();
      sync();
    });
    sync();
  })();
})();

})();
