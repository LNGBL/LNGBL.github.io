(function(window){
'use strict';
function store(){return window.LangBlueCore&&window.LangBlueCore.Store;}
function recordVocabularyOutcome(item,correct){
  const s=store();
  if(!s||!item||item.source!=='personal'||!item.word)return {ok:false,reason:'not_personal'};
  const word=String(item.word).trim();
  const meaning=String(item.meaning||item.persian||item.translation||'').trim();
  if(!word)return {ok:false,reason:'empty_word'};
  const key=word+'|'+meaning;
  const now=Date.now();
  const repetitionKey='LangBlue_repetition_data';
  const repetition=s.get(repetitionKey,{})||{};
  const previous=repetition[key]||{word,persian:meaning,correctCount:0,lastReviewed:now,nextReview:now,interval:'daily'};
  if(correct){
    previous.correctCount=Number(previous.correctCount||0)+1;
    previous.interval=previous.correctCount>=5?'48h':previous.correctCount>=3?'24h':'every_2_visits';
    previous.nextReview=previous.interval==='48h'?now+48*60*60*1000:previous.interval==='24h'?now+24*60*60*1000:Number.MAX_SAFE_INTEGER;
  }else{
    previous.correctCount=Math.max(0,Number(previous.correctCount||0)-1);
    previous.interval='daily';
    previous.nextReview=now;
  }
  previous.lastReviewed=now;
  repetition[key]=previous;
  s.set(repetitionKey,repetition);

  const srsKey='LangBlue_srs_data';
  const srs=s.get(srsKey,{})||{};
  const old=srs[key]||{};
  srs[key]={
    word,persian:meaning,status:correct?(previous.correctCount>=5?'mastered':'learning'):'review',
    lastReview:now,reviewCount:Number(old.reviewCount||0)+1,isForgotten:false
  };
  s.set(srsKey,srs);
  return {ok:true};
}
function recordGrammarOutcome(conceptId,correct,responseSeconds){
  const engine=window.LangBlueGrammarEngine;
  if(!engine||typeof engine.review!=='function'||!conceptId)return {ok:false,reason:'engine_unavailable'};
  engine.review(String(conceptId),!!correct,{responseSeconds:Number(responseSeconds||0)});
  return {ok:true};
}
window.LangBlueWesternLearning={recordVocabularyOutcome,recordGrammarOutcome};
})(window);
