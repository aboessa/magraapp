# R8 / ProGuard rules for Majarra release builds.
#
# Enabled from build.gradle.kts alongside isShrinkResources. Without these the
# shrinker strips classes that are only reached reflectively or from native
# code, which fails at runtime rather than at build time — the worst kind of
# regression to discover after upload.

# --- Flutter engine --------------------------------------------------------
# Referenced from native code via JNI, so R8 cannot see the usage.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# --- video_player / ExoPlayer (Media3) -------------------------------------
# Players and renderers are instantiated reflectively by Media3, and the
# library ships optional codecs whose absence is expected.
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# --- flutter_secure_storage -----------------------------------------------
# Backed by EncryptedSharedPreferences; androidx.security resolves its keyset
# handlers by class name through Tink.
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**

# --- Kotlin metadata -------------------------------------------------------
# Needed for reflection over Kotlin classes in MainActivity and plugins.
-keep class kotlin.Metadata { *; }
-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod

# --- Crash diagnostics ----------------------------------------------------
# Keep line numbers so a stack trace captured by CrashReporter stays readable,
# but hide the original source file name.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Play Core -------------------------------------------------------------
# Flutter's deferred-components support references these even when the app does
# not use deferred loading, producing missing-class warnings that fail the build.
-dontwarn com.google.android.play.core.**
