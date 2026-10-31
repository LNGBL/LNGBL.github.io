/* LangBlue Universal Pronunciation — IPA display, per-account glossary and native speech. */
(function(window,document){
  'use strict';
  if(window.LangBluePronunciation)return;
  const LANGS={
    english:{label:'English',voice:'en-US'},
    german:{label:'Deutsch',voice:'de-DE'},
    arabic:{label:'العربية',voice:'ar'},
    japanese:{label:'日本語',voice:'ja-JP'},
    kazakh:{label:'Қазақша',voice:'kk-KZ'},
    tajik:{label:'Тоҷикӣ',voice:'tg-TJ'},
    persian:{label:'فارسی',voice:'fa-IR'}
  };
  const path=String(location.pathname||'').toLowerCase();
  const defaultLanguage=path.includes('langdesert')?'arabic':path.includes('langblue-de')?'german':path.includes('langjp')?'japanese':path.includes('langkz')?'kazakh':path.includes('langtj')?'tajik':'english';
  const symbols=['iː','ɪ','e','æ','ɑː','ɒ','ɔː','ʊ','uː','ʌ','ə','ɜː','θ','ð','ʃ','ʒ','ŋ','tʃ','dʒ','x','ɣ','q','ʔ','ɾ','ɲ','ɕ','ʑ','ɯ','ø','y','ʁ','ˈ','ˌ','ː','̃','ʰ','ʲ','ˠ','̩','̥'];
  const storageKey=()=> 'lb:pronunciation:v1:'+String(window.LangBlueCore?.Auth?.current?.()?.id||'guest');
  const css=`
#lbPronLaunch{position:fixed;inset-inline-end:18px;bottom:18px;z-index:99990;border:0;border-radius:999px;padding:12px 16px;background:#123b58;color:#fff;font-family:inherit;font-size:14px;font-weight:700;line-height:1.2;box-shadow:0 8px 28px #0003;cursor:pointer}
#lbPronPanel{position:fixed;inset-inline-end:18px;bottom:76px;z-index:99991;width:min(390px,calc(100vw - 36px));max-height:min(76vh,680px);overflow:auto;display:none;background:var(--card-bg,#fff);color:var(--text-color,#17212b);border:1px solid var(--border-color,#ccd5dc);border-radius:18px;padding:16px;box-shadow:0 18px 60px #0004;direction:rtl}
#lbPronPanel.open{display:block}
#lbPronPanel label{display:block;font-weight:700;font-size:13px;margin:10px 0 5px}
#lbPronPanel input,#lbPronPanel select{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--border-color,#ccd5dc);border-radius:10px;background:var(--input-bg,#fff);color:inherit;font:inherit}
#lbPronPanel .lb-pron-ipa{direction:ltr;text-align:left;font:22px/1.6 "Charis SIL","Doulos SIL","Noto Sans", "Segoe UI Symbol",serif;letter-spacing:.02em}
#lbPronPanel .lb-pron-symbols{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;direction:ltr}
#lbPronPanel .lb-pron-symbols button{border:1px solid var(--border-color,#ccd5dc);border-radius:7px;padding:5px 8px;background:transparent;color:inherit;font:18px "Charis SIL","Doulos SIL","Noto Sans",serif;cursor:pointer}
#lbPronPanel .lb-pron-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#lbPronPanel .lb-pron-actions button{border:0;border-radius:9px;padding:9px 12px;background:#12658b;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}
#lbPronPanel .lb-pron-note{font-size:12px;line-height:1.7;opacity:.78;margin-top:8px}
#lbPronPanel .lb-pron-saved{font-size:12px;margin-top:8px;min-height:18px}
.lb-pronunciation-display{display:inline-block;direction:ltr;text-align:left;font:1em/1.5 "Charis SIL","Doulos SIL","Noto Sans","Segoe UI Symbol",serif}
@media(max-width:520px){#lbPronLaunch{inset-inline-end:12px;bottom:12px}#lbPronPanel{inset-inline-end:12px;bottom:68px}}
`;
  function read(){try{return JSON.parse(localStorage.getItem(storageKey())||'{}')}catch(e){return {}}}
  function write(data){try{localStorage.setItem(storageKey(),JSON.stringify(data))}catch(e){}}
  function speak(text,language){
    const value=String(text||'').trim();
    if(!value||!('speechSynthesis' in window)){setStatus('پخش گفتار در این مرورگر پشتیبانی نمی‌شود.');return}
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(value);
    utterance.lang=(LANGS[language]||LANGS[defaultLanguage]).voice;
    const voices=window.speechSynthesis.getVoices();
    const prefix=utterance.lang.toLowerCase().split('-')[0];
    const voice=voices.find(v=>String(v.lang||'').toLowerCase()===utterance.lang.toLowerCase())||voices.find(v=>String(v.lang||'').toLowerCase().startsWith(prefix));
    if(voice)utterance.voice=voice;
    utterance.onerror=()=>setStatus('صدای این زبان روی دستگاه موجود نیست؛ زبان گفتار دستگاه را بررسی کن.');
    window.speechSynthesis.speak(utterance);
    setStatus('درخواست پخش گفتار ارسال شد؛ کیفیت و موجودبودن صدا به دستگاه بستگی دارد.');
  }
  let panel,wordInput,ipaInput,langSelect,status;
  function setStatus(message){if(status)status.textContent=message}
  function insertSymbol(symbol){
    const input=ipaInput;if(!input)return;
    const start=input.selectionStart??input.value.length,end=input.selectionEnd??input.value.length;
    input.value=input.value.slice(0,start)+symbol+input.value.slice(end);
    input.focus();input.setSelectionRange(start+symbol.length,start+symbol.length);
  }
  function open(options){
    options=options||{};
    if(!panel)build();
    if(options.text!=null)wordInput.value=String(options.text);
    if(options.ipa!=null)ipaInput.value=String(options.ipa);
    if(options.language&&LANGS[options.language])langSelect.value=options.language;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    wordInput.focus();
  }
  function build(){
    const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
    const launch=document.createElement('button');launch.id='lbPronLaunch';launch.type='button';launch.textContent='🗣️ تلفظ و IPA';launch.setAttribute('aria-expanded','false');
    panel=document.createElement('section');panel.id='lbPronPanel';panel.setAttribute('aria-label','راهنمای تلفظ و آوانویسی IPA');panel.setAttribute('aria-hidden','true');
    panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><strong>راهنمای تلفظ LangBlue</strong><button type="button" id="lbPronClose" aria-label="بستن" style="border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer">×</button></div><label for="lbPronLanguage">زبان</label><select id="lbPronLanguage"></select><label for="lbPronText">واژه یا عبارت</label><input id="lbPronText" autocomplete="off" placeholder="متن را وارد کن"><label for="lbPronIPA">آوانویسی بین‌المللی (IPA)</label><input id="lbPronIPA" class="lb-pron-ipa" dir="ltr" autocomplete="off" placeholder="/ˈ.../"><div class="lb-pron-symbols" id="lbPronSymbols" aria-label="صفحه‌کلید نمادهای IPA"></div><div class="lb-pron-actions"><button type="button" id="lbPronSpeak">🔊 شنیدن</button><button type="button" id="lbPronSave">ذخیرهٔ آوانویسی</button><button type="button" id="lbPronFind">نمایش موارد ذخیره‌شده</button></div><div class="lb-pron-note">IPA با حروف لاتین معمولی یکسان نیست. برای جلوگیری از آموزش تلفظ اشتباه، آوانویسی باید از منبع معتبر یا بازبینی‌شده وارد شود؛ LangBlue آن را حدس نمی‌زند. پخش صدا از موتور گفتار دستگاه استفاده می‌کند.</div><div class="lb-pron-saved" id="lbPronStatus" aria-live="polite"></div><div id="lbPronSavedList"></div>';
    document.body.append(launch,panel);
    wordInput=panel.querySelector('#lbPronText');ipaInput=panel.querySelector('#lbPronIPA');langSelect=panel.querySelector('#lbPronLanguage');status=panel.querySelector('#lbPronStatus');
    Object.entries(LANGS).forEach(([id,item])=>{const option=document.createElement('option');option.value=id;option.textContent=item.label;langSelect.append(option)});
    langSelect.value=defaultLanguage;
    const symbolBox=panel.querySelector('#lbPronSymbols');
    symbols.forEach(symbol=>{const b=document.createElement('button');b.type='button';b.textContent=symbol;b.title='افزودن '+symbol;b.addEventListener('click',()=>insertSymbol(symbol));symbolBox.append(b)});
    launch.addEventListener('click',()=>{const isOpen=panel.classList.toggle('open');panel.setAttribute('aria-hidden',String(!isOpen));launch.setAttribute('aria-expanded',String(isOpen))});
    panel.querySelector('#lbPronClose').addEventListener('click',()=>{panel.classList.remove('open');panel.setAttribute('aria-hidden','true');launch.setAttribute('aria-expanded','false')});
    panel.querySelector('#lbPronSpeak').addEventListener('click',()=>speak(wordInput.value,langSelect.value));
    panel.querySelector('#lbPronSave').addEventListener('click',()=>{
      const word=wordInput.value.trim(),ipa=ipaInput.value.trim(),language=langSelect.value;
      if(!word||!ipa){setStatus('برای ذخیره، هم واژه و هم IPA را وارد کن.');return}
      const data=read();data[language+':'+word.toLocaleLowerCase() ]={word,ipa,language,updatedAt:new Date().toISOString()};
      write(data);setStatus('آوانویسی در این مرورگر و برای همین حساب ذخیره شد.');
    });
    panel.querySelector('#lbPronFind').addEventListener('click',()=>{
      const data=read(),items=Object.values(data).filter(x=>x.language===langSelect.value);
      const box=panel.querySelector('#lbPronSavedList');
      box.innerHTML=items.length?items.map(item=>'<div style="padding:7px 0;border-top:1px solid var(--border-color,#ddd)"><strong></strong><span class="lb-pronunciation-display"></span></div>').join(''):'<p class="lb-pron-note">هنوز آوانویسی ذخیره نشده است.</p>';
      [...box.querySelectorAll('div')].forEach((row,i)=>{row.querySelector('strong').textContent=items[i].word+' ';row.querySelector('span').textContent='/'+items[i].ipa.replace(/^\/+|\/+$/g,'')+'/'});
      setStatus(items.length+' مورد ذخیره‌شده.');
    });
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-lb-pronounce]');
    if(!trigger)return;
    event.preventDefault();
    open({text:trigger.getAttribute('data-lb-pronounce')||trigger.textContent,ipa:trigger.getAttribute('data-ipa')||'',language:trigger.getAttribute('data-language')||defaultLanguage});
  });
  window.LangBluePronunciation={open,speak,language:defaultLanguage,languages:LANGS};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
})(window,document);
