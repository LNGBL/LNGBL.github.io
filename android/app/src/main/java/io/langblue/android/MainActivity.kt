package io.langblue.android

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

data class GrammarItem(val id:String,val title:String,val use:String,val formula:String,val examples:List<String>)
data class VocabularyItem(val id:String,val word:String,val meaning:String,val example:String)
data class ReviewState(var score:Int=0,var streak:Int=0,var reps:Int=0,var lapses:Int=0,var correct:Int=0,var wrong:Int=0,var total:Int=0,var interval:Double=0.0,var next:Long=0,var ease:Double=2.3)

object Content {
    val grammar=listOf(
        GrammarItem("present-simple","Present Simple","عادت و حقیقت","Subject + base verb / s",listOf("I work every day.")),
        GrammarItem("present-continuous","Present Continuous","عمل در حال انجام","am/is/are + verb-ing",listOf("She is studying now.")),
        GrammarItem("past-simple","Past Simple","رویداد کامل‌شده در گذشته","Subject + past verb",listOf("They visited London yesterday.")),
        GrammarItem("present-perfect","Present Perfect","تجربه یا نتیجه مرتبط با اکنون","have/has + past participle",listOf("I have visited Paris.")),
        GrammarItem("past-continuous","Past Continuous","عمل در جریان در گذشته","was/were + verb-ing",listOf("I was reading at eight.")),
        GrammarItem("future-will","Future with Will","پیش‌بینی، تصمیم یا وعده","will + base verb",listOf("I will help you.")),
        GrammarItem("going-to","Be Going To","قصد یا پیش‌بینی مبتنی بر شواهد","am/is/are going to + verb",listOf("We are going to travel.")),
        GrammarItem("comparatives","Comparatives","مقایسه دو چیز","adj-er / more + adjective",listOf("This book is cheaper.")),
        GrammarItem("zero-conditional","Zero Conditional","حقیقت عمومی","If + present, present",listOf("If water boils, it evaporates.")),
        GrammarItem("first-conditional","First Conditional","شرط محتمل آینده","If + present, will + verb",listOf("If it rains, we will stay home.")),
        GrammarItem("passive","Passive Voice","تمرکز روی عمل","be + past participle",listOf("The book was written in 2020.")),
        GrammarItem("should","Should","توصیه و پیشنهاد","should + base verb",listOf("You should practice daily."))
    )
    val vocabulary=listOf(
        VocabularyItem("achieve","achieve","به‌دست آوردن","She achieved her goal."),
        VocabularyItem("adapt","adapt","سازگار شدن","Students adapt to new routines."),
        VocabularyItem("approach","approach","رویکرد","We need a better approach."),
        VocabularyItem("benefit","benefit","مزیت","Practice has many benefits."),
        VocabularyItem("challenge","challenge","چالش","This task is a challenge."),
        VocabularyItem("compare","compare","مقایسه کردن","Compare the two examples."),
        VocabularyItem("context","context","بافت / زمینه","Learn the word in context."),
        VocabularyItem("develop","develop","توسعه دادن","You can develop this skill."),
        VocabularyItem("exposure","exposure","مواجهه","Regular exposure helps learning."),
        VocabularyItem("feedback","feedback","بازخورد","Good feedback improves practice."),
        VocabularyItem("habit","habit","عادت","Reading can become a habit."),
        VocabularyItem("maintain","maintain","حفظ کردن","Maintain a regular routine."),
        VocabularyItem("pattern","pattern","الگو","Notice the sentence pattern."),
        VocabularyItem("progress","progress","پیشرفت","Progress takes time."),
        VocabularyItem("recall","recall","به یاد آوردن","Try to recall the rule."),
        VocabularyItem("reinforce","reinforce","تقویت کردن","Reviews reinforce memory."),
        VocabularyItem("retrieve","retrieve","بازیابی کردن","Retrieve the word before looking."),
        VocabularyItem("sequence","sequence","توالی","Follow the learning sequence."),
        VocabularyItem("strategy","strategy","راهبرد","Choose a useful strategy.")
    )
}

