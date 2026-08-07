import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.FileInputStream
import java.util.Properties
import javax.imageio.ImageIO

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val majarraLogoSource = file("../../assets/brand/majarra-logo.png")
val majarraGeneratedResDir = layout.buildDirectory.dir("generated/majarra-brand/res").get().asFile
val prepareMajarBrandResources = tasks.register("prepareMajarBrandResources") {
    inputs.file(majarraLogoSource)
    outputs.dir(majarraGeneratedResDir)

    doLast {
        val source = ImageIO.read(majarraLogoSource)
            ?: error("Unable to decode Majarra logo: $majarraLogoSource")

        fun writeImage(image: BufferedImage, outputName: String, width: Int, height: Int) {
            val output = majarraGeneratedResDir.resolve("drawable-nodpi/$outputName")
            output.parentFile.mkdirs()
            val target = BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB)
            val graphics = target.createGraphics()
            try {
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
                graphics.drawImage(image, 0, 0, width, height, null)
            } finally {
                graphics.dispose()
            }
            ImageIO.write(target, "png", output)
        }

        val splashScale = minOf(720.0 / source.width, 480.0 / source.height)
        writeImage(
            source,
            "majarra_splash_logo.png",
            (source.width * splashScale).toInt(),
            (source.height * splashScale).toInt(),
        )

        val iconSize = minOf(source.width, source.height)
        val iconX = (source.width - iconSize) / 2
        val iconY = (source.height - iconSize) / 2
        writeImage(
            source.getSubimage(iconX, iconY, iconSize, iconSize),
            "majarra_launcher_icon.png",
            432,
            432,
        )
    }
}

// --- Release signing -------------------------------------------------------
// Credentials live in android/key.properties, which is gitignored and must
// never be committed. See android/key.properties.example for the format and
// the keytool command that generates the keystore.
//
// If the file is absent, release builds FAIL rather than silently producing an
// unsigned or debug-signed APK. Debug builds are unaffected.
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
val keystoreProperties = Properties().apply {
    if (hasReleaseKeystore) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}

fun missingKeystoreMessage(): String = """
    |
    | ============================================================
    |  RELEASE BUILD BLOCKED: no signing configuration
    | ============================================================
    |  Expected: ${keystorePropertiesFile.absolutePath}
    |
    |  An unsigned APK/AAB cannot be installed on a device or
    |  uploaded to Google Play, so this build fails on purpose
    |  instead of producing an artifact that looks valid.
    |
    |  1. Generate an upload keystore (keep it OUT of the repo):
    |       keytool -genkeypair -v \
    |         -keystore <path-outside-repo>/majarra-upload.jks \
    |         -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 \
    |         -alias majarra-upload
    |
    |  2. Copy android/key.properties.example to android/key.properties
    |     and fill in storeFile / storePassword / keyAlias / keyPassword.
    |
    |  3. Back the keystore up. Losing it means you can never ship an
    |     update to the same Play listing again.
    |
    |  Debug builds do not need any of this: use --debug.
    | ============================================================
""".trimMargin()

android {
    namespace = "com.majarra.majarra"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "com.majarra.majarra"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                val storeFilePath = keystoreProperties.getProperty("storeFile")
                    ?: throw GradleException("key.properties is missing 'storeFile'.")
                storeFile = file(storeFilePath)
                storePassword = keystoreProperties.getProperty("storePassword")
                    ?: throw GradleException("key.properties is missing 'storePassword'.")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                    ?: throw GradleException("key.properties is missing 'keyAlias'.")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                    ?: throw GradleException("key.properties is missing 'keyPassword'.")
            }
        }
    }

    buildTypes {
        getByName("release") {
            // Left unset when no keystore is present; the verifyReleaseSigning
            // task below fails the build before an artifact is produced.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                null
            }
        }
    }

    sourceSets {
        getByName("main") {
            res.srcDir(majarraGeneratedResDir)
        }
    }
}

// Fails only when a release artifact is actually requested, so debug builds and
// plain `./gradlew tasks` keep working without a keystore.
val verifyReleaseSigning = tasks.register("verifyReleaseSigning") {
    doFirst {
        if (!hasReleaseKeystore) {
            throw GradleException(missingKeystoreMessage())
        }
    }
}

tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }
    .configureEach { dependsOn(verifyReleaseSigning) }


tasks.named("preBuild").configure {
    dependsOn(prepareMajarBrandResources)
}

flutter {
    source = "../.."
}
