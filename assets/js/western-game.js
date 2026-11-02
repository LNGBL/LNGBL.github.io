(function(){
'use strict';
const $=id=>document.getElementById(id);
const stages={
'dusty-town':{name:'Dusty Town',description:'A new day begins on the frontier.'},
'railway':{name:'Railway Station',description:'The next train carries a grammar puzzle.'},
'gold-mine':{name:'Gold Mine',description:'Look closely. Every clue has a meaning.'},
'ranch':{name:'The Ranch',description:'Build clear sentences and help the ranchers.'},
'forgotten-canyon':{name:'Forgotten Canyon',description:'Bring your knowledge together for a final discovery.'}};
let client=null,stage='dusty-town',challenge=null,pack=null,audio=null,audioTimer=null,audioEnabled=false,volume=.08;
function toast(message){const t=$('errorToast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200)}
function updateStats(s){s=s||{};$('tokenCount').textContent=Number(s.tokens||0);$('streakCount').textContent=Number(s.streak||0)+' / 10';$('winCount').textContent=Number(s.total_wins||0)}
function renderWords(){
 const personal=Array.isArray(pack&&pack.personal_words)?pack.personal_words:[];
 const shared=Array.isArray(pack&&pack.shared_words)?pack.shared_words:[];
 $('personalCount').textContent=personal.length+' / 15';$('sharedCount').textContent=shared.length+' / 15';
 function draw(host,items){host.replaceChildren();items.forEach(item=>{const card=document.createElement('div');card.className='word-card';const word=document.createElement('strong');word.textContent=item.word||'—';const meaning=document.createElement('small');meaning.textContent=item.meaning||'Meaning not provided';const source=document.createElement('em');source.textContent=item.source==='personal'?'YOUR WORD':item.source==='supplement'?'TOWN SUPPLY':'COMMUNITY BANK';card.append(word,meaning,source);host.append(card)})}
 draw($('personalWords'),personal);draw($('sharedWords'),shared);
 const n=personal.filter(x=>x.source==='supplement').length;
 $('wordNotice').textContent=n?n+' place(s) in your 15-word notebook were filled with curated town-library vocabulary. No other player private words are used.':'Your personal notebook is ready. Community words are selected separately and duplicates are excluded.';
}
async function loadPack(){const r=await client.rpc('western_get_stage_pack',{p_stage:stage});if(r.error)throw r.error;pack=r.data||{};renderWords();updateStats(pack.player_state)}
function setStage(next){if(!stages[next])return;stage=next;document.querySelectorAll('.map-stop').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage));$('stageLabel').textContent=stages[stage].name.toUpperCase();$('sceneTitle').textContent=stages[stage].name;$('sceneDescription').textContent=stages[stage].description;loadPack().catch(e=>toast(e.message||'Could not load this stage.'));$('missionBox').innerHTML='<div class="empty-mission"><span>✦</span><strong>New location discovered.</strong><p>Choose a mission to explore this place.</p></div>'}
async function startMission(mode){
 try{$('missionBox').textContent='Preparing your mission…';const r=await client.rpc('western_start_challenge',{p_stage:stage,p_mode:mode});if(r.error)throw r.error;challenge=r.data;
 const box=$('missionBox');box.replaceChildren();const k=document.createElement('div');k.className='challenge-kicker';k.textContent=mode==='grammar'?'RAILWAY GRAMMAR TEST':'FRONTIER WORD DISCOVERY';
 const p=document.createElement('div');p.className='challenge-prompt';p.textContent=challenge.prompt;const opts=document.createElement('div');opts.className='answer-options';
 (challenge.options||[]).forEach(answer=>{const b=document.createElement('button');b.type='button';b.className='answer-option';b.textContent=answer;b.addEventListener('click',()=>submitAnswer(answer,opts));opts.append(b)});box.append(k,p,opts);
 }catch(e){$('missionBox').textContent='Mission unavailable: '+(e.message||'Please try again.')}}
async function submitAnswer(answer,opts){
 if(!challenge)return;opts.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{const r=await client.rpc('western_submit_challenge',{p_challenge_id:challenge.id,p_answer:answer});if(r.error)throw r.error;const d=r.data;
 const line=document.createElement('div');line.className='result-line'+(d.correct?'':' wrong');
 line.textContent=d.correct?'Correct! +'+d.tokens_awarded+' game tokens. Your streak is '+d.streak+'. '+(d.bonus_awarded?'+25 streak bonus unlocked!':''):'Not quite. Your streak has reset to zero. Review the clue and try another mission.';
 $('missionBox').append(line);updateStats(d);challenge=null;
 const again=document.createElement('button');again.type='button';again.className='secondary-action';again.style.marginTop='12px';again.textContent='Explore another mission';again.addEventListener('click',()=>startMission('vocabulary'));$('missionBox').append(again);await loadPack();
 }catch(e){opts.querySelectorAll('button').forEach(b=>b.disabled=false);toast(e.message||'Your answer could not be saved.')}}
function startAudio(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audio)audio=new AC();if(audio.state==='suspended')audio.resume();const notes=[196,220,261.63,293.66,329.63,293.66,261.63,220,196,164.81,196,220];let i=0;function play(){if(!audioEnabled||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=notes[i%notes.length];gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.22),audio.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.38);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.4);i++;audioTimer=setTimeout(play,520)}play()}
function stopAudio(){if(audioTimer)clearTimeout(audioTimer);audioTimer=null}
function toggleAudio(){audioEnabled=!audioEnabled;$('soundToggle').textContent=audioEnabled?'♫ Sound on':'♫ Sound off';$('soundToggle').setAttribute('aria-pressed',String(audioEnabled));if(audioEnabled)startAudio();else stopAudio()}
async function init(){
 try{if(!window.LangBlueSupabase||!window.LangBlueCore){toast('LangBlue services could not be loaded.');return}
 await window.LangBlueCore.Auth.init();
 if(window.LangBlueCentralAccess){await window.LangBlueCentralAccess.refreshSubscription();if(!window.LangBlueCentralAccess.hasProductAccess('western')){window.LangBlueCentralAccess.enforceProductAccess();return}}
 const session=await window.LangBlueSupabase.getAuthSession();if(!session||!session.user){$('loginNotice').hidden=false;return}
 client=window.LangBlueSupabase.getClient();if(!client){toast('Secure connection unavailable.');return}await loadPack();
 }catch(e){toast(e.message||'Could not prepare the frontier.')}}
document.querySelectorAll('.map-stop').forEach(b=>b.addEventListener('click',()=>setStage(b.dataset.stage)));
$('vocabMission').addEventListener('click',()=>startMission('vocabulary'));$('grammarMission').addEventListener('click',()=>startMission('grammar'));
$('soundToggle').addEventListener('click',toggleAudio);$('volumeControl').addEventListener('input',e=>{volume=Number(e.target.value)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();else if(audioEnabled)startAudio()});init();
})();