class Repository(private val context:Context) {
    private val prefs=context.getSharedPreferences("langblue_native",Context.MODE_PRIVATE)
    private val endpoint="https://ocxeyponzzcvlrvwndji.supabase.co/functions/v1/langblue-android-handoff"

    fun token():String?=prefs.getString("token",null)
    fun setToken(t:String)=prefs.edit().putString("token",t).apply()
    fun clearToken()=prefs.edit().remove("token").apply()

    private fun deviceKey():String = prefs.getString("device_key",null) ?: UUID.randomUUID().toString().replace("-","").also { prefs.edit().putString("device_key",it).apply() }
    private fun deviceLabel():String = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}".trim().ifBlank{"Android device"}
    private fun appVersion():String = "1.0.2"
    fun openBrowser(){
        val pair=UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-","")
        prefs.edit().putString("pair_code",pair).apply()
        val url="https://lngbl.github.io/android-auth.html?pair="+Uri.encode(pair)+"&dk="+Uri.encode(deviceKey())+"&device="+Uri.encode(deviceLabel())+"&version="+Uri.encode(appVersion())
        context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)))
    }
    fun pollPairing(pairingId:String,pairCode:String):JSONObject? =
        request(JSONObject().put("action","poll_pairing").put("pairing_id",pairingId).put("pair_code",pairCode).put("device_key",deviceKey()).put("device_label",deviceLabel()).put("app_version",appVersion()))

    fun bootstrap():JSONObject?=request(JSONObject().put("action","bootstrap").put("token",token()))
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
        setContent{CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl){MaterialTheme{App(repo)}}}
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
    LaunchedEffect(connected){if(connected){val result=withContext(Dispatchers.IO){repo.bootstrap()};if(result?.optBoolean("ok")==true)profile=result.optJSONObject("profile") else {repo.clearToken();connected=false}}}
    Scaffold(topBar={TopAppBar(title={Text("🔷 LangBlue Native")})},bottomBar={
        NavigationBar{listOf("home" to "خانه","grammar" to "Grammar","vocab" to "Vocabulary","account" to "حساب").forEach{(id,label)->NavigationBarItem(selected=screen==id,onClick={screen=id},icon={},label={Text(label)})}}
    }){p->Column(Modifier.padding(p).padding(16.dp).fillMaxSize()){
        when(screen){
            "grammar"->GrammarScreen(repo)
            "vocab"->VocabScreen(repo)
            "account"->AccountScreen(repo,profile,{repo.clearToken();connected=false;profile=null})
            else->Home(connected,profile){screen=it}
        }
    }}
}

