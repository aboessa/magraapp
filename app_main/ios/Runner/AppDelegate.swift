import Flutter
import UIKit

/// ENC-014 — رصد تسجيل الشاشة والمرآة على منصّات Apple.
///
/// ## لماذا رصد لا منع
///
/// لا واجهة عامة على iOS/iPadOS/tvOS تمنع تسجيل الشاشة أو المرآة كما يفعل
/// `FLAG_SECURE` على Android. المتاح `UIScreen.isCaptured` (iOS 11+): إشارة
/// تصير `true` عند تسجيل الشاشة، وعند المرآة، وعند AirPlay. فالسلوك الممكن —
/// وهو ما تطلبه §24 من خطة الحماية — أن نرصد فيوقف التطبيق المحتوى، لا أن نمنع.
///
/// الحدّ صريح: كاميرا خارجية لا تُرصد على أي منصّة، والمنع الحقيقي للتدفق يحتاج
/// DRM بخادم تراخيص (`ENC-009`).
///
/// ## القناة
///
/// `com.majarra/device` هي نفس قناة Android حتى لا يفترق عقد الطرفين:
///   * `isTelevision` — يقابل `UI_MODE_TYPE_TELEVISION` هناك.
///   * `isCaptured` — الحالة الآن.
///   * `setSecureFlag` — **لا مقابل له هنا**، ويردّ `notImplemented` صراحةً بدل
///     أن يردّ نجاحًا كاذبًا يجعل طبقة Dart تظن أن النافذة محميّة وهي ليست.
///
/// و`com.majarra/device/capture` تدفّق تغيّرات، لا استقصاء دوري: الاستقصاء إمّا
/// متأخّر فتُسجَّل ثوانٍ قبل أن نلاحظ، وإمّا مكلف على البطارية أثناء التشغيل.
@main
@objc class AppDelegate: FlutterAppDelegate {
  private var captureSink: FlutterEventSink?
  private var observers: [NSObjectProtocol] = []

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    if let controller = window?.rootViewController as? FlutterViewController {
      let messenger = controller.binaryMessenger

      FlutterMethodChannel(name: "com.majarra/device", binaryMessenger: messenger)
        .setMethodCallHandler { [weak self] call, result in
          switch call.method {
          case "isTelevision":
            result(UIDevice.current.userInterfaceIdiom == .tv)
          case "isCaptured":
            result(self?.isCaptured() ?? false)
          case "setSecureFlag":
            // لا نافذة آمنة على هذه المنصّة. الردّ الصادق هو «غير منفَّذ».
            result(FlutterMethodNotImplemented)
          case "deviceIntegrity":
            result(AppDelegate.deviceIntegrity())
          default:
            result(FlutterMethodNotImplemented)
          }
        }

      FlutterEventChannel(name: "com.majarra/device/capture", binaryMessenger: messenger)
        .setStreamHandler(CaptureStreamHandler(delegate: self))
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// SEC-107: إشارات Jailbreak/Debugger/Simulator.
  ///
  /// كلها **إرشادية**: يهزمها الجهاز الذي تعمل عليه، ولإيجابياتها الخاطئة أسبابٌ
  /// مشروعة. والسياسة التي تستهلكها في الخادم ولا تحجب مشاهدة قط — أثرها الوحيد
  /// تقصير عمر ترخيص الاستخدام دون إنترنت.
  ///
  /// ولا PII: قيَم منطقية فقط. لا طراز، ولا إصدار نظام، ولا قائمة تطبيقات.
  /// و`canOpenURL("cydia://")` **مرفوض** عن قصد: يحتاج تسجيل مخطَّطات في
  /// `Info.plist`، وهو استعلام عن تطبيقات المستخدم لا فحص لجهازه.
  fileprivate static func deviceIntegrity() -> [String: Bool] {
    let jailbreakPaths = [
      "/Applications/Cydia.app",
      "/Applications/Sileo.app",
      "/Library/MobileSubstrate/MobileSubstrate.dylib",
      "/usr/sbin/sshd",
      "/etc/apt",
      "/private/var/lib/apt",
      "/var/jb",
    ]
    let hookingPaths = [
      "/usr/lib/frida",
      "/Library/MobileSubstrate/DynamicLibraries",
      "/usr/lib/substitute-inserter.dylib",
    ]

    #if targetEnvironment(simulator)
      let simulator = true
    #else
      let simulator = false
    #endif

    return [
      "jailbreak_paths": jailbreakPaths.contains { FileManager.default.fileExists(atPath: $0) },
      "hooking": hookingPaths.contains { FileManager.default.fileExists(atPath: $0) },
      // الكتابة خارج الصندوق أقوى إشارة: لا تعتمد على قائمة مسارات تُخفى.
      // والمحاكي يكتب هناك بحكم تشغيله على macOS، فلا يُحسب كسرًا.
      "sandbox_escape": !simulator && canWriteOutsideSandbox(),
      "emulator": simulator,
      // لا `sysctl(P_TRACED)` هنا: بعض مراجعات المتجر تعدّه مضادًّا للتنقيح.
      "debugger": false,
    ]
  }

  /// محاولة كتابة واحدة تُنظَّف فورًا. الفشل هو الحالة السليمة.
  private static func canWriteOutsideSandbox() -> Bool {
    let probe = "/private/majarra_integrity_probe"
    guard FileManager.default.createFile(atPath: probe, contents: nil) else { return false }
    try? FileManager.default.removeItem(atPath: probe)
    return true
  }

  /// الحالة الحاضرة: تسجيل/AirPlay على الشاشة الرئيسية، أو شاشة إضافية موصولة.
  ///
  /// `screens.count > 1` يشمل المرآة السلكية التي لا يرفع بعضها `isCaptured`.
  fileprivate func isCaptured() -> Bool {
    if UIScreen.main.isCaptured { return true }
    return UIScreen.screens.count > 1
  }

  fileprivate func startObserving(sink: @escaping FlutterEventSink) {
    captureSink = sink
    let center = NotificationCenter.default
    let names: [NSNotification.Name] = [
      UIScreen.capturedDidChangeNotification,
      UIScreen.didConnectNotification,
      UIScreen.didDisconnectNotification,
    ]
    observers = names.map { name in
      center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        guard let self = self, let sink = self.captureSink else { return }
        sink(self.isCaptured())
      }
    }
    // الحالة الأولى تُرسَل فورًا: الاشتراك قد يبدأ **بعد** أن صار التسجيل
    // جاريًا، وانتظار تغيّر تالٍ كان سيترك المحتوى معروضًا بلا حدّ.
    sink(isCaptured())
  }

  fileprivate func stopObserving() {
    let center = NotificationCenter.default
    observers.forEach { center.removeObserver($0) }
    observers = []
    captureSink = nil
  }
}

/// يفصل دورة حياة الاشتراك عن الـdelegate حتى لا يبقى مراقب معلَّقًا بعد إغلاق
/// التدفّق من جهة Dart.
private class CaptureStreamHandler: NSObject, FlutterStreamHandler {
  init(delegate: AppDelegate) {
    self.delegate = delegate
  }

  private weak var delegate: AppDelegate?

  func onListen(
    withArguments arguments: Any?,
    eventSink events: @escaping FlutterEventSink
  ) -> FlutterError? {
    delegate?.startObserving(sink: events)
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    delegate?.stopObserving()
    return nil
  }
}
