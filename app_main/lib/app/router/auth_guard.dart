import 'dart:async';
import 'dart:convert';

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum AuthLoadOutcome { ready, expiredWithoutRefresh }

/// حالة تهيئة الأسرة، بأربع قيم لا بمنطقيّة واحدة (`BUILD-201`, `APP-205`).
///
/// ## العلّة التي أوجبت هذا النوع
///
/// كان الحقل `bool _hasCompletedOnboarding` وقيمته الافتراضية `false`. فـ«لم
/// تُجلَب القائمة بعد» و«فشل الجلب» و«أسرةٌ جديدة فعلًا» **شكلٌ واحد**، والقرار
/// المبنيّ عليها واحد: إلى `/onboarding`. والأثران المقيسان:
///
/// * **إقلاع بارد لأسرةٍ قائمة** يُعيد التوجيه إلى `/onboarding` قبل أن يُحسم
///   `familyChildrenProvider`، ثم يبقى هناك — لأن `/onboarding` نفسه
///   `authenticatedFamily` ولا فرع يُخرج منه (موصَّف في رأس
///   `onboarding_journey_integration_test.dart`).
/// * **خطأ شبكةٍ عابر** يُقرأ «أسرةٌ جديدة»، فتُعاد رحلة أوّل استخدام على أسرةٍ
///   أكملتها.
///
/// والتمييز بين [incomplete] و[complete] **عدد الأطفال لا الختم**: حسابٌ قديم
/// أُنشئ قبل وجود `onboarding_completed_at` له طفل بلا ختم، وهو أكمل التهيئة
/// بمعناها. فالاستجابة الناجحة **الفارغة** وحدها تبدأ الرحلة.
enum FamilyOnboardingStatus {
  /// `familyChildrenProvider` لم يُحسم بعد. لا تُبنى قرارات توجيهٍ نهائية عليها.
  loading,

  /// فشل جلب القائمة. تُعرض شاشةٌ قابلة لإعادة المحاولة، ولا تُعدّ الأسرة جديدة.
  error,

  /// نجح الجلب وأعاد **صفر أطفال** — وهذه وحدها أسرةٌ تبدأ الرحلة.
  incomplete,

  /// نجح الجلب وأعاد طفلًا واحدًا على الأقل، بختمٍ أو بلا ختم.
  complete,
}

