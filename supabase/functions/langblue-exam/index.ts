import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lngbl.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LEVELS = ["A1","A2","B1","B2","C1","C2"];
const LANGUAGES = ["english","german"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {...corsHeaders,"Content-Type":"application/json"} });
}
function hashText(v:string) {
  const data=new TextEncoder().encode(v.trim().toLowerCase());
  return crypto.subtle.digest("SHA-256",data).then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join(""));
}
function shuffle<T>(a:T[]) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

Deno.serve(async (req) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!service) return json({ok:false,error:"SERVER_CONFIGURATION_ERROR"},500);
  const auth=req.headers.get("Authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"").trim();
  if(!token) return json({ok:false,error:"AUTH_REQUIRED"},401);
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const { data: maintenance } = await admin.rpc("is_langblue_maintenance_window");
  if (maintenance === true) return json({ok:false,error:"SERVER_MAINTENANCE"},503);
  const {data:{user},error:ue}=await admin.auth.getUser(token);
  if(ue||!user) return json({ok:false,error:"AUTH_REQUIRED"},401);
  let body:any={}; try{body=await req.json();}catch{return json({ok:false,error:"INVALID_JSON"},400);}
  const action=String(body.action||"status");

  const profileQ=await admin.from("profiles").select("id,username,name,language_level,created_at,exam_contribution_consent").eq("id",user.id).maybeSingle();
  if(profileQ.error||!profileQ.data) return json({ok:false,error:"PROFILE_NOT_FOUND"},404);
  const profile=profileQ.data;

  if(action==="status"){
    const now=new Date().toISOString();
    const {data:periods}=await admin.from("exam_periods").select("id,cycle_year,cycle_date,level,exam_language,start_at,registration_open_at,registration_close_at,capacity,status,snapshot_locked").gte("start_at",now).order("start_at");
    const {data:regs}=await admin.from("exam_registrations").select("id,period_id,level,exam_language,status,eligibility_tier,registered_at").eq("user_id",user.id).order("registered_at",{ascending:false});
    const {count:vocab}=await admin.from("content_contributions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("source_type","vocabulary");
    const {count:grammar}=await admin.from("content_contributions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("source_type","grammar");
    const languageCounts:any={};
    for(const lang of LANGUAGES){
      const {count:v}=await admin.from("content_contributions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language",lang).eq("source_type","vocabulary");
      const {count:g}=await admin.from("content_contributions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language",lang).eq("source_type","grammar");
      languageCounts[lang]={vocabulary_count:v||0,grammar_count:g||0};
    }
    return json({ok:true,profile,periods:periods||[],registrations:regs||[],eligibility:{vocabulary_count:vocab||0,grammar_count:grammar||0,by_language:languageCounts}});
  }

  if(action==="set_level"){
    const level=String(body.level||"");
    if(!LEVELS.includes(level)) return json({ok:false,error:"INVALID_LEVEL"},400);
    const {error}=await admin.from("profiles").update({language_level:level,updated_at:new Date().toISOString()}).eq("id",user.id);
    if(error) return json({ok:false,error:"LEVEL_SAVE_FAILED"},500);
    return json({ok:true,level});
  }

  if(action==="contribution_consent"){
    const consent=body.consent===true;
    const {error}=await admin.from("profiles").update({exam_contribution_consent:consent,exam_contribution_consent_at:consent?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",user.id);
    if(error) return json({ok:false,error:"CONSENT_SAVE_FAILED"},500);
    return json({ok:true,consent});
  }

  if(action==="contribute"){
    if(profile.exam_contribution_consent!==true) return json({ok:false,error:"CONTRIBUTION_CONSENT_REQUIRED"},403);
    const items=Array.isArray(body.items)?body.items.slice(0,500):[];
    const language=String(body.language||"");
    if(!LANGUAGES.includes(language)) return json({ok:false,error:"LANGUAGE_REQUIRED"},400);
    const level=LEVELS.includes(String(body.level||""))?String(body.level):profile.language_level;
    if(!level) return json({ok:false,error:"LEVEL_REQUIRED"},400);
    const rows=[];
    for(const item of items){
      const type=["vocabulary","grammar","example"].includes(String(item.source_type))?String(item.source_type):"vocabulary";
      const source=String(item.source_content||item.word||item.de||item.german||item.grammar||"").trim().slice(0,500);
      if(!source) continue;
      const payload={source_content:source,translation_fa:String(item.translation_fa||item.persian||"").slice(0,1000),word_type:String(item.word_type||item.type||"").slice(0,80),grammar_explanation_fa:String(item.grammar_explanation_fa||item.explanation||"").slice(0,2000),example_text:String(item.example_text||item.example||"").slice(0,2000),sticker_ref:String(item.sticker_ref||item.stickers||"").slice(0,1000)};
      const sourceHash=await hashText(JSON.stringify(payload));
      rows.push({user_id:user.id,language,source_type:type,payload,source_hash:sourceHash,language_level:level,consent_snapshot:true});
    }
    if(rows.length){
      const {error}=await admin.from("content_contributions").upsert(rows,{onConflict:"user_id,language,source_type,source_hash",ignoreDuplicates:true});
      if(error) return json({ok:false,error:"CONTRIBUTION_SAVE_FAILED"},500);
      for(const r of rows){
        const p=r.payload as any;
        await admin.from("question_pool").upsert({language,level,source_type:r.source_type,source_content:p.source_content,translation_fa:p.translation_fa||null,word_type:p.word_type||null,grammar_explanation_fa:p.grammar_explanation_fa||null,example_text:p.example_text||null,sticker_ref:p.sticker_ref||null,source_hash:r.source_hash,author_hash:await hashText(user.id),author_user_id:user.id,last_seen_at:new Date().toISOString(),retention_until:new Date(Date.now()+15552000000).toISOString()},{onConflict:"language,level,source_hash",ignoreDuplicates:true});
      }
    }
    return json({ok:true,accepted:rows.length});
  }

  if(action==="register"){
    const periodId=String(body.period_id||"");
    const requestedLanguage=String(body.exam_language||"");
    if(requestedLanguage&&!LANGUAGES.includes(requestedLanguage)) return json({ok:false,error:"INVALID_EXAM_LANGUAGE"},400);
    const periodQ=await admin.from("exam_periods").select("*").eq("id",periodId).maybeSingle();
    const p=periodQ.data;
    if(!p) return json({ok:false,error:"PERIOD_NOT_FOUND"},404);
    const now=Date.now(), open=new Date(p.registration_open_at).getTime(), close=new Date(p.registration_close_at).getTime();
    if(now<open||now>close||p.status==="cancelled") return json({ok:false,error:"REGISTRATION_CLOSED"},409);
    if(profile.language_level!==p.level) return json({ok:false,error:"LEVEL_MISMATCH"},409);
    if(!LANGUAGES.includes(String(p.exam_language))) return json({ok:false,error:"INVALID_EXAM_LANGUAGE"},500);
    if(requestedLanguage&&requestedLanguage!==p.exam_language) return json({ok:false,error:"LANGUAGE_PERIOD_MISMATCH"},409);
    const {count}=await admin.from("exam_registrations").select("id",{count:"exact",head:true}).eq("period_id",periodId).eq("status","registered");
    if((count||0)>=p.capacity) return json({ok:false,error:"CAPACITY_FULL"},409);
    const {count:vocab}=await admin.from("content_contributions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language",p.exam_language).eq("source_type","vocabulary");
    const {count:grammar}=await admin.from("content_contributions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language",p.exam_language).eq("source_type","grammar");
    const ageOk=Date.now()-new Date(profile.created_at).getTime()>=49*86400000;
    const standard=ageOk&&(vocab||0)>=50&&(grammar||0)>=25;
    const tier=standard?"standard":"educational_access";
    const consent=profile.exam_contribution_consent===true;
    if(!consent) return json({ok:false,error:"EXAM_CONTRIBUTION_CONSENT_REQUIRED"},403);
    const {data:reg,error}=await admin.from("exam_registrations").insert({period_id:periodId,user_id:user.id,exam_language:p.exam_language,level:p.level,eligibility_tier:tier,eligibility_snapshot:{age_ok:ageOk,vocabulary_count:vocab||0,grammar_count:grammar||0,standard_criteria:standard,educational_fairness:true}}).select("id,period_id,exam_language,level,status,eligibility_tier,registered_at").single();
    if(error) return json({ok:false,error:error.code==="23505"?"ALREADY_REGISTERED":"REGISTRATION_FAILED"},409);
    return json({ok:true,registration:reg});
  }

  if(action==="start"){
    const periodId=String(body.period_id||"");
    const {data:reg}=await admin.from("exam_registrations").select("id,period_id,user_id,status,level,exam_language").eq("period_id",periodId).eq("user_id",user.id).eq("status","registered").maybeSingle();
    if(!reg) return json({ok:false,error:"NOT_REGISTERED"},403);
    if(!LANGUAGES.includes(String(reg.exam_language))) return json({ok:false,error:"INVALID_EXAM_LANGUAGE"},409);
    const {data:p}=await admin.from("exam_periods").select("*").eq("id",periodId).single();
    if(!p?.snapshot_locked) return json({ok:false,error:"EXAM_NOT_READY"},409);
    const startMs=new Date(p.start_at).getTime(), now=Date.now();
    if(now<startMs) return json({ok:false,error:"EXAM_NOT_STARTED",start_at:p.start_at},409);
    if(now>startMs+55*60*1000) return json({ok:false,error:"EXAM_WINDOW_CLOSED"},409);
    const tenHours=startMs-10*3600000;
    const existing=await admin.from("exam_sessions").select("*").eq("registration_id",reg.id).in("status",["ready","active"]).maybeSingle();
    if(existing.data) return json({ok:true,session_id:existing.data.id,status:existing.data.status});
    const raw=crypto.randomUUID()+"."+crypto.randomUUID(), sessionHash=await hashText(raw);
    const {data:s,error}=await admin.from("exam_sessions").insert({registration_id:reg.id,user_id:user.id,period_id:periodId,session_hash:sessionHash,status:"active",started_at:new Date().toISOString(),ends_at:new Date(Math.min(startMs+55*60*1000,Date.now()+54*65000)).toISOString()}).select("id,status,current_question_index,started_at,ends_at").single();
    if(error) return json({ok:false,error:"SESSION_CREATE_FAILED"},500);
    const q=await admin.from("exam_questions").select("id,order_index,question_text,options").eq("period_id",periodId).eq("order_index",1).single();
    return json({ok:true,session:s,question:q.data});
  }

  if(action==="answer"){
    const sessionId=String(body.session_id||""), questionId=String(body.question_id||""), selected=Number(body.selected_option);
    if(!Number.isInteger(selected)||selected<0||selected>3) return json({ok:false,error:"INVALID_OPTION"},400);
    const {data:s}=await admin.from("exam_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).maybeSingle();
    if(!s||s.status!=="active") return json({ok:false,error:"SESSION_NOT_ACTIVE"},409);
    if(Date.now()>new Date(s.ends_at).getTime()) return json({ok:false,error:"TIME_EXPIRED"},409);
    const {data:q}=await admin.from("exam_questions").select("id,order_index,correct_option,assessment_path,prediction_type,concept_key").eq("id",questionId).eq("period_id",s.period_id).single();
    if(!q) return json({ok:false,error:"QUESTION_NOT_FOUND"},404);
    if(q.order_index!==s.current_question_index) return json({ok:false,error:"QUESTION_SEQUENCE_ERROR"},409);
    const started=new Date(s.started_at).getTime(), elapsed=Math.max(0,Date.now()-started-(q.order_index-1)*65000);
    if(elapsed>65000) return json({ok:false,error:"QUESTION_TIME_EXPIRED"},409);
    const correct=selected===q.correct_option;
    const outcome=correct?1:0;
    const calibrationError=confidence===null?null:Math.abs(outcome-((confidence-1)/4));
    const {error}=await admin.from("exam_answers").insert({session_id:s.id,question_id:q.id,selected_option:selected,elapsed_ms:elapsed,is_correct:correct,confidence,prediction_text:predictionText,recognition_signal:q.assessment_path==="recognition"?outcome:null,production_signal:q.assessment_path==="production"?outcome:null,calibration_error:calibrationError,posterior_state:{path:q.assessment_path||"legacy",prediction_type:q.prediction_type||"legacy",concept_key:q.concept_key||null}});
    if(error) return json({ok:false,error:error.code==="23505"?"ANSWER_ALREADY_SUBMITTED":"ANSWER_SAVE_FAILED"},409);
    if(q.order_index<54){
      await admin.from("exam_sessions").update({current_question_index:q.order_index+1}).eq("id",s.id);
      const next=await admin.from("exam_questions").select("id,order_index,question_text,options").eq("period_id",s.period_id).eq("order_index",q.order_index+1).single();
      return json({ok:true,correct,next_question:next.data});
    }
    await admin.from("exam_sessions").update({status:"submitted"}).eq("id",s.id);
    const assessment=await admin.rpc("finalize_exam_assessment",{p_session_id:s.id});
    const assessmentData=assessment.data||{};
    const all=await admin.from("exam_answers").select("is_correct").eq("session_id",s.id);
    const score=Number(assessmentData.score??(all.data||[]).filter(x=>x.is_correct).length);
    const {data:result}=await admin.from("exam_results").insert({session_id:s.id,user_id:user.id,period_id:s.period_id,level:s.level,score,percent:Number((score/54*100).toFixed(2)),released_at:new Date(Date.now()+48*3600000).toISOString(),expires_at:new Date(Date.now()+48*3600000+10*3600000).toISOString(),assessment_model:"two_stream_hmm",recognition_score:Number(assessmentData.recognition_score??0),production_score:Number(assessmentData.production_score??0),calibration_score:Number(assessmentData.calibration_score??0),posterior_profile:assessmentData.posterior_profile||{},stats:{answered:54,exam_language:(await admin.from("exam_periods").select("exam_language").eq("id",s.period_id).single()).data?.exam_language||null,assessment_model:"two_stream_hmm"}}).select().single();
    return json({ok:true,finished:true,score,release_at:result?.released_at});
  }

  if(action==="incident"){
    const sessionId=String(body.session_id||"");
    const {data:s}=await admin.from("exam_sessions").select("id,period_id").eq("id",sessionId).eq("user_id",user.id).maybeSingle();
    if(!s) return json({ok:false,error:"SESSION_NOT_FOUND"},404);
    await admin.from("exam_incidents").insert({session_id:s.id,user_id:user.id,period_id:s.period_id,incident_type:String(body.incident_type||"client_security"),metadata:body.metadata||{}});
    await admin.from("exam_sessions").update({status:"cancelled",cancel_reason:String(body.incident_type||"security_incident")}).eq("id",s.id);
    await admin.from("exam_registrations").update({status:"disqualified"}).eq("id",(await admin.from("exam_sessions").select("registration_id").eq("id",s.id).single()).data?.registration_id);
    return json({ok:true,cancelled:true});
  }

  if(action==="report_question"){
    const questionId=String(body.question_id||""), reason=String(body.reason||"").trim().slice(0,500), evidence=String(body.evidence||"").trim().slice(0,2000);
    if(!questionId||reason.length<5) return json({ok:false,error:"REPORT_REASON_REQUIRED"},400);
    const {error}=await admin.from("question_reports").insert({question_id:questionId,reporter_user_id:user.id,reason,evidence});
    if(error) return json({ok:false,error:error.code==="23505"?"ALREADY_REPORTED":"REPORT_FAILED"},409);
    return json({ok:true,review:"pending"});
  }

  if(action==="result"){
    const {data:r}=await admin.from("exam_results").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!r||!r.released_at||Date.now()<new Date(r.released_at).getTime()||Date.now()>new Date(r.expires_at).getTime()) return json({ok:false,error:"REPORT_UNAVAILABLE"},404);
    const higher=await admin.from("exam_results").select("score",{count:"exact",head:true}).eq("period_id",r.period_id).eq("level",r.level).gt("score",r.score);
    const same=await admin.from("exam_results").select("id",{count:"exact",head:true}).eq("period_id",r.period_id).eq("level",r.level);
    const rank=(higher.count||0)+1, total=same.count||0;
    const report={score:r.score,percent:r.percent,level:r.level,rank,total,ahead:total-rank,behind:rank-1};
    return json({ok:true,report,download_expires_at:r.expires_at});
  }

  return json({ok:false,error:"UNKNOWN_ACTION"},400);
});