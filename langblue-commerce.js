(function(window){
  'use strict';

  var PLANS = {
    irt_7d:  {id:'irt_7d',  days:7,   label:'۷ روز',  price:201998, priceStr:'201,998 T', feature:'دسترسی کامل به Grammar + Vocabulary'},
    irt_14d: {id:'irt_14d', days:14,  label:'۱۴ روز', price:527998, priceStr:'527,998 T', feature:'دسترسی کامل به Grammar + Vocabulary'},
    irt_21d: {id:'irt_21d', days:21,  label:'۲۱ روز', price:913998, priceStr:'913,998 T', feature:'دسترسی کامل به Grammar + Vocabulary'},
    irt_3m:  {id:'irt_3m',  months:3, days:90,  label:'۳ ماه',  price:1469998, priceStr:'1,469,998 T', feature:'دسترسی کامل به Grammar + Vocabulary + بدون محدودیت'},
    irt_6m:  {id:'irt_6m',  months:6, days:180, label:'۶ ماه',  price:1661998, priceStr:'1,661,998 T', feature:'دسترسی کامل به Grammar + Vocabulary + بدون محدودیت'},
    irt_12m: {id:'irt_12m', months:12, days:365, label:'۱۲ ماه', price:1901998, priceStr:'1,901,998 T', feature:'دسترسی کامل به Grammar + Vocabulary + امکان پرینت از اطلاعات'}
  };

  var FESTIVALS = [
    {key:'cyrus',title:'👑 روز کوروش بزرگ',type:'jalali',month:8,day:7,discount:20},
    {key:'amordadgan',title:'🌿 امردادگان',type:'jalali',month:5,day:7,discount:20},
    {key:'deygan',title:'☀️ دیگان (خرم‌روز)',type:'jalali',month:10,day:1,discount:20},
    {key:'yalda',title:'🍉 یلدا',type:'jalali',month:9,day:30,discount:20},
    {key:'fitr',title:'🌙 عید فطر',type:'islamic',month:10,day:1,discount:20},
    {key:'adha',title:'🐑 عید قربان',type:'islamic',month:12,day:10,discount:20},
    {key:'ghadir',title:'🕊️ عید غدیر',type:'islamic',month:12,day:18,discount:20},
    {key:'christmas',title:'🎄 Christmas',type:'gregorian',month:12,day:25,discount:20},
    {key:'blackfriday',title:'🛍️ Black Friday',type:'gregorian',month:11,day:20,discount:20},
    {key:'halloween',title:'🎃 Halloween',type:'gregorian',month:10,day:31,discount:20},
    {key:'men',title:'♂️ International Men’s Day',type:'gregorian',month:11,day:19,discount:20},
    {key:'women',title:'♀️ International Women’s Day',type:'gregorian',month:3,day:8,discount:20},
    {key:'valentine',title:'❤️ Valentine’s Day',type:'gregorian',month:2,day:14,discount:20}
  ];

  function jalali(d){
    try{
      var p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d);
      var get=function(t){return Number((p.find(function(x){return x.type===t;})||{}).value||0);};
      return {year:get('year'),month:get('month'),day:get('day')};
    }catch(e){return null;}
  }

  function islamic(d){
    try{
      var p=new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura',{month:'numeric',day:'numeric'}).formatToParts(d);
      var get=function(t){return Number((p.find(function(x){return x.type===t;})||{}).value||0);};
      return {month:get('month'),day:get('day')};
    }catch(e){return null;}
  }

  function activeFestival(date){
    var d=date||new Date(),j=jalali(d),i=islamic(d);
    for(var n=0;n<FESTIVALS.length;n++){
      var f=FESTIVALS[n];
      if(f.type==='gregorian' && d.getMonth()+1===f.month && d.getDate()===f.day) return f;
      if(f.type==='jalali' && j && j.month===f.month && j.day===f.day) return f;
      if(f.type==='islamic' && i && i.month===f.month && i.day===f.day) return f;
    }
    return null;
  }

  function discountedPrice(price,discount){
    return Math.max(0,Math.round(Number(price)*(100-Number(discount||0))/100));
  }

  function comma(n){return Number(n||0).toLocaleString('en-US');}

  function displayPlan(plan,date){
    var p=typeof plan==='string'?PLANS[plan]:plan, f=activeFestival(date);
    if(!p)return null;
    var discount=f?f.discount:0, finalPrice=discountedPrice(p.price,discount);
    return Object.assign({},p,{
      festival:f,
      discount:discount,
      finalPrice:finalPrice,
      finalPriceStr:comma(finalPrice)+' T'
    });
  }

  var CODES = {
    'Verify_mU#2292':'irt_7d','Verify_m!!2992':'irt_14d','Verify_I@112':'irt_21d',
    'Verify_MIR_ss1':'irt_3m','Verify_ll39332':'irt_6m','Verify_311012':'irt_12m'
  };

  var PRODUCTS = {
    grammar:{id:'grammar',label:'LangBlue Grammar',icon:'📐',url:'LangBlue-grammer.html'},
    vocabulary:{id:'vocabulary',label:'LangBlue Vocabulary',icon:'📚',url:'vocab.html'},
    deutsch:{id:'deutsch',label:'LangBlue Deutsch',icon:'🇩🇪',url:'LangBlue-De.html'}
  };

  function buildOrder(productIds,planId,date){
    var ids=Array.isArray(productIds)?productIds:[productIds];
    var plan=displayPlan(planId,date);
    var products=ids.map(function(id){return PRODUCTS[id];}).filter(Boolean);
    if(!plan||!products.length)return null;
    var total=Math.round(plan.finalPrice*products.length);
    return {
      id:'LB-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),
      createdAt:Date.now(),
      plan:plan,
      products:products,
      quantity:products.length,
      subtotal:total,
      total:total,
      totalStr:comma(total)+' T'
    };
  }

  var DAILY_PLAN_IDS = ['irt_7d','irt_14d','irt_21d'];
  var MONTHLY_PLAN_IDS = ['irt_3m','irt_6m','irt_12m'];

  window.LangBlueCommerce={
    PLANS:PLANS,
    DAILY_PLAN_IDS:DAILY_PLAN_IDS,
    MONTHLY_PLAN_IDS:MONTHLY_PLAN_IDS,
    CODES:CODES,
    PRODUCTS:PRODUCTS,
    buildOrder:buildOrder,
    FESTIVALS:FESTIVALS,
    activeFestival:activeFestival,
    discountedPrice:discountedPrice,
    displayPlan:displayPlan,
    formatPrice:comma
  };
})(window);
