export const TjSechsfach=Object.freeze((()=>{
 const levels=['audio','word','root','morph','sentence','text'];
 function normalize(v={}){const o={};levels.forEach(k=>{const x=v[k]||{};o[k]={attempts:+x.attempts||0,correct:+x.correct||0,lastAt:+x.lastAt||0};});o.levelsMastered=levels.filter(k=>o[k].correct>=3&&o[k].attempts&&o[k].correct/o[k].attempts>=.7).length;o.unlocked=o.levelsMastered>=5;return o;}
 function record(x,level,ok){if(!levels.includes(level))return normalize(x.sechsfach);const s=normalize(x.sechsfach);s[level].attempts++;if(ok)s[level].correct++;s[level].lastAt=Date.now();x.sechsfach=normalize(s);return x.sechsfach;}
 return{levels,normalize,record};
})());
window.LangBlueTj=window.LangBlueTj||{};window.LangBlueTj.Sechsfach=TjSechsfach;