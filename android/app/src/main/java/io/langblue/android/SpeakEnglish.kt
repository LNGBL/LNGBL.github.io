package io.langblue.android

import android.speech.tts.TextToSpeech
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

@Composable
fun SpeakEnglishButton(text: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var ready by remember { mutableStateOf(false) }
    val tts = remember(context) {
        TextToSpeech(context) { status -> ready = status == TextToSpeech.SUCCESS }
    }
    DisposableEffect(tts) { onDispose { tts.stop(); tts.shutdown() } }
    OutlinedButton(
        enabled = ready && text.isNotBlank(),
        onClick = {
            tts.language = Locale.US
            tts.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, null, "langblue-english")
        },
        modifier = modifier.fillMaxWidth()
    ) { Text("🔊 خواندن انگلیسی") }
}
