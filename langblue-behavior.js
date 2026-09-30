/* LangBlue Behavioral Research — Phase 1 event collector. */
(function(window){
  'use strict';

  const FUNCTION_NAME = 'langblue-behavior';
  const SCHEMA_VERSION = 1;
  const SESSION_KEY = 'lb:behavior:session';
  const VALID_PRODUCTS = new Set(['grammar','vocabulary','deutsch']);

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

  function pageView(productId, language){
    return send('page_view',{productId,language});
  }

  window.LangBlueBehavior={
    version:'1.0.0',
    sessionId,
    send,
    pageView
  };
})(window);