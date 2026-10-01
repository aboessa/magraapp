package com.majarra.majarra

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// FlutterFragmentActivity (rather than FlutterActivity) is required by the
// local_auth plugin: the biometric prompt is a FragmentActivity-hosted dialog.
class MainActivity : FlutterFragmentActivity() {
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

    /// SEC-107: root/emulator/debugger signals.
    ///
    /// These are hints, not a verdict. Every one of them is defeatable by the
    /// device they run on, and every one of them has false positives: a
    /// developer handset, a custom ROM, an emulator our own team uses. The
    /// policy that consumes them lives on the server and never blocks
    /// playback — it only shortens offline licence lifetime.
    ///
    /// No PII is collected: booleans only. Not the build fingerprint, not the
    /// model, not the installed package list. `root_manager_app` deliberately
    /// probes three known paths rather than enumerating packages, because the
    /// package list is a profile of the user and this is not.
    private fun deviceIntegrity(): Map<String, Boolean> {
        val suPaths = listOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su",
            "/system/app/Superuser.apk", "/data/local/bin/su", "/data/local/xbin/su",
        )
        val magiskPaths = listOf("/sbin/.magisk", "/data/adb/magisk", "/data/adb/modules")
        val managerPaths = listOf(
            "/data/data/com.topjohnwu.magisk",
            "/data/data/eu.chainfire.supersu",
            "/data/data/com.noshufou.android.su",
        )
        val hookingPaths = listOf(
            "/data/local/tmp/frida-server",
            "/data/local/tmp/re.frida.server",
        )

        // Emulator detection stays coarse on purpose: the goal is "not a real
        // handset", and finer probes read more device detail for no gain.
        val fingerprint = android.os.Build.FINGERPRINT
        val emulator = fingerprint.startsWith("generic") ||
            fingerprint.contains("vbox") ||
            fingerprint.contains("emulator") ||
            android.os.Build.MODEL.contains("sdk_gphone") ||
            android.os.Build.PRODUCT == "sdk"

        return mapOf(
            "root_binaries" to (exists(suPaths) || exists(magiskPaths)),
            "root_manager_app" to exists(managerPaths),
            "test_keys" to (android.os.Build.TAGS?.contains("test-keys") == true),
            "hooking" to exists(hookingPaths),
            "emulator" to emulator,
            "debugger" to android.os.Debug.isDebuggerConnected(),
        )
    }

    /// A missing path and an unreadable path are the same answer: not found.
    /// A SecurityException on a probe is normal on a locked-down device and
    /// must not be reported as a positive.
    private fun exists(paths: List<String>) = paths.any {
        try {
            java.io.File(it).exists()
        } catch (_: SecurityException) {
            false
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
                        getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
                    val isTvMode = uiModeManager?.currentModeType ==
                        Configuration.UI_MODE_TYPE_TELEVISION
                    val hasLeanback =
                        packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_LEANBACK)
                    val hasTvFeature =
                        packageManager.hasSystemFeature("android.hardware.type.television")
                    val isFireTv =
                        packageManager.hasSystemFeature("amazon.hardware.fire_tv")
                    val isNoTouchScreen =
                        !packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN)
                    result.success(isTvMode || hasLeanback || hasTvFeature || isFireTv || isNoTouchScreen)
                }

                "setSecureFlag" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    setSecure(enabled)
                    result.success(null)
                }

                "deviceIntegrity" -> result.success(deviceIntegrity())

                // TV-004: a seed that survives reinstalling the app, so a
                // reinstalled TV is the same device rather than a new one taking
                // another slot. Since Android 8 ANDROID_ID is scoped to this
                // app's signing key and user, so it cannot correlate us with
                // other apps; the Dart side hashes it before it leaves the device.
                "installationSeed" -> result.success(
                    android.provider.Settings.Secure.getString(
                        contentResolver,
                        android.provider.Settings.Secure.ANDROID_ID,
                    ),
                )

                // TV-004: tells two TVs apart in the family's list and the cast
                // sheet ("تلفزيون Xiaomi MIBOX4" rather than two "تلفزيون").
                "deviceLabel" -> result.success(
                    listOf(android.os.Build.MANUFACTURER, android.os.Build.MODEL)
                        .filter { !it.isNullOrBlank() }
                        .distinct()
                        .joinToString(" ")
                        .take(40),
                )

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
