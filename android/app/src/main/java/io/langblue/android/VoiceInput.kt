package io.langblue.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

@Composable
fun VoiceInputButton(onText:(String)->Unit){
    val context=LocalContext.current
    val recognizer=rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()){result->
        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let{if(it.isNotBlank())onText(it)}
    }
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){ok->
        if(ok) recognizer.launch(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply{
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE,"en-US")
        })
    }
    OutlinedButton(onClick={
        val intent=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply{
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE,"en-US")
        }
        if(ContextCompat.checkSelfPermission(context,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED) recognizer.launch(intent)
        else permission.launch(Manifest.permission.RECORD_AUDIO)
    },modifier=Modifier.fillMaxWidth()){Text("🎙 بیان صوتی")}
}