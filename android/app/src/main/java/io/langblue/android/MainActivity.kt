package io.langblue.android

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

data class GrammarItem(val id:String,val title:String,val use:String,val formula:String,val examples:List<String>)
data class VocabularyItem(val id:String,val word:String,val meaning:String,val partOfSpeech:String,val example:String)
data class ReviewState(var score:Int=0,var streak:Int=0,var reps:Int=0,var lapses:Int=0,var correct:Int=0,var wrong:Int=0,var total:Int=0,var interval:Double=0.0,var next:Long=0,var ease:Double=2.3)

class Repository(private val context:Context) {
    private val prefs=context.getSharedPreferences("langblue_native",Context.MODE_PRIVATE)
    private val endpoint="https://ocxeyponzzcvlrvwndji.supabase.co/functions/v1/langblue-android-handoff"

    fun token():String?=prefs.getString("token",null)
    fun currentPairCode():String=prefs.getString("pair_code","") ?: ""
    fun setToken(t:String)=prefs.edit().putString("token",t).apply()
    fun clearToken(){ val e=prefs.edit().remove("token"); prefs.all.keys.filter{it.startsWith("central_")}.forEach{e.remove(it)}; e.apply() }

    private fun deviceKey():String = prefs.getString("device_key",null) ?: UUID.randomUUID().toString().replace("-","").also { prefs.edit().putString("device_key",it).apply() }
    private fun deviceLabel():String = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}".trim().ifBlank{"Android device"}
    private fun appVersion():String = "1.0.5"
    suspend fun requestPairing(username:String):JSONObject? = withContext(Dispatchers.IO){
        val pair=UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-","")
        prefs.edit().putString("pair_code",pair).apply()
        val result=request(JSONObject().put("action","request_pairing").put("username",username.trim())
            .put("pair_code",pair).put("device_key",deviceKey()).put("device_label",deviceLabel()).put("app_version",appVersion()))
        if(result?.optBoolean("ok")==true) prefs.edit().putString("pairing_id",result.optString("pairing_id")).apply()
        result
    }
    fun pollPairing(pairingId:String,pairCode:String):JSONObject? =
        request(JSONObject().put("action","poll_pairing").put("pairing_id",pairingId).put("pair_code",pairCode).put("device_key",deviceKey()).put("device_label",deviceLabel()).put("app_version",appVersion()))

    fun bootstrap():JSONObject?=request(JSONObject().put("action","bootstrap").put("token",token()).put("device_key",deviceKey()))
    fun appStatus():JSONObject?=request(JSONObject().put("action","app_status").put("version_code",5))
    fun saveCentralContent(kind:String,itemId:String,content:JSONObject):JSONObject?{
        val result=request(JSONObject().put("action","content_upsert").put("token",token()).put("kind",kind).put("item_id",itemId).put("content",content).put("language","english"))
        if(result?.optBoolean("ok")==true) prefs.edit().putString("central_"+kind+"_"+itemId,content.toString()).apply()
        return result
    }
    fun deleteCentralContent(kind:String,itemId:String):JSONObject?{
        val result=request(JSONObject().put("action","content_delete").put("token",token()).put("kind",kind).put("item_id",itemId))
        if(result?.optBoolean("ok")==true) prefs.edit().remove("central_"+kind+"_"+itemId).apply()
        return result
    }
    fun syncCentralContent(result:JSONObject?){
        val arr=result?.optJSONArray("content") ?: return
        val active=mutableSetOf<String>()
        for(i in 0 until arr.length()){
            val x=arr.optJSONObject(i) ?: continue
            val kind=x.optString("kind"); val itemId=x.optString("item_id")
            if(kind!="grammar" && kind!="vocabulary" || itemId.isBlank()) continue
            val key="central_"+kind+"_"+itemId; active.add(key)
            prefs.edit().putString(key,x.optJSONObject("content")?.toString() ?: "{}").apply()
        }
        val e=prefs.edit()
        prefs.all.keys.filter{it.startsWith("central_grammar_")||it.startsWith("central_vocabulary_")}.filter{!active.contains(it)}.forEach{e.remove(it)}
        e.apply()
    }
    fun loadCentralGrammar():List<GrammarItem> = prefs.all.entries.filter{it.key.startsWith("central_grammar_")}.mapNotNull{entry->
        try{
            val x=JSONObject(entry.value as String); val g=x.optJSONObject("grammar") ?: x
            val arr=x.optJSONArray("examples") ?: g.optJSONArray("examples"); val ex=mutableListOf<String>()
            if(arr!=null) for(i in 0 until arr.length()) arr.optString(i).takeIf{it.isNotBlank()}?.let{ex.add(it)}
            GrammarItem(entry.key.removePrefix("central_grammar_"),x.optString("label",x.optString("title",x.optString("name","گرامر"))),g.optString("how",g.optString("use",g.optString("usage",""))),g.optString("formula",""),ex)
        }catch(_:Exception){null}
    }.sortedBy{it.title.lowercase()}
    fun loadCentralVocabulary():List<VocabularyItem> = prefs.all.entries.filter{it.key.startsWith("central_vocabulary_")}.mapNotNull{entry->
        try{
            val x=JSONObject(entry.value as String)
            VocabularyItem(entry.key.removePrefix("central_vocabulary_"),x.optString("word",x.optString("english",x.optString("term",""))),x.optString("persian",x.optString("meaning",x.optString("translation",""))),x.optString("partOfSpeech",x.optString("type","—")),x.optString("example",""))
        }catch(_:Exception){null}
    }.filter{it.word.isNotBlank()}.sortedBy{it.word.lowercase()}
    fun saveReview(states:Map<String,ReviewState>){
        val root=JSONObject()
        states.forEach{ (id,s)->root.put(id,JSONObject().put("score",s.score).put("streak",s.streak).put("reps",s.reps).put("lapses",s.lapses).put("correct",s.correct).put("wrong",s.wrong).put("total",s.total).put("interval",s.interval).put("next",s.next).put("ease",s.ease)) }
        prefs.edit().putString("review",root.toString()).apply()
        request(JSONObject().put("action","save_state").put("token",token()).put("state",JSONObject().put("native_review_state",root)))
    }
    fun loadReview():MutableMap<String,ReviewState>{
        val root=JSONObject(prefs.getString("review","{}") ?: "{}"); val out=mutableMapOf<String,ReviewState>()
        root.keys().forEach{ id-> val x=root.getJSONObject(id); out[id]=ReviewState(x.optInt("score"),x.optInt("streak"),x.optInt("reps"),x.optInt("lapses"),x.optInt("correct"),x.optInt("wrong"),x.optInt("total"),x.optDouble("interval"),x.optLong("next"),x.optDouble("ease",2.3)) }
        return out
    }
    fun event(name:String,product:String,ok:Boolean,id:String){
        request(JSONObject().put("action","event").put("token",token()).put("event_name",name).put("product_id",product)
            .put("event_payload",JSONObject().put("item_id",id).put("correct",ok)))
    }
    private fun request(body:JSONObject):JSONObject?=try{
        val c=URL(endpoint).openConnection() as HttpURLConnection
        c.requestMethod="POST"; c.connectTimeout=15000; c.readTimeout=15000; c.doOutput=true
        c.setRequestProperty("Content-Type","application/json")
        c.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
        val input=if(c.responseCode in 200..299)c.inputStream else c.errorStream
        JSONObject(input.bufferedReader().use{it.readText()})
    }catch(_:Exception){null}
}

