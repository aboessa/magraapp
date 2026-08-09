package com.majarra.majarra

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val deviceChannel = "com.majarra/device"

    /// Toggles FLAG_SECURE, which blocks screenshots, screen recording, and
    /// mirroring to non-secure displays for this window.
    ///
    /// This is applied only while a licensed video is on screen rather than for
    /// the whole app: FLAG_SECURE also blocks legitimate screenshots of ordinary
    /// screens, and on some devices it interferes with accessibility tooling.
    /// Restricting it to playback keeps the protection targeted.
    ///
    /// This is a deterrent, not DRM. It stops the platform screen-capture APIs;
    /// it does not stop an external camera or a rooted device. Real content
    /// protection needs Widevine, which requires a licence server.
    private fun setSecure(enabled: Boolean) {
        runOnUiThread {
            if (enabled) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            deviceChannel,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "isTelevision" -> {
                    val uiModeManager =
                        getSystemService(Context.UI_MODE_SERVICE) as UiModeManager
                    result.success(
                        uiModeManager.currentModeType ==
                            Configuration.UI_MODE_TYPE_TELEVISION,
                    )
                }

                "setSecureFlag" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    setSecure(enabled)
                    result.success(null)
                }

                else -> result.notImplemented()
            }
        }
    }

    override fun onDestroy() {
        // The flag lives on the window, so clear it if the activity goes away
        // while playback was still active.
        setSecure(false)
        super.onDestroy()
    }
}
