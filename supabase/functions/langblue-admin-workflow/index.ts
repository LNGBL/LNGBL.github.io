import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://lngbl.github.io";
const HEADERS={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store, no-cache, must-revalidate, private","Pragma":"no-cache","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const now=()=>new Date().toISOString();
const noteOf=(v:unknown)=>String(v??"").trim().slice(0,1000);
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 if(req.method!=="POST"||req.headers.get("Origin")!==ORIGIN)return reply({ok:false,error:"REQUEST_NOT_ALLOWED"},403);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return reply({ok:false,error:"SERVER_CONFIGURATION_ERROR"},500);
 const authHeader=req.headers.get("Authorization")||"",token=authHeader.startsWith("Bearer ")?authHeader.slice(7).trim():"";
 if(!token)return reply({ok:false,error:"AUTH_REQUIRED"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const authResult=await auth.auth.getUser(token);
 if(authResult.error||!authResult.data.user)return reply({ok:false,error:"AUTH_REQUIRED"},401);
 const actor=authResult.data.user,db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const grant=await db.from("platform_admins").select("role").eq("user_id",actor.id).maybeSingle();
 if(grant.error)return reply({ok:false,error:"AUTHORIZATION_CHECK_FAILED"},500);
 if(!grant.data)return reply({ok:false,error:"ADMIN_UNAUTHORIZED"},403);
 let body:any;try{body=await req.json()}catch{return reply({ok:false,error:"INVALID_JSON"},400)}
 const action=String(body.action||""),note=noteOf(body.note);
 async function audit(entityType:string,entityId:string,event:string,previous:string|null,next:string|null,eventNote=note){
  const q=await db.from("admin_workflow_events").insert({actor_user_id:actor.id,entity_type:entityType,entity_id:entityId,action:event,previous_status:previous,new_status:next,note:eventNote});
  if(q.error)throw new Error("AUDIT_WRITE_FAILED");
 }
 async function notify(userId:string,kind:string,title:string,message:string,entityType:string,entityId:string){
  const q=await db.from("teacher_admin_notifications").insert({user_id:userId,notification_type:kind,title,message,related_entity_type:entityType,related_entity_id:entityId});
  return !q.error;
 }
 async function attachProfiles(rows:any[],field:string){
  const ids=[...new Set(rows.map(x=>x[field]).filter(Boolean))];
  if(!ids.length)return rows.map(x=>({...x,account:null}));
  const q=await db.from("profiles").select("id,username,name").in("id",ids);
  if(q.error)throw new Error("PROFILE_LOOKUP_FAILED");
  const m=new Map((q.data||[]).map((x:any)=>[x.id,x]));
  return rows.map(x=>({...x,account:m.get(x[field])||null}));
 }
 try{
  if(action==="queue_list"){
   const [teachers,offers,content,contributions,allTeachers,allOffers,allContent,auditRows,maintenance,releases,connections,customerProfiles,customerSubscriptions,guardianLinks,guardianRequests,guardianVerifications,communityRequests]=await Promise.all([
    db.from("teacher_profiles").select("user_id,display_name,age,gender,portrait_url,bio,qualifications,languages,product_areas,status,verified,created_at,updated_at,reviewed_at,admin_note").eq("status","pending").order("created_at").limit(100),
    db.from("teacher_class_offers").select("id,teacher_id,title,description,product_area,price_irt,price_basis,capacity,status,created_at").eq("status","pending_review").order("created_at").limit(100),
    db.from("teacher_content").select("id,teacher_id,product_area,title,description,content_payload,price_irt,status,discount_eligible,created_at").eq("status","pending_review").order("created_at").limit(100),
    db.from("content_contributions").select("id,user_id,source_type,payload,language,language_level,consent_snapshot,created_at,review_status").eq("review_status","pending").order("created_at").limit(100),
    db.from("teacher_profiles").select("user_id,display_name,age,status,verified,created_at,updated_at,reviewed_at,admin_note").order("updated_at",{ascending:false}).limit(200),
    db.from("teacher_class_offers").select("id,teacher_id,title,product_area,price_irt,status,created_at,updated_at,reviewed_at,admin_note").order("updated_at",{ascending:false}).limit(200),
    db.from("teacher_content").select("id,teacher_id,title,product_area,status,price_irt,created_at,updated_at,reviewed_at,admin_note").order("updated_at",{ascending:false}).limit(200),
    db.from("admin_workflow_events").select("id,actor_user_id,entity_type,entity_id,action,previous_status,new_status,note,created_at").order("created_at",{ascending:false}).limit(30),
    db.from("langblue_maintenance_control").select("minimum_users,minimum_interval,window_duration,active_until,last_activated_at,last_exam_date,annual_exam_date,updated_at").eq("singleton",true).maybeSingle(),
    db.from("android_app_releases").select("id,version_code,version_name,min_version_code,release_notes,force_update,published_at").order("published_at",{ascending:false}).limit(5),
    db.from("teacher_connections").select("id,status").limit(500),
    db.from("profiles").select("id,name,username,country,country_name,language_level,english_level,german_level,arabic_level,trial_started_at,trial_expires_at,created_at,connection_policy_status").order("created_at",{ascending:false}).limit(500),
    db.from("subscriptions").select("id,user_id,plan_id,product_ids,status,starts_at,expires_at,created_at").order("created_at",{ascending:false}).limit(2000),
    db.from("guardian_relationships").select("learner_user_id,guardian_user_id,scopes,status,accepted_at,revoked_at").limit(2000),
    db.from("guardian_consent_requests").select("learner_user_id,guardian_user_id,learner_declared_minor,requested_scopes,status,created_at,expires_at,responded_at").order("created_at",{ascending:false}).limit(2000),
    db.from("guardian_age_verifications").select("guardian_user_id,status,verification_method,verified_at,expires_at").limit(1000),
    db.from("community_discount_requests").select("user_id,status,declared_age,discount_expires_at,created_at,reviewed_at,admin_note").limit(2000)
   ]);
   for(const q of [teachers,offers,content,contributions,allTeachers,allOffers,allContent,auditRows,maintenance,releases,connections,customerProfiles,customerSubscriptions,guardianLinks,guardianRequests,guardianVerifications,communityRequests])if(q.error)throw new Error("QUEUE_LOAD_FAILED");
   const [teacherRows,offerRows,contentRows,contributionRows,teacherManagement,offerManagement,contentManagement]=await Promise.all([
    attachProfiles(teachers.data||[],"user_id"),attachProfiles(offers.data||[],"teacher_id"),attachProfiles(content.data||[],"teacher_id"),attachProfiles(contributions.data||[],"user_id"),
    attachProfiles(allTeachers.data||[],"user_id"),attachProfiles(allOffers.data||[],"teacher_id"),attachProfiles(allContent.data||[],"teacher_id")
   ]);
   const staff=grant.data.role==="owner"?await db.from("platform_admins").select("user_id,role,created_at").order("created_at"): {data:[],error:null};
   if(staff.error)throw new Error("STAFF_LOAD_FAILED");
   return reply({ok:true,role:grant.data.role,generated_at:now(),
    queues:{teachers:teacherRows,offers:offerRows,content:contentRows,contributions:contributionRows},
    management:{teachers:teacherManagement,offers:offerManagement,content:contentManagement},
    customers:(customerProfiles.data||[]).map((p:any)=>{
      const subs=(customerSubscriptions.data||[]).filter((x:any)=>x.user_id===p.id);
      const links=(guardianLinks.data||[]).filter((x:any)=>x.learner_user_id===p.id&&x.status==="active");
      const requests=(guardianRequests.data||[]).filter((x:any)=>x.learner_user_id===p.id||x.guardian_user_id===p.id);
      const discount=(communityRequests.data||[]).find((x:any)=>x.user_id===p.id)||null;
      const guardians=links.map((x:any)=>{const g=(customerProfiles.data||[]).find((z:any)=>z.id===x.guardian_user_id);const age=(guardianVerifications.data||[]).find((v:any)=>v.guardian_user_id===x.guardian_user_id&&v.status==="verified"&&(!v.expires_at||new Date(v.expires_at).getTime()>Date.now()));return {name:g?.name||null,username:g?.username||null,scopes:x.scopes,accepted_at:x.accepted_at,age_verified:!!age};});
      return {name:p.name,username:p.username,country:p.country_name||p.country,language_level:p.language_level,english_level:p.english_level,german_level:p.german_level,arabic_level:p.arabic_level,created_at:p.created_at,trial_started_at:p.trial_started_at,trial_expires_at:p.trial_expires_at,connection_policy_status:p.connection_policy_status,subscriptions:subs,guardian_relationships:guardians,guardian_requests:requests.map((x:any)=>{const otherId=x.learner_user_id===p.id?x.guardian_user_id:x.learner_user_id;const other=(customerProfiles.data||[]).find((z:any)=>z.id===otherId);return {direction:x.learner_user_id===p.id?\"learner\":\"guardian\",other_name:other?.name||null,other_username:other?.username||null,status:x.status,declared_minor:x.learner_declared_minor,scopes:x.requested_scopes,created_at:x.created_at,expires_at:x.expires_at};}),guardian_age_assurance_verified:guardians.some((g:any)=>g.age_verified),discount_request:discount?{status:discount.status,declared_age:discount.declared_age,expires_at:discount.discount_expires_at,created_at:discount.created_at,reviewed_at:discount.reviewed_at}:null,payment_responsible_party:"not_recorded",paid_amount:"not_recorded"};
    }),
    counts:{teachers:teacherRows.length,offers:offerRows.length,content:contentRows.length,contributions:contributionRows.length,pending_connections:(connections.data||[]).filter((x:any)=>x.status==="pending").length,customers:(customerProfiles.data||[]).length},
    staff:await attachProfiles(staff.data||[],"user_id"),audit:auditRows.data||[],
    operations:{maintenance:maintenance.data||null,releases:releases.data||[]}
   });
  }
  if(action==="decide"){
   const type=String(body.entityType||""),id=String(body.id||""),decision=String(body.decision||"");
   if(!id||!/^[0-9a-f-]{36}$/i.test(id))return reply({ok:false,error:"INVALID_INPUT"},400);
   if(type==="teacher_profile"){
    const cur=await db.from("teacher_profiles").select("status,age").eq("user_id",id).maybeSingle();
    if(cur.error)throw new Error("RECORD_LOOKUP_FAILED");
    if(!cur.data)return reply({ok:false,error:"RECORD_NOT_FOUND"},404);
    const transitions:any={approve:["pending","active",true],reject:["pending","rejected",false],suspend:["active","suspended",false],reactivate:["suspended","active",true]};
    const t=transitions[decision];if(!t||cur.data.status!==t[0])return reply({ok:false,error:"INVALID_STATE_TRANSITION"},409);if(decision==="approve"&&(!Number.isInteger(cur.data.age)||cur.data.age<18))return reply({ok:false,error:"TEACHER_MUST_CONFIRM_ADULT_AGE"},409);
    const patch:any={status:t[1],verified:t[2],reviewed_at:now(),reviewed_by:actor.id,admin_note:note};
    if(decision==="approve")patch.publishing_trial_started_at=now();
    if(decision==="reactivate")patch.publishing_trial_started_at=now();
    const upd=await db.from("teacher_profiles").update(patch).eq("user_id",id).eq("status",cur.data.status).select("user_id,status,verified").maybeSingle();
    if(upd.error)throw new Error("DECISION_SAVE_FAILED");if(!upd.data)return reply({ok:false,error:"RECORD_NOT_FOUND_OR_STATE_CHANGED"},409);
    await audit(type,id,decision,cur.data.status,upd.data.status);const sent=await notify(id,"teacher_profile",decision==="approve"?"پروفایل معلم تأیید شد":decision==="reject"?"درخواست پروفایل رد شد":decision==="suspend"?"پروفایل معلم تعلیق شد":"پروفایل معلم دوباره فعال شد",(decision==="approve"?"پروفایل آموزشی شما تأیید و فعال شد.":decision==="reject"?"درخواست پروفایل شما تأیید نشد؛ می‌توانید اطلاعات را اصلاح و دوباره ارسال کنید.":decision==="suspend"?"نمایش عمومی پروفایل شما موقتاً متوقف شده است.":"نمایش عمومی پروفایل شما دوباره فعال شد.")+(note?"\nیادداشت مدیر: "+note:""),type,id);return reply({ok:true,status:upd.data.status,verified:upd.data.verified,notification_sent:sent});
   }
   if(type==="teacher_offer"){
    const cur=await db.from("teacher_class_offers").select("status,teacher_id").eq("id",id).maybeSingle();
    if(cur.error)throw new Error("RECORD_LOOKUP_FAILED");if(!cur.data)return reply({ok:false,error:"RECORD_NOT_FOUND"},404);
    const transitions:any={approve:["pending_review","open"],reject:["pending_review","rejected"],close:["open","closed"],request_review:["rejected","pending_review"]};
    const t=transitions[decision];if(!t||cur.data.status!==t[0])return reply({ok:false,error:"INVALID_STATE_TRANSITION"},409);
    if(decision==="approve"){
      const owner=await db.from("teacher_class_offers").select("teacher_id").eq("id",id).single();
      const tp=await db.from("teacher_profiles").select("status,verified").eq("user_id",owner.data.teacher_id).maybeSingle();
      if(owner.error||!tp.data||tp.data.status!=="active"||tp.data.verified!==true)return reply({ok:false,error:"TEACHER_NOT_APPROVED"},409);
    }
    const upd=await db.from("teacher_class_offers").update({status:t[1],reviewed_at:now(),reviewed_by:actor.id,admin_note:note,updated_at:now()}).eq("id",id).eq("status",cur.data.status).select("id,status").maybeSingle();
    if(upd.error)throw new Error("DECISION_SAVE_FAILED");if(!upd.data)return reply({ok:false,error:"RECORD_NOT_FOUND_OR_STATE_CHANGED"},409);
    await audit(type,id,decision,cur.data.status,t[1]);const sent=await notify(cur.data.teacher_id,"teacher_offer",decision==="approve"?"پیشنهاد کلاس منتشر شد":decision==="reject"?"درخواست انتشار کلاس رد شد":"آگهی کلاس بسته شد",(decision==="approve"?"پیشنهاد کلاس شما پس از بررسی تأیید و منتشر شد.":decision==="reject"?"درخواست انتشار پیشنهاد کلاس تأیید نشد.":"آگهی کلاس شما بسته شد.")+(note?"\nیادداشت مدیر: "+note:""),type,id);return reply({ok:true,status:t[1],notification_sent:sent});
   }
   if(type==="teacher_content"){
    const cur=await db.from("teacher_content").select("status,teacher_id").eq("id",id).maybeSingle();
    if(cur.error)throw new Error("RECORD_LOOKUP_FAILED");if(!cur.data)return reply({ok:false,error:"RECORD_NOT_FOUND"},404);
    const transitions:any={approve:["pending_review","published"],reject:["pending_review","rejected"],archive:["published","archived"],request_review:["rejected","pending_review"]};
    const t=transitions[decision];if(!t||cur.data.status!==t[0])return reply({ok:false,error:"INVALID_STATE_TRANSITION"},409);if(decision==="approve"){const tp=await db.from("teacher_profiles").select("status,verified").eq("user_id",cur.data.teacher_id).maybeSingle();if(tp.error||!tp.data||tp.data.status!=="active"||tp.data.verified!==true)return reply({ok:false,error:"TEACHER_NOT_APPROVED"},409)}
    const upd=await db.from("teacher_content").update({status:t[1],published_at:t[1]==="published"?now():null,reviewed_at:now(),reviewed_by:actor.id,admin_note:note,updated_at:now()}).eq("id",id).eq("status",cur.data.status).select("id,status").maybeSingle();
    if(upd.error)throw new Error("DECISION_SAVE_FAILED");if(!upd.data)return reply({ok:false,error:"RECORD_NOT_FOUND_OR_STATE_CHANGED"},409);
    await audit(type,id,decision,cur.data.status,t[1]);const sent=await notify(cur.data.teacher_id,"teacher_content",decision==="approve"?"محتوای آموزشی منتشر شد":decision==="reject"?"محتوای آموزشی نیازمند اصلاح است":"محتوای آموزشی بایگانی شد",(decision==="approve"?"محتوای شما پس از بررسی منتشر شد.":decision==="reject"?"محتوای ارسالی شما تأیید نشد؛ پس از اصلاح می‌توانید دوباره ارسال کنید.":"محتوای منتشرشده بایگانی شد.")+(note?"\nیادداشت مدیر: "+note:""),type,id);return reply({ok:true,status:t[1],notification_sent:sent});
   }
   if(type==="content_contribution"){
    const cur=await db.from("content_contributions").select("review_status,user_id,consent_snapshot").eq("id",id).maybeSingle();
    if(cur.error)throw new Error("RECORD_LOOKUP_FAILED");if(!cur.data||cur.data.review_status!=="pending")return reply({ok:false,error:"RECORD_NOT_FOUND_OR_STATE_CHANGED"},409);
    if(!["approve","reject"].includes(decision))return reply({ok:false,error:"INVALID_DECISION"},400);if(decision==="approve"&&cur.data.consent_snapshot!==true)return reply({ok:false,error:"CONSENT_REQUIRED"},409);
    const next=decision==="approve"?"approved":"rejected";
    const upd=await db.from("content_contributions").update({review_status:next,exam_eligible:next==="approved",reviewed_at:now(),reviewed_by:actor.id,admin_note:note}).eq("id",id).eq("review_status","pending").select("id,review_status,exam_eligible").maybeSingle();
    if(upd.error)throw new Error("DECISION_SAVE_FAILED");if(!upd.data)return reply({ok:false,error:"RECORD_NOT_FOUND_OR_STATE_CHANGED"},409);
    await audit(type,id,decision,"pending",next);const sent=await notify(cur.data.user_id,"content_contribution",decision==="approve"?"مشارکت محتوایی تأیید شد":"مشارکت محتوایی تأیید نشد",(decision==="approve"?"مشارکت شما تأیید شد و می‌تواند برای محتوای آزمون استفاده شود.":"مشارکت محتوایی شما تأیید نشد.")+(note?"\nیادداشت مدیر: "+note:""),type,id);return reply({ok:true,status:next,exam_eligible:upd.data.exam_eligible,notification_sent:sent});
   }
   return reply({ok:false,error:"UNKNOWN_ENTITY_TYPE"},400);
  }
  if(["staff_add","staff_remove","staff_list"].includes(action)){
   if(grant.data.role!=="owner")return reply({ok:false,error:"OWNER_REQUIRED"},403);
   if(action==="staff_list"){
    const q=await db.from("platform_admins").select("user_id,role,created_at").order("created_at");if(q.error)throw new Error("STAFF_LOAD_FAILED");
    return reply({ok:true,staff:await attachProfiles(q.data||[],"user_id")});
   }
   if(action==="staff_add"){
    const username=String(body.username||"").trim().replace(/^@/,"").toLowerCase();
    if(!/^[a-z0-9_.-]{3,40}$/.test(username))return reply({ok:false,error:"INVALID_USERNAME"},400);
    const p=await db.from("profiles").select("id,username,name").ilike("username",username).maybeSingle();
    if(p.error)throw new Error("ACCOUNT_LOOKUP_FAILED");if(!p.data)return reply({ok:false,error:"ACCOUNT_NOT_FOUND"},404);
    const add=await db.from("platform_admins").insert({user_id:p.data.id,role:"admin"}).select("user_id,role").maybeSingle();
    if(add.error)return reply({ok:false,error:"ALREADY_ADMIN_OR_SAVE_FAILED"},409);
    await audit("admin_staff",p.data.id,"staff_add",null,"admin","Admin role granted");
    return reply({ok:true,staff:{...add.data,account:p.data}});
   }
   const target=String(body.userId||"");if(!/^[0-9a-f-]{36}$/i.test(target)||target===actor.id)return reply({ok:false,error:"INVALID_TARGET"},400);
   const old=await db.from("platform_admins").select("role").eq("user_id",target).maybeSingle();
   if(old.error)throw new Error("STAFF_LOOKUP_FAILED");if(!old.data||old.data.role==="owner")return reply({ok:false,error:"OWNER_OR_STAFF_NOT_FOUND"},409);
   const del=await db.from("platform_admins").delete().eq("user_id",target).eq("role","admin").select("user_id").maybeSingle();
   if(del.error||!del.data)throw new Error("STAFF_REMOVE_FAILED");
   await audit("admin_staff",target,"staff_remove","admin",null,"Admin role revoked");return reply({ok:true});
  }
  if(action==="maintenance_status"){
   const [control,windows,releases]=await Promise.all([
    db.from("langblue_maintenance_control").select("*").eq("singleton",true).maybeSingle(),
    db.from("android_maintenance_windows").select("id,maintenance_date,start_time,end_time,message,enabled,timezone").order("maintenance_date",{ascending:false}).limit(20),
    db.from("android_app_releases").select("id,version_code,version_name,min_version_code,apk_path,apk_sha256,release_notes,force_update,published_at").order("published_at",{ascending:false}).limit(20)
   ]);
   if(control.error||windows.error||releases.error)throw new Error("OPERATIONS_LOAD_FAILED");
   return reply({ok:true,maintenance:control.data,windows:windows.data||[],releases:releases.data||[]});
  }
  return reply({ok:false,error:"UNKNOWN_ACTION"},400);
 }catch(error){return reply({ok:false,error:error instanceof Error?error.message:"INTERNAL_ERROR"},500)}
});