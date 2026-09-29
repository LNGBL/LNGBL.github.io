/* LangBlue public leaderboard — shared across Grammar, Vocabulary, Deutsch and Landing. */
(function(window, document){
  'use strict';

  const TABLE='leaderboard';
  const USER_SESSION='lb:session';
  const GRAMMAR_KEY='lb:user:{uid}:grammar:mastery:v1';
  const VOCAB_TOKENS='lb:user:{uid}:LangBlue_tokens';
  const VOCAB_WORDS='lb:user:{uid}:LangBlue_WORDS';

  function session(){
    try{return JSON.parse(localStorage.getItem(USER_SESSION)||'null')}catch(e){return null}
  }
  function currentUser(){
    return window.LangBlueCore&&window.LangBlueCore.Auth&&window.LangBlueCore.Auth.current
      ? window.LangBlueCore.Auth.current() : null;
  }
  function readJSON(key, fallback){
    try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v)}catch(e){return fallback}
  }
  function uid(){const s=session();return s&&s.userId?s.userId:null}
  function key(template,id){return template.replace('{uid}',id)}
  function metrics(){
    const id=uid(), u=currentUser();
    if(!id||!u)return null;
    const tokensData=readJSON(key(VOCAB_TOKENS,id),{tokens:0});
    const words=readJSON(key(VOCAB_WORDS,id),[]);
    const mastery=readJSON(key(GRAMMAR_KEY,id),{});
    let grammarScore=0, grammarCount=0;
    Object.keys(mastery||{}).forEach(function(k){
      const s=mastery[k]||{};
      grammarCount++;
      grammarScore+=Math.max(0,Number(s.score)||0);
    });
    const tokens=Math.max(0,Number(tokensData&&tokensData.tokens)||0);
    const vocabularyCount=Array.isArray(words)?words.length:0;
    const points=Math.max(0,Math.round(tokens+grammarScore));
    return {userId:id,username:String(u.username||'').trim(),displayName:String(u.name||u.fullName||u.username||'').trim(),points:Number.isFinite(points)?points:0,tokens:Number.isFinite(tokens)?tokens:0,grammarScore:Number.isFinite(grammarScore)?grammarScore:0,vocabularyCount:Number.isFinite(vocabularyCount)?vocabularyCount:0,grammarCount:Number.isFinite(grammarCount)?grammarCount:0};
  }

  async function sync(){
    const sb=window.LangBlueSupabase;
    const m=metrics();
    if(!sb||!m||typeof sb.getClient!=='function')return null;
    try{
      const client=sb.getClient();
      if(!client)return null;
      const {data,error}=await client.rpc('sync_leaderboard',{
        p_points:m.points,p_tokens:m.tokens,p_grammar_score:m.grammarScore,
        p_vocabulary_count:m.vocabularyCount,p_grammar_count:m.grammarCount
      });
      if(error){console.warn('[LangBlue] leaderboard sync failed:',error.message);return null}
      return data;
    }catch(e){console.warn('[LangBlue] leaderboard sync failed:',e);return null}
  }

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function format(n){return Number(n||0).toLocaleString('fa-IR')}

  async function render(){
    const root=document.getElementById('langblueLeaderboardBody');
    if(!root)return;
    root.innerHTML='<div class="lb-leaderboard-loading">در حال دریافت جدول…</div>';
    const sb=window.LangBlueSupabase;
    if(!sb||typeof sb.getClient!=='function'){root.innerHTML='<div class="lb-leaderboard-empty">جدول در دسترس نیست.</div>';return}
    try{
      const client=sb.getClient();
      if(!client){root.innerHTML='<div class="lb-leaderboard-empty">اتصال به حساب مرکزی برقرار نیست.</div>';return}
      const {data,error}=await client.from(TABLE).select('username,display_name,points,tokens,grammar_score,vocabulary_count,grammar_count').order('points',{ascending:false}).order('tokens',{ascending:false}).limit(8);
      if(error){root.innerHTML='<div class="lb-leaderboard-empty">فعلاً داده‌ای برای نمایش وجود ندارد.</div>';return}
      if(!data||!data.length){root.innerHTML='<div class="lb-leaderboard-empty">هنوز زبان‌آموزی در جدول ثبت نشده است.</div>';return}
      root.innerHTML='<div class="lb-leaderboard-table-wrap"><table class="lb-leaderboard-table"><thead><tr><th>#</th><th>زبان‌آموز</th><th>امتیاز</th><th>🪙 توکن</th><th>گرامر</th><th>واژه</th></tr></thead><tbody>'+
        data.map(function(row,i){
          return '<tr><td><strong>'+format(i+1)+'</strong></td><td><strong>'+esc(row.display_name||row.username)+'</strong><small>@'+esc(row.username)+'</small></td><td>'+format(row.points)+'</td><td>'+format(row.tokens)+'</td><td>'+format(row.grammar_count)+'</td><td>'+format(row.vocabulary_count)+'</td></tr>';
        }).join('')+'</tbody></table></div>';
    }catch(e){root.innerHTML='<div class="lb-leaderboard-empty">خطا در دریافت جدول.</div>'}
  }

  async function init(){
    if(document.getElementById('langblueLeaderboardBody')){
      await sync();
      await render();
      setInterval(async function(){await sync();await render()},60000);
    }else{
      await sync();
    }
  }

  window.LangBlueLeaderboard={sync,render,metrics};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