@Composable fun Home(connected:Boolean,profile:JSONObject?,go:(String)->Unit){
    Column{Text("اپلیکیشن مستقل LangBlue",style=MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(if(connected)"حساب مرورگر متصل است؛ داده‌ها از همان حساب دریافت می‌شوند." else "برای شروع، حساب مرورگر LangBlue را متصل کن.")
        profile?.optString("name")?.takeIf{it.isNotBlank()}?.let{Spacer(Modifier.height(12.dp));Text("سلام "+it)}
        Spacer(Modifier.height(20.dp))
        Button(onClick={go("grammar")},Modifier.fillMaxWidth()){Text("🧠 Grammar")}
        Spacer(Modifier.height(8.dp))
        Button(onClick={go("vocab")},Modifier.fillMaxWidth()){Text("📚 Vocabulary")}
        if(!connected){Spacer(Modifier.height(12.dp));Text("اتصال حساب از طریق مرورگر انجام می‌شود.",fontSize=12.sp)}
    }
}

@Composable fun AccountScreen(repo:Repository,profile:JSONObject?,disconnect:()->Unit){
    Column{Text("حساب مرورگر",style=MaterialTheme.typography.headlineSmall);Spacer(Modifier.height(12.dp))
        Text("نام: "+(profile?.optString("name","—")?:"—"))
        Text("نام کاربری: "+(profile?.optString("username","—")?:"—"))
        Text("سطح انگلیسی: "+(profile?.optString("english_level","—")?:"—"))
        Spacer(Modifier.height(18.dp));Button(onClick={repo.openBrowser()},Modifier.fillMaxWidth()){Text("بازکردن اتصال مرورگر")}
        Spacer(Modifier.height(8.dp));OutlinedButton(onClick=disconnect,Modifier.fillMaxWidth()){Text("قطع اتصال این دستگاه")}
    }
}

@Composable
fun GrammarScreen(repo: Repository) {
    val states = remember { mutableStateOf(repo.loadReview()) }
    var current by remember { mutableStateOf<GrammarItem?>(null) }
    var answered by remember { mutableStateOf(false) }
    var options by remember { mutableStateOf<List<String>>(emptyList()) }

    if (current == null) {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Text("Grammar", style = MaterialTheme.typography.headlineSmall)
                Text("موتور تمرین و SRS کاملاً Native Kotlin است.")
            }
            items(Content.grammar) { g ->
                val score = states.value[g.id]?.score ?: 0
                Card {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(g.title)
                            Text(score.toString() + "% • " + g.use, fontSize = 12.sp)
                        }
                        Button(onClick = {
                            current = g
                            answered = false
                            val distractors = Content.grammar
                                .filter { it.id != g.id }
                                .shuffled()
                                .take(3)
                                .map { it.formula }
                            options = (listOf(g.formula) + distractors).shuffled()
                        }) {
                            Text("تمرین")
                        }
                    }
                }
            }
        }
    } else {
        val g = current!!
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(g.title, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(8.dp))
            Text(g.use)
            Spacer(Modifier.height(14.dp))
            Text("فرمول درست را انتخاب کن")
            Spacer(Modifier.height(8.dp))
            options.forEach { option ->
                OutlinedButton(
                    onClick = {
                        if (!answered) {
                            answered = true
                            val ok = option == g.formula
                            val state = states.value.getOrPut(g.id) { ReviewState() }
                            Srs.review(state, ok)
                            repo.saveReview(states.value)
                            repo.event("content_answered", "grammar", ok, g.id)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(3.dp)
                ) {
                    Text(option)
                }
            }
            if (answered) {
                Spacer(Modifier.height(8.dp))
                Text(g.examples.first())
                Button(onClick = { current = null }) { Text("بازگشت") }
            }
        }
    }
}

@Composable
fun VocabScreen(repo: Repository) {
    val states = remember { mutableStateOf(repo.loadReview()) }
    var current by remember { mutableStateOf<VocabularyItem?>(null) }
    var answered by remember { mutableStateOf(false) }
    var options by remember { mutableStateOf<List<String>>(emptyList()) }

    if (current == null) {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Text("Vocabulary", style = MaterialTheme.typography.headlineSmall)
                Text("فلش‌کارت چهارگزینه‌ای با مرور فاصله‌دار.")
            }
            items(Content.vocabulary) { v ->
                val score = states.value[v.id]?.score ?: 0
                Card {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(v.word)
                            Text(v.meaning + " • " + score + "%", fontSize = 12.sp)
                        }
                        Button(onClick = {
                            current = v
                            answered = false
                            val distractors = Content.vocabulary
                                .filter { it.id != v.id }
                                .shuffled()
                                .take(3)
                                .map { it.meaning }
                            options = (listOf(v.meaning) + distractors).shuffled()
                        }) {
                            Text("مرور")
                        }
                    }
                }
            }
        }
    } else {
        val v = current!!
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(v.word, style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(10.dp))
            Text("معنی درست را انتخاب کن")
            Spacer(Modifier.height(8.dp))
            options.forEach { option ->
                OutlinedButton(
                    onClick = {
                        if (!answered) {
                            answered = true
                            val ok = option == v.meaning
                            val state = states.value.getOrPut(v.id) { ReviewState() }
                            Srs.review(state, ok)
                            repo.saveReview(states.value)
                            repo.event("content_answered", "vocabulary", ok, v.id)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(3.dp)
                ) {
                    Text(option)
                }
            }
            if (answered) {
                Spacer(Modifier.height(8.dp))
                Text(v.example)
                Button(onClick = { current = null }) { Text("بازگشت") }
            }
        }
    }
}
