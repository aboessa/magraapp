import java.awt.RenderingHints
import java.awt.image.BufferedImage
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
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.majarra.majarra"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    sourceSets {
        getByName("main") {
            res.srcDir(majarraGeneratedResDir)
        }
    }

    // Release signing is intentionally not configured with debug credentials.
    // Add a protected upload keystore before producing a distributable release.
}

tasks.named("preBuild").configure {
    dependsOn(prepareMajarBrandResources)
}

flutter {
    source = "../.."
}