/// Reactive session and parental-area gate used by [GoRouter].
///
/// A normal authenticated session and the local demo experience are deliberately
/// separate. Demo never receives bearer tokens and can only enter child-facing
/// routes. Parental access is an in-memory, short-lived proof: it is never
/// persisted and is cleared on sign-out, session replacement, expiry, and app
/// backgrounding.
class AuthGuard extends ChangeNotifier {
  AuthGuard({FlutterSecureStorage? storage})
    : _storage = storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(
              encryptedSharedPreferences: true,
            ),
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock,
            ),
          );

  static const parentAccessDuration = Duration(minutes: 15);

  final FlutterSecureStorage _storage;
  Timer? _parentAccessTimer;

  // Defer notify to avoid `!_dirty` when GoRouter (refreshListenable)
  // is notified while the widget tree is still building on web
  // (assert in framework.dart:5444). GoRouter subscribes to this
  // ChangeNotifier; if we notify inside a build, the router calls
  // setState during buildScope which re-enters the build.
  //
  // Binding may not be initialized in pure unit tests – fall back to
  // immediate notify (tests pump frames explicitly and don't hit the
  // re-entrancy path).
  void _scheduleNotify() {
    if (!hasListeners) return;
    // Fast path for tests / non-widget contexts.
    try {
      final binding = WidgetsBinding.instance;
      // SchedulerPhase.idle == not in build/layout/paint/commit.
      if (binding.schedulerPhase == SchedulerPhase.idle) {
        notifyListeners();
        return;
      }
      // Inside a build – wait for this frame to complete.
      binding.addPostFrameCallback((_) {
        if (hasListeners) notifyListeners();
      });
      return;
    } catch (_) {
      // No binding yet (e.g. dart test without TestWidgetsFlutterBinding)
    }
    notifyListeners();
  }

  bool _isAuthenticated = false;
  bool _isDemo = false;
  bool _hasChild = false;
  FamilyOnboardingStatus _familyOnboardingStatus = FamilyOnboardingStatus.loading;
  bool _onboardingJourneyInProgress = false;
  bool _isLoading = true;
  String? _parentId;
  String? _parentAccessOwner;
  String? _parentProof;
  DateTime? _parentAccessExpiresAt;

  bool get isLoading => _isLoading;

  /// True for either a real authenticated family session or the local demo.
  bool get isAuthenticated => _isAuthenticated;

  /// A local, child-only session. It never carries API credentials.
  bool get isDemo => _isAuthenticated && _isDemo;

  bool get isRealAuthenticated => _isAuthenticated && !_isDemo;
  bool get hasChild => _hasChild;

  /// حالة تهيئة الأسرة (Requirement 8.1, 8.5, 8.6). يضبطها مستمع
  /// `familyChildrenProvider` في `routerProvider` عبر
  /// [setFamilyOnboardingStatus] — وهذا الحقل **لا يقرأ مزوّد Riverpod** بنفسه،
  /// كما أن [hasChild] يُضبَط بـ[setHasChild] ولا يُحسب هنا.
  FamilyOnboardingStatus get familyOnboardingStatus => _familyOnboardingStatus;

  /// أسرةٌ لها طفلٌ واحد على الأقل. تبقى مشتقّة لا مُخزَّنة حتى لا يوجد مصدرا
  /// حقيقةٍ لنفس الواقعة.
  ///
  /// و**لا تُستخدم وحدها لقرار `/onboarding`**: `false` هنا تشمل [loading] و
  /// [error]، وهما ليستا «أسرةً جديدة». استخدم [shouldEnterOnboarding].
  bool get hasCompletedOnboarding =>
      _familyOnboardingStatus == FamilyOnboardingStatus.complete;

  /// هل رحلة أوّل استخدام **جارية الآن**؟
  ///
  /// منفصلة عن [familyOnboardingStatus] لأنها تجيب سؤالًا آخر: الأولى «هل
  /// الأسرة جديدة؟»، وهذه «هل نُخرج المستخدم من الشاشة التي هو فيها؟». ولولا
  /// الفصل لانتُزع مستخدمٌ من شاشة الاحتفال في اللحظة التي يُنشئ فيها أوّل طفل
  /// — لأن الأسرة تصير [complete] بذلك الإنشاء نفسه.
  bool get onboardingJourneyInProgress => _onboardingJourneyInProgress;

  /// القرار الوحيد الذي يُبنى عليه التوجيه إلى `/onboarding`.
  ///
  /// [loading] و[error] تُعيدان `false` بقصد: شاشة الأطفال تعرض مؤشّر تحميلٍ أو
  /// خطأً قابلًا لإعادة المحاولة، وكلاهما أصدق من رحلةٍ لا يحتاجها أحد.
  bool get shouldEnterOnboarding => _onboardingJourneyInProgress;
  String? get parentId => _parentId;
  DateTime? get parentAccessExpiresAt => _parentAccessExpiresAt;

  /// The signed server proof while it is valid. It is deliberately memory-only;
  /// the API client reads it through a callback and never writes it to storage.
  String? get parentProof => hasParentAccess ? _parentProof : null;

  bool get hasParentAccess {
    final expiresAt = _parentAccessExpiresAt;
    return isRealAuthenticated &&
        _parentId != null &&
        _parentAccessOwner == _parentId &&
        _parentProof != null &&
        _parentProof!.isNotEmpty &&
        expiresAt != null &&
        expiresAt.isAfter(DateTime.now());
  }

  bool _accessTokenExpired(String token) {
    try {
      final parts = token.split('.');
      // Majarra signed tokens are `payload.signature`; accept a conventional
      // three-part JWT as a migration-compatible read-only expiry hint too.
      if (parts.length != 2 && parts.length != 3) return false;
      var payload = parts.length == 2 ? parts[0] : parts[1];
      payload = payload.replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final decoded = jsonDecode(utf8.decode(base64.decode(payload)));
      if (decoded is! Map) return false;
      final expValue = decoded['exp'];
      final exp = expValue is num
          ? expValue.toInt()
          : int.tryParse('$expValue');
      if (exp == null) return false;
      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return exp <= nowSec + 30;
    } catch (_) {
      return false;
    }
  }

  /// Loads persisted credentials without publishing a terminal logged-out state
  /// until account-scoped data has been wiped by [AuthController].
  Future<String?> _safeRead(String key) async {
    try {
      final v = await _storage.read(key: key);
      if (v == null) return null;
      final t = v.trim();
      return t.isEmpty ? null : t;
    } catch (e) {
      // FlutterSecureStorage on debug/web can throw
      // "Unsupported operation: Cannot send Null" when platform returns null
      // via MethodChannel. Also can throw MissingPluginException in tests.
      // Treat as no session – never crash the app bootstrap.
      debugPrint('[AuthGuard] safeRead $key failed: $e');
      return null;
    }
  }

  Future<AuthLoadOutcome> load() async {
    String? token;
    String? storedParentId;
    String? refreshToken;
    try {
      token = await _safeRead('majarra_access_token');
      storedParentId = await _safeRead('majarra_parent_id');
      refreshToken = await _safeRead('majarra_refresh_token');
    } catch (e) {
      debugPrint('[AuthGuard] load failed, treating as logged out: $e');
      token = null;
      storedParentId = null;
      refreshToken = null;
    }
    var isExpired = false;
    if (token != null && token.isNotEmpty) {
      isExpired = _accessTokenExpired(token);
    }
    final expiredWithoutRefresh =
        isExpired && (refreshToken == null || refreshToken.isEmpty);
    // If expired and we have refresh, keep authenticated but mark for silent
    // refresh via the API client's coalesced path. Only an explicit refresh 401
    // is terminal; transient refresh failures must preserve offline data.
    if (expiredWithoutRefresh) {
      _isAuthenticated = false;
      _parentId = null;
    } else {
      _isAuthenticated =
          token != null &&
          token.isNotEmpty &&
          storedParentId != null &&
          storedParentId.isNotEmpty;
      _parentId = _isAuthenticated ? storedParentId : null;
    }
    _isDemo = false;
    _clearParentAccess();
    if (expiredWithoutRefresh) {
      // Keep the router blocked until AuthController completes the same full
      // teardown used by logout, deletion, and a rejected refresh.
      return AuthLoadOutcome.expiredWithoutRefresh;
    }
    _isLoading = false;
    _scheduleNotify();
    return AuthLoadOutcome.ready;
  }

  void setAuthenticated(bool value, {String? parentId}) {
    final nextParentId = value ? (parentId ?? _parentId) : null;
    final changed =
        _isAuthenticated != value ||
        _isDemo ||
        _parentId != nextParentId ||
        _parentProof != null ||
        _isLoading;
    _isAuthenticated = value;
    _isDemo = false;
    _parentId = nextParentId;
    _isLoading = false;
    // This method is called when credentials are installed after login. Even
    // when the same parent signs in again, the session id may have changed, so
    // a proof bound to the previous session must never survive the replacement.
    _clearParentAccess();
    if (changed) _scheduleNotify();
  }

  /// Starts a memory-only reviewer experience without writing fake credentials.
  void startDemoSession() {
    _isAuthenticated = true;
    _isDemo = true;
    _parentId = null;
    _hasChild = false;
    // `incomplete` لا `loading`: الضيف لا يُجلَب له شيء من الخادم، فحالته
    // معروفة يقينًا لا منتظَرة. وهي نفس ما كانت عليه المنطقيّة قبل هذا النوع
    // (`false`)، فسلوك الضيف لم يتغيّر في هذه الدفعة.
    _familyOnboardingStatus = FamilyOnboardingStatus.incomplete;
    _onboardingJourneyInProgress = false;
    _isLoading = false;
    _clearParentAccess();
    _scheduleNotify();
  }

  void setHasChild(bool value) {
    if (_hasChild == value) return;
    _hasChild = value;
    _scheduleNotify();
  }

  void setFamilyOnboardingStatus(FamilyOnboardingStatus value) {
    if (_familyOnboardingStatus == value) return;
    _familyOnboardingStatus = value;
    _scheduleNotify();
  }

  /// يضبط الحالة بمنطقيّة، للمواضع التي تعرف الجواب يقينًا ولا تمرّ بالمزوّد
  /// (اختبارات مصفوفة الحراسة، ومسارات إعادة التعيين أدناه).
  ///
  /// `false` تعني [FamilyOnboardingStatus.incomplete] لا [loading]: من ينادي
  /// هذه الدالّة يؤكّد أنه **يعرف** أن الأسرة بلا أطفال، لا أنه لم يعرف بعد.
  void setHasCompletedOnboarding(bool value) {
    setFamilyOnboardingStatus(
      value ? FamilyOnboardingStatus.complete : FamilyOnboardingStatus.incomplete,
    );
  }

  void setOnboardingJourneyInProgress(bool value) {
    if (_onboardingJourneyInProgress == value) return;
    _onboardingJourneyInProgress = value;
    _scheduleNotify();
  }

  /// Stores a server-signed `parent_area` proof in memory only.
  ///
  /// The server expiry is authoritative and is capped to the local safety window
  /// so a malformed response can never create a longer-lived UI grant.
  bool grantParentAccess({required String proof, required DateTime expiresAt}) {
    if (!isRealAuthenticated ||
        _parentId == null ||
        proof.isEmpty ||
        !expiresAt.isAfter(DateTime.now())) {
      return false;
    }
    final maximum = DateTime.now().add(parentAccessDuration);
    final effectiveExpiry = expiresAt.isBefore(maximum) ? expiresAt : maximum;
    _parentAccessTimer?.cancel();
    _parentAccessOwner = _parentId;
    _parentProof = proof;
    _parentAccessExpiresAt = effectiveExpiry;
    _parentAccessTimer = Timer(
      effectiveExpiry.difference(DateTime.now()),
      revokeParentAccess,
    );
    _scheduleNotify();
    return true;
  }

  void revokeParentAccess() {
    final hadAccess =
        _parentAccessExpiresAt != null || _parentAccessOwner != null;
    _clearParentAccess();
    if (hadAccess) _scheduleNotify();
  }

  /// Marks the session as ended so `redirect` sends the user to `/login`.
  void handleLogout() {
    _isAuthenticated = false;
    _isDemo = false;
    _hasChild = false;
    // `loading` لا `incomplete`: بعد الخروج لا نعرف شيئًا عن أسرة الحساب
    // التالي، وبقاءُ `incomplete` كان سيجعل أوّل إطارٍ بعد دخولٍ جديد يقرأ
    // «أسرةٌ جديدة» قبل أن تُجلَب قائمتها.
    _familyOnboardingStatus = FamilyOnboardingStatus.loading;
    _onboardingJourneyInProgress = false;
    _parentId = null;
    _isLoading = false;
    _clearParentAccess();
    _scheduleNotify();
  }

  void _clearParentAccess() {
    _parentAccessTimer?.cancel();
    _parentAccessTimer = null;
    _parentAccessOwner = null;
    _parentProof = null;
    _parentAccessExpiresAt = null;
  }

  @override
  void dispose() {
    _parentAccessTimer?.cancel();
    super.dispose();
  }
}

