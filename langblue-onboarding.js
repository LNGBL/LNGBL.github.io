(function(window,document){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function root(){return document.getElementById('lbCentralModal');}
function show(){
  const r=root(); if(!r||!window.LangBlueCore?.Auth)return;
  const body=r.querySelector('#lbCentralBody'); if(!body)return;
  if(window.LangBlueCore.Auth.current()) return;
  const d={step:1,name:'',username:'',password:'',english:'',german:'',artists:[],peer:false,notifications:true};
  const levels=['A1','A2','B1','B2','C1','C2'];
  const artists=[
    ['taylor_swift','Taylor Swift','Taylor_swift.jpg'],
    ['billie_eilish','Billie Eilish','Billie_Eilish_portrait.jpg'],
    ['john_lennon','John Lennon','John-wa-portrait.jpg'],
    ['dua_lipa','Dua Lipa','Dua_Lipa.jpg']
  ];
  function render(){
    body.innerHTML='<h2 id="lbCentralTitle">ساخت حساب LangBlue</h2>'+
      '<div class="lb-central-muted">مرحله '+d.step+' از 5</div>'+
      '<div id="lbOnboardContent" style="margin-top:12px"></div>'+
      '<div id="lbOnboardError" class="lb-central-error"></div>'+
      '<div class="lb-central-actions" id="lbOnboardActions"></div>';
    const c=body.querySelector('#lbOnboardContent'),a=body.querySelector('#lbOnboardActions');
    if(d.step===1)c.innerHTML='<div class="lb-central-field"><label>نام</label><input id="obName" value="'+esc(d.name)+'" autocomplete="name"></div><div class="lb-central-field"><label>نام کاربری</label><input id="obUser" value="'+esc(d.username)+'" autocomplete="username"></div>';
    if(d.step===2)c.innerHTML='<div class="lb-central-field"><label>رمز عبور</label><input id="obPass" type="password" minlength="8" autocomplete="new-password"></div><div class="lb-central-field"><label>تکرار رمز عبور</label><input id="obConfirm" type="password" minlength="8" autocomplete="new-password"></div>';
    if(d.step===3)c.innerHTML='<div class="lb-profile-grid"><div><label>سطح انگلیسی</label><select id="obEn"><option value="">انتخاب</option>'+levels.map(x=>'<option '+(d.english===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div><label>سطح آلمانی</label><select id="obDe"><option value="">انتخاب</option>'+levels.map(x=>'<option '+(d.german===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div>';
    if(d.step===4)c.innerHTML='<div class="lb-central-muted">۱ تا ۲ نفر را انتخاب کن. در این مرحله فقط تصویر نمایش داده می‌شود.</div><div class="lb-music-grid">'+artists.map(x=>'<label class="lb-music-card '+(d.artists.includes(x[0])?'selected':'')+'"><input class="obArtist" type="checkbox" value="'+x[0]+'" '+(d.artists.includes(x[0])?'checked':'')+'> '+x[1]+'<img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/'+x[2]+'" alt="'+x[1]+'" loading="lazy"></label>').join('')+'</div>';
    if(d.step===5)c.innerHTML='<label><input id="obPeer" type="checkbox" '+(d.peer?'checked':'')+'> اجازه می‌دهم نمونه‌های آموزشی من فقط به‌صورت ناشناس برای کاربران هم‌سطح استفاده شود.</label><label style="margin-top:12px"><input id="obNotify" type="checkbox" '+(d.notifications?'checked':'')+'> اعلان محتوای آموزشی هم‌سطح</label>';
    if(d.step>1)a.innerHTML='<button class="btn btn-secondary" id="obBack" type="button">قبلی</button>';
    a.innerHTML+='<button class="btn btn-primary" id="obNext" type="button">'+(d.step===5?'ساخت حساب':'ادامه')+'</button><button class="btn btn-secondary" id="obCancel" type="button">انصراف</button>';
    body.querySelector('#obBack')?.addEventListener('click',function(){d.step--;render();});
    body.querySelector('#obCancel').onclick=function(){r.classList.remove('open');};
    body.querySelectorAll('.obArtist').forEach(function(cb){cb.addEventListener('change',function(){if(body.querySelectorAll('.obArtist:checked').length>2){this.checked=false;return;}this.closest('.lb-music-card').classList.toggle('selected',this.checked);});});
    body.querySelector('#obNext').onclick=async function(){
      const e=body.querySelector('#lbOnboardError');e.textContent='';
      if(d.step===1){d.name=body.querySelector('#obName').value.trim();d.username=body.querySelector('#obUser').value.trim();if(!d.name||!/^[^\s]{3,80}$/.test(d.username)){e.textContent='نام و نام کاربری معتبر وارد کن.';return;}}
      if(d.step===2){const p=body.querySelector('#obPass').value,q=body.querySelector('#obConfirm').value;if(p.length<8||p!==q){e.textContent='رمز باید حداقل ۸ نویسه باشد و با تکرار آن یکسان باشد.';return;}d.password=p;}
      if(d.step===3){d.english=body.querySelector('#obEn').value;d.german=body.querySelector('#obDe').value;if(!d.english||!d.german){e.textContent='هر دو سطح زبان لازم است.';return;}}
      if(d.step===4){d.artists=[...body.querySelectorAll('.obArtist:checked')].map(x=>x.value);if(d.artists.length<1||d.artists.length>2){e.textContent='حداقل یک و حداکثر دو انتخاب لازم است.';return;}}
      if(d.step===5){
        d.peer=body.querySelector('#obPeer').checked;d.notifications=body.querySelector('#obNotify').checked;
        if(!d.peer){e.textContent='برای شبکهٔ یادگیری ناشناس، این رضایت لازم است.';return;}
        const result=await window.LangBlueCore.Auth.register({name:d.name,username:d.username,password:d.password,english_level:d.english,german_level:d.german,favorite_artists:d.artists,peer_learning_consent:true,peer_learning_notifications:d.notifications});
        if(!result||!result.ok){e.textContent=(result&&result.error)||'ساخت حساب ناموفق بود.';return;}
        try{document.cookie='lb_central_session=1; Max-Age=2592000; Path=/; SameSite=Lax; Secure';}catch(_){}
        r.classList.remove('open');if(window.LangBlueCentralAccount?.refresh)window.LangBlueCentralAccount.refresh();setTimeout(function(){if(window.LangBlueCentralAccount?.open)window.LangBlueCentralAccount.open();},80);return;
      }
      d.step++;render();
    };
  }
  render();r.classList.add('open');
}
function init(){
  if(!window.LangBlueCentralAccount)return;
  const original=window.LangBlueCentralAccount.open;
  window.LangBlueCentralAccount.open=function(){
    const u=window.LangBlueCore?.Auth?.current?.();
    if(!u){if(original)original();setTimeout(function(){show();},20);return;}
    return original.apply(this,arguments);
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
