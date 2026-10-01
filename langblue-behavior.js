/* LangBlue Behavioral Research — Phase 1 event collector. */
(function(window){
  'use strict';

  const FUNCTION_NAME = 'langblue-behavior';
  const SCHEMA_VERSION = 1;
  const SESSION_KEY = 'lb:behavior:session';
  const VALID_PRODUCTS = new Set(['grammar','vocabulary','deutsch','arabic']);

  function uuid(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
      const r=Math.random()*16|0, v=c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  }

  function sessionId(){
    try{
      let id=sessionStorage.getItem(SESSION_KEY);
      if(!id || !/^[0-9a-f-]{36}$/i.test(id)){ id=uuid(); sessionStorage.setItem(SESSION_KEY,id); }
      return id;
    }catch(_){ return uuid(); }
  }

  async function send(eventName, options){
    const sb=window.LangBlueSupabase && window.LangBlueSupabase.getClient
      ? window.LangBlueSupabase.getClient() : null;
    if(!sb) return {ok:false,error:'SUPABASE_CLIENT_UNAVAILABLE'};

    const session=await sb.auth.getSession();
    const authSession=session && session.data && session.data.session;
    if(!authSession) return {ok:false,error:'AUTH_REQUIRED'};

    const opts=options||{};
    const product=typeof opts.productId==='string' && VALID_PRODUCTS.has(opts.productId.toLowerCase())
      ? opts.productId.toLowerCase() : null;

    const payload=(opts.payload && typeof opts.payload==='object' && !Array.isArray(opts.payload))
      ? opts.payload : {};

    try{
      const {data,error}=await sb.functions.invoke(FUNCTION_NAME,{
        body:{
          event_id:uuid(),
          event_name:String(eventName||'').trim(),
          product_id:product,
          language:typeof opts.language==='string' ? opts.language.toLowerCase() : null,
          session_id:sessionId(),
          context_id:typeof opts.contextId==='string' ? opts.contextId : null,
          event_payload:payload,
          occurred_at:new Date().toISOString(),
          schema_version:SCHEMA_VERSION
        }
      });
      if(error) return {ok:false,error:error.message||'EVENT_FUNCTION_ERROR'};
      return data||{ok:false,error:'EMPTY_EVENT_RESPONSE'};
    }catch(error){
      return {ok:false,error:error.message||'EVENT_SEND_FAILED'};
    }
  }

  function trackUiEvent(target){
    if(!target || !target.closest) return;
    const path=String(window.location.pathname||'').toLowerCase();
    const el=target.closest('button,select,[data-plan],.main-tab,.tab,.price-card');
    if(!el) return;

    let eventName=null, contextId=null, payload={};

    if(path.includes('langdesert')){
      if(el.matches('.tab-btn[data-tab="flashcard"]')){ eventName='learning_started'; contextId='flashcard'; }
      else if(el.matches('.tab-btn[data-tab="quiz"]')){ eventName='assessment_started'; contextId='arabic_quiz'; }
      else if(el.matches('.cat-btn') || el.matches('#lbDesertLevel')){ eventName='level_selected'; contextId='arabic_level'; payload={level:el.value||el.dataset.value||null}; }
      else if(el.matches('.btn-known-shadow,.btn-unknown-shadow,.quiz-option-shadow')){ eventName='content_answered'; contextId='arabic_learning'; }
      else if(el.matches('.btn-listen')){ eventName='content_seen'; contextId='arabic_shadowing'; }
    }else if(path.includes('vocab')){
      if(el.id==='openFlashcardBtn'){ eventName='learning_started'; contextId='flashcard'; }
      else if(el.id==='openWeaknessBtn' || el.id==='weaknessStartBtn'){ eventName='weakness_mode_opened'; contextId='weakness'; }
      else if(el.matches('#flashcardOptions .option-btn')){ eventName='content_answered'; contextId='flashcard'; payload={option_index:Number(el.dataset.index||-1)}; }
      else if(el.matches('#weaknessOptions .option-btn')){ eventName='content_answered'; contextId='weakness'; payload={option_index:Number(el.dataset.index||-1)}; }
      else if(el.matches('[data-srs]')){ eventName='content_repeated'; contextId=el.getAttribute('data-srs'); payload={status:el.getAttribute('data-status')}; }
      else if(el.matches('.main-tab')){ eventName='content_seen'; contextId=el.getAttribute('data-tab'); }
      else if(el.matches('[data-plan],.price-card')){ eventName='subscription_selected'; contextId=el.getAttribute('data-plan'); }
    }else if(path.includes('grammer') || path.includes('grammar')){
      if(el.matches('.tab[data-tab="flashcard"]')){ eventName='learning_started'; contextId='flashcard'; }
      else if(el.matches('.flashcard .option')){ eventName='content_answered'; contextId='flashcard'; payload={option:el.dataset.opt||null}; }
      else if(el.matches('[data-plan],.price-card')){ eventName='subscription_selected'; contextId=el.getAttribute('data-plan'); }
    }else if(path.includes('langblue-de') || path.includes('deutsch')){
      if(el.id==='btn-next'){ eventName='learning_started'; contextId='flashcard'; }
      else if(el.matches('.options-grid .option')){ eventName='content_answered'; contextId='flashcard'; payload={option_index:Number(el.dataset.idx||-1)}; }
      else if(el.matches('[data-plan],.price-card')){ eventName='subscription_selected'; contextId=el.getAttribute('data-plan'); }
    }else if(path.includes('exam')){
      if(el.id==='saveSetup'){ eventName='assessment_started'; contextId='annual_exam'; }
      else if(el.matches('#options .option')){ eventName='content_answered'; contextId='annual_exam'; payload={option_index:Array.from(el.parentElement.children).indexOf(el)}; }
    }

    if(eventName) send(eventName,{productId:inferProduct(),language:inferLanguage(),contextId,payload});
  }

  function inferLanguage(){
    const path=String(window.location.pathname||'').toLowerCase();
    if(path.includes('langdesert')) return 'arabic';
    const product=inferProduct();
    return product==='deutsch'?'german':(product?'english':null);
  }

  function pageView(productId, language){
    return send('page_view',{productId,language});
  }

  window.LangBlueBehavior={
    version:'1.0.0',
    sessionId,
    send,
    pageView
  };

  function inferProduct(){
    const path=String(window.location.pathname||'').toLowerCase();
    if(path.includes('langdesert')) return 'arabic';
    if(path.includes('vocab')) return 'vocabulary';
    if(path.includes('grammer') || path.includes('grammar')) return 'grammar';
    if(path.includes('langblue-de') || path.includes('deutsch')) return 'deutsch';
    return null;
  }

  function boot(){
    const product=inferProduct();
    const language=inferLanguage();
    pageView(product,language);
    try{
      if(!sessionStorage.getItem('lb:behavior:started')){
        sessionStorage.setItem('lb:behavior:started','1');
        send('session_started',{productId:product,language});
      }
    }catch(_){}
  }

  document.addEventListener('click',function(e){trackUiEvent(e.target);},true);
  document.addEventListener('change',function(e){
    if(e.target && e.target.id==='receiptPlan') send('subscription_selected',{productId:null,language:null,contextId:e.target.value,payload:{source:'receipt_builder'}});
  },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})(window);