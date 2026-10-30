/* Native-review gate: no speculative Tajik conjugations are emitted as facts. */
export const TjMorph=Object.freeze({
  irregularCandidates:['будан','доштан','рафтан','омадан','хӯрдан','нӯшидан','гуфтан','дидан','додан','гирифтан','шудан','кардан','хостан','тавонистан','донистан','ёфтан','фурӯхтан','харидан','нишастан','бархостан'],
  conjugate(root,options={}){return{form:null,breakdown:[],verified:false,notice:'Ин қолаби тасриф ҳанӯз аз ҷониби гӯяндаи модарии тоҷикӣ санҷида нашудааст.'};},
  detectRoots(form){return form?[{root:String(form).trim(),verified:false}]:[];}
});
window.LangBlueTj=window.LangBlueTj||{};window.LangBlueTj.Morph=TjMorph;