object Srs {
    fun review(s:ReviewState,ok:Boolean){
        s.total++
        if(ok){
            s.correct++;s.streak++;s.reps++;s.lapses=max(0,s.lapses-1)
            s.ease=(s.ease+.03).coerceIn(1.3,2.8)
            val bases=listOf(.5,1.0,3.0,7.0,14.0,30.0,60.0)
            s.interval=max(bases[min(s.reps,6)],s.interval*s.ease).coerceIn(.25,120.0)
            s.score=(s.score+9+if(s.streak>=3)2 else 0).coerceIn(0,100)
        }else{
            s.wrong++;s.streak=0;s.lapses++;s.ease=(s.ease-.12).coerceIn(1.3,2.8);s.interval=.08;s.score=(s.score-15).coerceIn(0,100)
        }
        s.next=System.currentTimeMillis()+(s.interval*86400000).toLong()
    }
}

class MainActivity:ComponentActivity(){
    private lateinit var repo:Repository
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState);repo=Repository(this);handle(intent)
        setContent{CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl){MaterialTheme(colorScheme=lightColorScheme(primary=Color(0xFF176B87),secondary=Color(0xFF6658D3),tertiary=Color(0xFF238A78),background=Color(0xFFF4F7FB),surface=Color.White,surfaceVariant=Color(0xFFE8EFF6))){App(repo)}}}
    }
    override fun onNewIntent(i:Intent){super.onNewIntent(i);handle(i);recreate()}
    private fun handle(i:Intent?){
        val u=i?.data ?: return
        if(u.scheme!="langblue"||u.host!="auth") return
        u.getQueryParameter("token")?.takeIf{it.length==64}?.let{repo.setToken(it);return}
        val pairingId=u.getQueryParameter("pairing_id") ?: return
        val pairCode=u.getQueryParameter("pair_code") ?: return
        lifecycleScope.launch(Dispatchers.IO){
            val result=repo.pollPairing(pairingId,pairCode)
            if(result?.optBoolean("ok")==true && result.optString("token").length==64){
                repo.setToken(result.optString("token"))
                withContext(Dispatchers.Main){recreate()}
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(repo: Repository) {
    var screen by remember{mutableStateOf("home")}
    var connected by remember{mutableStateOf(repo.token()!=null)}
    var profile by remember{mutableStateOf<JSONObject?>(null)}
    var appStatus by remember{mutableStateOf<JSONObject?>(null)}
    LaunchedEffect(Unit){appStatus=withContext(Dispatchers.IO){repo.appStatus()}}
    LaunchedEffect(connected){if(connected){val result=withContext(Dispatchers.IO){repo.bootstrap()};if(result?.optBoolean("ok")==true){profile=result.optJSONObject("profile");repo.syncCentralContent(result)} else {repo.clearToken();connected=false}}}
    Scaffold(topBar={TopAppBar(title={Text("LangBlue")})},bottomBar={
        NavigationBar{listOf("home" to "خانه","grammar" to "Grammar","vocab" to "Vocabulary","account" to "حساب").forEach{(id,label)->NavigationBarItem(selected=screen==id,onClick={screen=id},icon={},label={Text(label)})}}
    }){p->Column(Modifier.padding(p).padding(16.dp).fillMaxSize()){
        when(screen){
            "grammar"->GrammarScreen(repo)
            "vocab"->VocabScreen(repo)
            "account"->AccountScreen(repo,profile,{repo.clearToken();connected=false;profile=null}){connected=true}
            else->Home(connected,profile,appStatus){screen=it}
        }
    }}
}

@Composable fun Home(connected:Boolean,profile:JSONObject?,appStatus:JSONObject?,go:(String)->Unit){
    val context=LocalContext.current
    Column{Image(painter=painterResource(id=R.drawable.ic_langblue_logo),contentDescription="نشان LangBlue",modifier=Modifier.size(112.dp).align(Alignment.CenterHorizontally)); Spacer(Modifier.height(12.dp)); Text("اپلیکیشن مستقل LangBlue",style=MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text("برای شروع، حساب مرورگر LangBlue را متصل کن.")
        Text(if(connected)"حساب مرکزی متصل است؛ داده‌ها با همان حساب همگام می‌شوند." else "اتصال حساب از طریق مرورگر انجام می‌شود.")
        profile?.optString("name")?.takeIf{it.isNotBlank()}?.let{Spacer(Modifier.height(12.dp));Text("سلام "+it)}
        Spacer(Modifier.height(20.dp))
        Button(onClick={go("grammar")},Modifier.fillMaxWidth()){Text("🧠 Grammar")}
        Spacer(Modifier.height(8.dp))
        Button(onClick={go("vocab")},Modifier.fillMaxWidth()){Text("📚 Vocabulary")}
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick={context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://lngbl.github.io/#leaderboard")))},Modifier.fillMaxWidth()){Text("🏆 معرفی و دیدن رقابت‌ها")}
        appStatus?.optJSONObject("maintenance")?.let{m->Spacer(Modifier.height(12.dp));Text("🛠 "+m.optString("message","LangBlue برای تعمیرات کوتاه‌مدت در دسترس نیست."),color=MaterialTheme.colorScheme.error)}
        if(!connected){Spacer(Modifier.height(12.dp));Text("اتصال حساب از طریق مرورگر انجام می‌شود.",fontSize=12.sp)}
    }
}

@Composable
fun AccountScreen(repo:Repository,profile:JSONObject?,disconnect:()->Unit,onPaired:()->Unit){
    var username by remember { mutableStateOf(profile?.optString("username","") ?: "") }
    var status by remember { mutableStateOf(if(profile==null) "نام کاربری حساب اصلی را وارد کن." else "") }
    var pairingId by remember { mutableStateOf<String?>(null) }
    var pairCode by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(pairingId,pairCode){
        val id=pairingId ?: return@LaunchedEffect
        val code=pairCode ?: return@LaunchedEffect
        while(true){
            val result=withContext(Dispatchers.IO){repo.pollPairing(id,code)}
            when(result?.optString("status")){
                "approved"->{
                    val token=result.optString("token")
                    if(token.length==64){repo.setToken(token);status="اتصال تأیید شد.";onPaired();break}
                }
                "rejected"->{status="درخواست اتصال توسط دستگاه اصلی رد شد.";break}
                "expired"->{status="درخواست اتصال منقضی شد.";break}
            }
            kotlinx.coroutines.delay(3000)
        }
    }
    Column{
        Text("حساب LangBlue",style=MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(12.dp))
        if(profile!=null){
            Text("نام: "+profile.optString("name","—"))
            Text("نام کاربری: @"+profile.optString("username","—"))
            Text("سطح انگلیسی: "+profile.optString("english_level","—"))
            Spacer(Modifier.height(18.dp))
        }
        Text("اتصال این گوشی فقط از طریق حساب اصلی انجام می‌شود؛ مرورگر گوشی دیگر مرحله تأیید نیست.",fontSize=13.sp)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(value=username,onValueChange={username=it},label={Text("نام کاربری حساب اصلی")},singleLine=true,modifier=Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        Button(enabled=username.trim().length>=3 && pairingId==null,onClick={
            status="در حال ارسال درخواست به حساب اصلی…"
            scope.launch(Dispatchers.IO) {
                val result=repo.requestPairing(username)
                withContext(Dispatchers.Main){
            if(result?.optBoolean("ok")==true){
                pairingId=result.optString("pairing_id");pairCode=repo.currentPairCode()
                status="درخواست ثبت شد. اکنون در لپ‌تاپ/دستگاه اصلی، داخل حساب LangBlue، درخواست این گوشی را تأیید کن."
            }else status=when(result?.optString("error")){"USERNAME_NOT_FOUND"->"این نام کاربری پیدا نشد." else->"ارسال درخواست اتصال ناموفق بود؛ دوباره تلاش کن."}
                }
            }
        },modifier=Modifier.fillMaxWidth()){Text("📱 درخواست اتصال به حساب")}
        if(status.isNotBlank()){Spacer(Modifier.height(10.dp));Text(status)}
        if(profile!=null){Spacer(Modifier.height(10.dp));OutlinedButton(onClick=disconnect,Modifier.fillMaxWidth()){Text("قطع اتصال این دستگاه")}}
    }
}

@Composable
fun GrammarScreen(repo:Repository) {
    var grammar by remember { mutableStateOf(repo.loadCentralGrammar()) }
    var title by remember { mutableStateOf("") }
    var usage by remember { mutableStateOf("") }
    var formula by remember { mutableStateOf("") }
    var examples by remember { mutableStateOf("") }
    val scope=rememberCoroutineScope()
    LaunchedEffect(Unit) {
        while(true) {
            val result=withContext(Dispatchers.IO){repo.bootstrap()}
            if(result?.optBoolean("ok")==true){repo.syncCentralContent(result);grammar=repo.loadCentralGrammar()}
            kotlinx.coroutines.delay(12000)
        }
    }
    LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp),modifier=Modifier.fillMaxSize()) {
        item {
            Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.padding(18.dp)) {
                    Text("گرامرهای حساب تو",style=MaterialTheme.typography.headlineSmall)
                    Text("فهرست از حساب مرکزی LangBlue دریافت و هر ۱۲ ثانیه تازه می‌شود.")
                    Text("${grammar.size} مورد")
                }
            }
        }
        item {
            Card {
                Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text("افزودن گرامر به حساب",style=MaterialTheme.typography.titleMedium)
                    OutlinedTextField(value=title,onValueChange={title=it},label={Text("نام گرامر")},singleLine=true,modifier=Modifier.fillMaxWidth())
                    OutlinedTextField(value=usage,onValueChange={usage=it},label={Text("کاربرد")},modifier=Modifier.fillMaxWidth())
                    OutlinedTextField(value=formula,onValueChange={formula=it},label={Text("فرمول")},modifier=Modifier.fillMaxWidth())
                    OutlinedTextField(value=examples,onValueChange={examples=it},label={Text("مثال‌ها، هر خط یک مثال")},minLines=2,modifier=Modifier.fillMaxWidth())
                    Button(enabled=title.isNotBlank()&&formula.isNotBlank(),onClick={
                        val id=UUID.randomUUID().toString()
                        val lines=examples.split("\n").map{it.trim()}.filter{it.isNotBlank()}
                        val data=JSONObject().put("label",title.trim()).put("how",usage.trim()).put("formula",formula.trim()).put("examples",org.json.JSONArray(lines))
                        scope.launch(Dispatchers.IO) {
                            val saved=repo.saveCentralContent("grammar",id,data)
                            val fresh=repo.bootstrap()
                            withContext(Dispatchers.Main) {
                                if(saved?.optBoolean("ok")==true) {
                                    if(fresh?.optBoolean("ok")==true)repo.syncCentralContent(fresh)
                                    grammar=repo.loadCentralGrammar();title="";usage="";formula="";examples=""
                                }
                            }
                        }
                    },modifier=Modifier.fillMaxWidth()){Text("ذخیره گرامر")}
                }
            }
        }
        if(grammar.isEmpty()) item { Text("هنوز گرامری برای این حساب همگام نشده است.") }
        items(grammar,key={it.id}) { g ->
            Card {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Text(g.title,style=MaterialTheme.typography.titleLarge)
                    if(g.use.isNotBlank()) Text(g.use,color=MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(g.formula,color=MaterialTheme.colorScheme.primary)
                    g.examples.forEach { Text("• $it") }
                }
            }
        }
    }
}

@Composable
fun VocabScreen(repo:Repository) {
    var vocabulary by remember { mutableStateOf(repo.loadCentralVocabulary()) }
    var english by remember { mutableStateOf("") }
    var persian by remember { mutableStateOf("") }
    var partOfSpeech by remember { mutableStateOf("noun") }
    val scope=rememberCoroutineScope()
    LaunchedEffect(Unit) {
        while(true) {
            val result=withContext(Dispatchers.IO){repo.bootstrap()}
            if(result?.optBoolean("ok")==true){repo.syncCentralContent(result);vocabulary=repo.loadCentralVocabulary()}
            kotlinx.coroutines.delay(12000)
        }
    }
    LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp),modifier=Modifier.fillMaxSize()) {
        item {
            Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.padding(18.dp)) {
                    Text("واژگان حساب تو",style=MaterialTheme.typography.headlineSmall)
                    Text("جدول حساب مرکزی · تلفظ با صدای سیستم")
                    Text("${vocabulary.size} واژه")
                }
            }
        }
        item {
            Card {
                Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text("افزودن واژه به حساب",style=MaterialTheme.typography.titleMedium)
                    OutlinedTextField(value=english,onValueChange={english=it},label={Text("English")},singleLine=true,modifier=Modifier.fillMaxWidth())
                    OutlinedTextField(value=persian,onValueChange={persian=it},label={Text("ترجمه فارسی")},singleLine=true,modifier=Modifier.fillMaxWidth())
                    OutlinedTextField(value=partOfSpeech,onValueChange={partOfSpeech=it},label={Text("نوع کلمه")},singleLine=true,modifier=Modifier.fillMaxWidth())
                    Button(enabled=english.isNotBlank()&&persian.isNotBlank(),onClick={
                        val id=UUID.randomUUID().toString()
                        val data=JSONObject().put("word",english.trim()).put("english",english.trim()).put("persian",persian.trim()).put("meaning",persian.trim()).put("partOfSpeech",partOfSpeech.trim())
                        scope.launch(Dispatchers.IO) {
                            val saved=repo.saveCentralContent("vocabulary",id,data)
                            val fresh=repo.bootstrap()
                            withContext(Dispatchers.Main) {
                                if(saved?.optBoolean("ok")==true) {
                                    if(fresh?.optBoolean("ok")==true)repo.syncCentralContent(fresh)
                                    vocabulary=repo.loadCentralVocabulary();english="";persian="";partOfSpeech="noun"
                                }
                            }
                        }
                    },modifier=Modifier.fillMaxWidth()){Text("ذخیره واژه")}
                }
            }
        }
        item {
            Card {
                Column(Modifier.padding(10.dp)) {
                    Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant).padding(8.dp),verticalAlignment=Alignment.CenterVertically) {
                        Text("English",Modifier.weight(1.1f),style=MaterialTheme.typography.labelLarge)
                        Text("فارسی",Modifier.weight(1.1f),style=MaterialTheme.typography.labelLarge)
                        Text("نوع کلمه",Modifier.weight(.9f),style=MaterialTheme.typography.labelLarge)
                        Text("صوت",Modifier.weight(.6f),style=MaterialTheme.typography.labelLarge)
                    }
                    if(vocabulary.isEmpty()) Text("هنوز واژه‌ای برای این حساب همگام نشده است.",Modifier.padding(16.dp))
                    vocabulary.forEachIndexed { index,v ->
                        Row(Modifier.fillMaxWidth().background(if(index%2==0)MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant.copy(alpha=.45f)).padding(6.dp),verticalAlignment=Alignment.CenterVertically) {
                            Text(v.word,Modifier.weight(1.1f))
                            Text(v.meaning,Modifier.weight(1.1f))
                            Text(v.partOfSpeech,Modifier.weight(.9f))
                            Box(Modifier.weight(.6f),contentAlignment=Alignment.Center){SpeakEnglishButton(v.word)}
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
