export const TjSrs=Object.freeze((()=>{
 const intervals=[4,24,72,168,336,720,1440];
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function normalize(s={}){return Object.assign({stage:0,correctCount:0,totalCorrect:0,totalWrong:0,nextReviewAt:Date.now()+14400000,intervalHours:4,stabilityHours:4,difficulty:5,lapses:0,weeklyStart:0,weeklyDaysDone:0,hardUntil:0,hardSessions:0},s)}
 function apply(x,ok,mode='word'){
  const s=normalize(x.srs||{}),now=Date.now(),elapsed=Math.max(0,(now-Number(s.lastReviewedAt||0))/3600000),oldStability=clamp(Number(s.stabilityHours)||Number(s.intervalHours)||4,.5,24*180);
  const retrievability=elapsed>0?Math.exp(Math.log(.9)*elapsed/oldStability):1;
  const modeFactor=mode==='audio'?1.08:mode==='word'?1:.9;
  s.totalCorrect+=ok?1:0;s.totalWrong+=ok?0:1;s.lastReviewedAt=now;s.lastRating=ok?'good':'again';
  if(ok){
   s.correctCount++;s.lapses=Math.max(0,s.lapses-.05);s.difficulty=clamp(s.difficulty-.12,1,10);
   s.stage=clamp(s.stage+1,0,6);
   s.stabilityHours=clamp(oldStability*(1.28+(1-retrievability)*.72)*modeFactor*(.78+(10-s.difficulty)*.035),.5,24*180);
   s.intervalHours=clamp(s.stabilityHours*.9,4,24*180);s.hardUntil=0;
  }else{
   s.correctCount=0;s.lapses++;s.difficulty=clamp(s.difficulty+.65,1,10);s.stage=Math.max(0,s.stage-2);
   s.stabilityHours=clamp(oldStability*(retrievability<.55?.28:.42),.5,oldStability);
   s.intervalHours=clamp(s.stabilityHours*.22,.5,4);s.hardUntil=now+48*3600000;s.hardSessions++;
  }
  s.nextReviewAt=now+s.intervalHours*3600000;x.srs=s;x.updatedAt=now;return s;
 }
 function isDue(x){return Number(x?.srs?.nextReviewAt||0)<=Date.now()}
 function getDueWords(xs){return xs.filter(isDue).sort((a,b)=>Number(a.srs.nextReviewAt||0)-Number(b.srs.nextReviewAt||0)||Number(b.srs.lapses||0)-Number(a.srs.lapses||0))}
 return{intervals,normalize,apply,isDue,getDueWords};
})());
window.LangBlueTj=window.LangBlueTj||{};window.LangBlueTj.Srs=TjSrs;