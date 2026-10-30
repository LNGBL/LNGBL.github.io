export const TjSrs=Object.freeze((()=>{
 const intervals=[4,24,72,168,336,720,1440];
 function apply(x,ok){const s=Object.assign({stage:0,correctCount:0,totalCorrect:0,totalWrong:0,nextReviewAt:Date.now()+14400000,intervalHours:4,weeklyStart:0,weeklyDaysDone:0,hardUntil:0,hardSessions:0},x.srs||{}),now=Date.now();if(ok){s.totalCorrect++;s.correctCount++;}else{s.totalWrong++;s.correctCount=0;}
 if(s.correctCount<5){s.hardUntil=now+48*3600000;s.hardSessions++;s.nextReviewAt=now+3600000;s.intervalHours=1;s.stage=0;}
 else if(s.correctCount<7){if(!s.weeklyStart||now-s.weeklyStart>7*86400000){s.weeklyStart=now;s.weeklyDaysDone=0;}s.weeklyDaysDone=Math.min(7,s.weeklyDaysDone+1);s.nextReviewAt=now+86400000;s.intervalHours=24;s.stage=1;}
 else{s.stage=6;s.hardUntil=0;s.nextReviewAt=now+48*3600000;s.intervalHours=48;}
 s.lastReviewedAt=now;s.lastRating=ok?'good':'again';x.srs=s;x.updatedAt=now;return s;}
 return{intervals,apply,isDue:x=>Number(x?.srs?.nextReviewAt||0)<=Date.now(),getDueWords:xs=>xs.filter(x=>Number(x?.srs?.nextReviewAt||0)<=Date.now())};
})());
window.LangBlueTj=window.LangBlueTj||{};window.LangBlueTj.Srs=TjSrs;