final authGuardProvider = Provider<AuthGuard>((ref) {
  final guard = AuthGuard();
  ref.onDispose(guard.dispose);
  return guard;
});

/// مفتاح الجلسة: نصٌّ يتغيّر عند كل تحوّل **حقيقي** في هوية الجلسة
/// (تحميل ← جاهز، دخول، ضيف، خروج، تبدّل وليّ الأمر).
///
/// ## لماذا يلزم هذا أصلًا
///
/// `authGuardProvider` مزوّد `Provider` يُعيد `ChangeNotifier` **قابلًا
/// للتغيّر**. و`ref.watch` عليه يُعيد الحساب إذا تغيّر **الكائن** لا إذا
/// أخطر الكائن مستمعيه — والكائن لا يُستبدل أبدًا. فكل `FutureProvider`
/// يكتب `ref.watch(authGuardProvider)` يُحسب **مرّة واحدة**، في أوّل قراءة،
/// وهي تقع قبل الدخول (`isLoading == true` أو غير مُصدَّق) فيُخزَّن الناتج
/// الفارغ ولا يُعاد جلبه بعد نجاح الدخول.
///
/// وهذا ما كان يُفرِغ «من يشاهد الآن؟» رغم أن الخادم يُعيد الأطفال الثلاثة،
/// ويُبقي `hasCompletedOnboarding` على `false` لأن مستمع الموجّه لا يرى إلا
/// القائمة الفارغة المُخزَّنة.
///
/// والمفتاح نصّ لا عدّاد: `StateNotifier` لا يُخطر إلا إذا اختلفت القيمة،
/// فإخطارات الحرّاس الأخرى (منح إثبات والد، تبدّل الطفل النشط) لا تُسبّب
/// إعادة جلبٍ لا داعي لها — لأنها لا تُغيّر هذا النصّ.
final authSessionKeyProvider =
    StateNotifierProvider<AuthSessionKey, String>((ref) {
  return AuthSessionKey(ref.watch(authGuardProvider));
});

@visibleForTesting
class AuthSessionKey extends StateNotifier<String> {
  AuthSessionKey(this._guard) : super(_read(_guard)) {
    _guard.addListener(_sync);
  }

  final AuthGuard _guard;

  static String _read(AuthGuard g) =>
      '${g.isLoading}|${g.isAuthenticated}|${g.isDemo}|${g.parentId}';

  void _sync() {
    final next = _read(_guard);
    if (next != state) state = next;
  }

  @override
  void dispose() {
    _guard.removeListener(_sync);
    super.dispose();
  }
}
