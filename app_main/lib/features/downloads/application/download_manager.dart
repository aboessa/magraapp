import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../../core/analytics/analytics.dart';
import '../../../core/crypto/file_crypto.dart';
import '../../../core/crypto/streaming_digest.dart';
import '../../../core/diagnostics/ignored_errors.dart';
import '../../../core/licensing/license_guard.dart';
import '../../../core/licensing/offline_license.dart';
import '../data/download_repository.dart';
import '../domain/download_models.dart';

/// Why a download could not start. Surfaced to the UI so the reason is truthful
/// ("you are on mobile data") rather than a generic failure.
/// الخادم رفض التنزيل لأن الباقة لا تسمح به أو المحتوى فوقها.
class DownloadNotEntitled implements Exception {
  const DownloadNotEntitled();
}

/// الخادم رفض التنزيل لأن حدًّا بلغ منتهاه (أجهزة التنزيل أو عدد العناصر).
class DownloadLimitReached implements Exception {
  const DownloadLimitReached();
}

enum DownloadRejection {
  none,
  notEntitled,
  offlineOrMetered,
  storageFull,
  alreadyExists,
  noSource,

  /// مخزن المنصّة الآمن لا يعمل، فلا مفتاح يمكن الاعتماد عليه (`ENC-011`).
  ///
  /// الرفض **قبل** بدء التنزيل مقصود: البديل الذي كان قائمًا هو تنزيل يستهلك
  /// بيانات الأسرة ثم يُشفَّر بمفتاح لا يُحفَظ، فيظهر «جاهزًا» ولا يُفَك أبدًا
  /// بعد إعادة تشغيل التطبيق.
  secureStorageUnavailable,
}

/// ما يعيده الخادم عند فتح جلسة تنزيل (`ENC-001`/`ENC-008`).
///
/// الرابط والقدرة معًا: التنزيل كان يجري على رابط عام بلا أي ترويسة تخويل، أي أن
/// الطبقة المشفَّرة كانت تحمي ما لا يحتاج حماية بينما المحتوى المدفوع بلا مسار
/// offline أصلًا.
class DownloadAuthorization {
  const DownloadAuthorization({
    required this.licenceId,
    required this.licenceToken,
    required this.url,
    required this.authorization,
    this.expiresAt,
    this.sourceSha256,
  });

  final String licenceId;

  /// الترخيص الموقَّع كما وصل. يُخزَّن نصًّا لأن التوقيع على بايتاته.
  final String licenceToken;

  /// رابط الأصل: مسار الـWorker لا رابط R2.
  final String url;

  /// قدرة الوسائط، عمرها ثلاث دقائق ويجدّدها `refresh`.
  final String authorization;

  /// انتهاء الترخيص كما قرّره الخادم، لا كما حسبه العميل.
  final DateTime? expiresAt;

  /// بصمة المصدر كما نشرها الخادم (`ENC-007`).
  ///
  /// `null` تعني «لم تُحسب عند الاستيراد» — وهي **مختلفة** عن «لا تطابق»:
  /// الأولى تُقبل والثانية تُرفض. كثير من الأصول القائمة بلا بصمة، ورفضها كان
  /// سيمنع تنزيل محتوى سليم منشور.
  final String? sourceSha256;
}

/// A request to download one piece of content.
class DownloadRequest {
  const DownloadRequest({
    required this.id,
    required this.childId,
    required this.contentType,
    required this.title,
    required this.subtitle,
    required this.sourceUrl,
    this.posterUrl,
    this.quality,
  });

  final String id;
  final String childId;
  final String contentType;
  final String title;
  final String subtitle;
  final String sourceUrl;
  final String? posterUrl;
  final String? quality;
}

/// Drives the offline download lifecycle (§3, §4, §5).
///
/// Everything here is real: an enqueued item is fetched over HTTP with live
/// progress, encrypted to disk through [DownloadRepository], and marked ready
/// with an expiry. Before a download starts it is gated on three real checks —
/// entitlement, connectivity/Wi-Fi-only, and a storage budget — each of which
/// maps to a distinct [DownloadRejection] so the UI can explain a refusal.
///
/// Dependencies are injected so the manager can be unit tested with a fake HTTP
/// client and a temp-directory repository. The manager owns [client] and closes
/// it when [shutdown] or [dispose] begins.
class DownloadManager extends StateNotifier<List<DownloadItem>> {
  DownloadManager({
    required DownloadRepository repository,
    required http.Client client,
    required Future<bool> Function() isEntitled,
    required Future<bool> Function() networkAllowsDownload,
    this.offlineLicenseDuration = const Duration(days: 30),
    this.maxTotalBytes = 2 * 1024 * 1024 * 1024, // 2 GiB device budget.
    this.maxItemBytes = 512 * 1024 * 1024,
    Future<DownloadAuthorization> Function(DownloadRequest request)? authorize,
    Future<DownloadAuthorization> Function(String licenceId)? refreshAuthorization,
    Future<Set<String>> Function()? fetchActiveLicences,
    Future<void> Function(String licenceId)? onDownloadCompleted,
    LicenseGuard? licenseGuard,
  }) : _repo = repository,
       _client = client,
       _isEntitled = isEntitled,
       _networkAllows = networkAllowsDownload,
       _authorize = authorize,
       _refreshAuthorization = refreshAuthorization,
       _fetchActiveLicences = fetchActiveLicences,
       _onDownloadCompleted = onDownloadCompleted,
       _licenses = licenseGuard,
       super(const []) {
    unawaited(_startOperation<void>(_restore, whenFenced: () {}));
  }

  final DownloadRepository _repo;
  final http.Client _client;
  final Future<bool> Function() _isEntitled;
  final Future<bool> Function() _networkAllows;
  /// مدّة الترخيص الاحتياطية حين لا تخويل خادمي (`ENC-005`).
  ///
  /// كانت هي السلطة على الصلاحية، وهي الآن **احتياط للمسار غير المخوَّل وحده**:
  /// المدّة الحقيقية تأتي موقَّعة من الخادم في الترخيص.
  final Duration offlineLicenseDuration;
  final int maxTotalBytes;
  final int maxItemBytes;

  /// يفتح جلسة تنزيل خادمية ويعيد الترخيص والقدرة (`ENC-008`).
  ///
  /// اختياري في التركيب لا في الإنتاج: `download_providers.dart` يمرّره دائمًا.
  /// غيابه يعني المسار القديم — رابط عام بلا تخويل — ويستعمله اختبار المحرّك
  /// وحده حيث لا خادم.
  final Future<DownloadAuthorization> Function(DownloadRequest request)? _authorize;

  /// يقرأ التراخيص النشطة من الخادم، للمصالحة عند أول اتصال (`ENC-010`).
  final Future<Set<String>> Function()? _fetchActiveLicences;

  /// يجدّد قدرة الوسائط وحدها حين تنتهي أثناء تنزيل طويل.
  final Future<DownloadAuthorization> Function(String licenceId)? _refreshAuthorization;

  /// يُبلّغ الخادم باكتمال التنزيل، فينتقل الترخيص إلى `active`.
  final Future<void> Function(String licenceId)? _onDownloadCompleted;

  /// حافظ التراخيص: يخزّن الترخيص الموقَّع ويتحقّق منه قبل كل تشغيل.
  final LicenseGuard? _licenses;

  /// تخويل كل عنصر جارٍ تنزيله، من لحظة الإذن إلى اكتمال التنزيل.
  final Map<String, DownloadAuthorization> _authorizations = <String, DownloadAuthorization>{};

  final Set<Future<void>> _operations = <Future<void>>{};

  /// روابط التشغيل المحلية النشطة، لكل عنصر رابطه (`ENC-004`).
  ///
  /// تُحفَظ حتى يستطيع الإغلاق إيقاف تقديمها: رابط يبقى مقدَّمًا بعد انتهاء
  /// التشغيل يعني منفذًا مفتوحًا ومسارًا صالحًا بلا سبب.
  final Map<String, Uri> _playbackSources = <String, Uri>{};
  final Map<String, _RunEntry> _runs = <String, _RunEntry>{};
  final Map<String, int> _idGenerations = <String, int>{};
  final Map<String, int> _blockedIds = <String, int>{};
  final Set<String> _pendingEnqueues = <String>{};

  Future<void> _saveTail = Future<void>.value();
  Future<void>? _shutdownFuture;
  var _generation = 0;
  var _shuttingDown = false;
  var _clientClosed = false;

  /// Stops this manager from admitting work and waits until every operation
  /// already admitted has reached a repository-safe quiescent point.
  ///
  /// The fence, run cancellation, active-stream cancellation, and client close
  /// all happen synchronously before this method returns its first future.
  Future<void> shutdown() {
    final existing = _shutdownFuture;
    if (existing != null) return existing;

    final completer = Completer<void>();
    _shutdownFuture = completer.future;

    _shuttingDown = true;
    _generation++;
    for (final run in List<_RunEntry>.of(_runs.values)) {
      run.control.requestCancel();
    }
    _closeClient();

    unawaited(
      _drainOperations().then<void>(
        (_) => completer.complete(),
        onError: (Object error, StackTrace stackTrace) {
          completer.completeError(error, stackTrace);
        },
      ),
    );
    return completer.future;
  }

  @override
  void dispose() {
    final completion = shutdown();
    unawaited(
      completion.then<void>((_) {}, onError: (Object _, StackTrace __) {}),
    );
    super.dispose();
  }

  void _closeClient() {
    if (_clientClosed) return;
    _clientClosed = true;
    try {
      _client.close();
    } catch (_) {
      // The lifecycle fence is still authoritative if a custom client throws.
    }
  }

  Future<void> _drainOperations() async {
    while (_operations.isNotEmpty) {
      await Future.wait<void>(List<Future<void>>.of(_operations));
    }
  }

  Future<T> _startOperation<T>(
    Future<T> Function(int generation) body, {
    required T Function() whenFenced,
  }) {
    if (_shuttingDown) return Future<T>.sync(whenFenced);

    final generation = _generation;
    final ticket = Completer<void>();
    final ticketFuture = ticket.future;
    _operations.add(ticketFuture);

    void finish() {
      if (!ticket.isCompleted) ticket.complete();
      _operations.remove(ticketFuture);
    }

    late Future<T> result;
    try {
      result = body(generation);
    } catch (error, stackTrace) {
      finish();
      return Future<T>.error(error, stackTrace);
    }
    result.then<void>(
      (_) => finish(),
      onError: (Object _, StackTrace __) => finish(),
    );
    return result;
  }

  Future<void> _restore(int generation) async {
    if (!_isCurrent(generation)) return;
    final items = _repo.loadAll();
    if (!_isCurrent(generation)) return;

    // Expiry sweep on load: a licence that lapsed while the app was closed must
    // not remain playable (§31 — a withdrawn/expired title cannot linger).
    final now = DateTime.now();
    final swept = [
      for (final item in items)
        item.isExpired(now) && item.status == DownloadStatus.ready
            ? item.copyWith(status: DownloadStatus.expired)
            : item,
    ];
    // An item left mid-download by a kill is not resumable in-memory; mark it
    // paused so the user can retry rather than showing a stuck spinner.
    final reconciled = [
      for (final item in swept)
        item.status == DownloadStatus.downloading
            ? item.copyWith(status: DownloadStatus.paused)
            : item,
    ];
    state = reconciled;
    if (!listEquals(items, reconciled)) {
      await _saveSnapshot(generation);
      if (!_isCurrent(generation)) return;
    }

    await _reconcileLicences(generation);
  }

  /// يصالح التراخيص المحلية مع الخادم عند أول اتصال (`ENC-010`).
  ///
  /// ## العلّة
  ///
  /// سحب جهاز من اللوحة كان **بلا أي أثر على الجهاز**: العميل لا يسأل الخادم عن
  /// أي ترخيص قبل التشغيل، فيواصل جهاز مسروق — أو حساب أُلغي اشتراكه — تشغيل كل
  /// ما نزّله حتى تنتهي الثلاثون يومًا التي منحها العميل لنفسه.
  ///
  /// المصالحة تسأل: أي التراخيص ما زالت نشطة؟ وما ليس في الجواب يُنسى محليًّا،
  /// فيصير الملف غير قابل للفك بلا حذفه (قد يكون الإبطال خطأً يُصحَّح بترخيص
  /// جديد، وحذف المحتوى يُهدر بيانات الأسرة).
  ///
  /// الفشل صامت **عن قصد**: لا اتصال ليس إبطالًا. وما يحمي من البقاء غير متصل
  /// إلى الأبد هو نافذة إعادة التحقّق في `LicenseGuard.maxOfflineGap`، لا هذه
  /// الدالة.
  Future<void> _reconcileLicences(int generation) async {
    final fetch = _fetchActiveLicences;
    final licenses = _licenses;
    if (fetch == null || licenses == null) return;

    final Set<String> active;
    try {
      active = await fetch();
    } catch (_) {
      return;
    }
    if (!_isCurrent(generation)) return;
    await licenses.recordVerification(DateTime.now());
    if (!_isCurrent(generation)) return;

    for (final item in state) {
      final licenceId = await licenses.licenceIdFor(item.id);
      if (!_isCurrent(generation)) return;
      // لا ترخيص محليًّا = عنصر من نسخة أقدم من التطبيق؛ تتولّاه بوابة التشغيل.
      if (licenceId == null || active.contains(licenceId)) continue;
      await licenses.revokeLocally(item.id);
      if (!_isCurrent(generation)) return;
      _update(item.id, (current) => current.copyWith(status: DownloadStatus.expired));
    }
    await _saveSnapshot(generation);
  }

  DownloadItem? byId(String id) {
    for (final item in state) {
      if (item.id == id) return item;
    }
    return null;
  }

  List<DownloadItem> forChild(String childId) =>
      state.where((i) => i.childId == childId).toList();

  Future<int> storageUsedBytes() =>
      _startOperation<int>(_storageUsedBytes, whenFenced: () => 0);

  Future<int> _storageUsedBytes(int generation) async {
    if (!_isCurrent(generation)) return 0;
    final bytes = await _repo.totalBytesOnDisk();
    if (!_isCurrent(generation)) return 0;
    return bytes;
  }

  /// Validates and enqueues a download, then starts it. Returns the reason it
  /// was refused, or [DownloadRejection.none] on success.
  Future<DownloadRejection> enqueue(DownloadRequest request) =>
      _startOperation<DownloadRejection>(
        (generation) => _enqueue(request, generation),
        whenFenced: () => DownloadRejection.offlineOrMetered,
      );

  Future<DownloadRejection> _enqueue(
    DownloadRequest request,
    int generation,
  ) async {
    if (!_isCurrent(generation)) {
      return DownloadRejection.offlineOrMetered;
    }
    if (request.sourceUrl.isEmpty) return DownloadRejection.noSource;
    if (byId(request.id) != null ||
        _pendingEnqueues.contains(request.id) ||
        _isBlocked(request.id)) {
      return DownloadRejection.alreadyExists;
    }

    _pendingEnqueues.add(request.id);
    final idGeneration = _nextIdGeneration(request.id);
    try {
      if (!_isIdCurrent(request.id, generation, idGeneration)) {
        return DownloadRejection.offlineOrMetered;
      }
      final entitled = await _isEntitled();
      if (!_isIdCurrent(request.id, generation, idGeneration)) {
        return DownloadRejection.offlineOrMetered;
      }
      if (!entitled) return DownloadRejection.notEntitled;

      final networkAllowed = await _networkAllows();
      if (!_isIdCurrent(request.id, generation, idGeneration)) {
        return DownloadRejection.offlineOrMetered;
      }
      if (!networkAllowed) return DownloadRejection.offlineOrMetered;

      final used = await _repo.totalBytesOnDisk();
      if (!_isIdCurrent(request.id, generation, idGeneration)) {
        return DownloadRejection.offlineOrMetered;
      }
      if (used >= maxTotalBytes) return DownloadRejection.storageFull;

      // ENC-011: المفتاح يُتحقَّق منه هنا، قبل أول بايت من الشبكة. فشل المخزن
      // الآمن كان مكتومًا تمامًا: التنزيل يمضي، والتشفير يجري بمفتاح في الذاكرة
      // وحدها، ثم يظهر العنصر «جاهزًا» ويفشل عند التشغيل بعد إعادة التشغيل.
      try {
        await _repo.ensureEncryptionKeyAvailable();
      } on SecureStorageUnavailableException {
        return DownloadRejection.secureStorageUnavailable;
      }
      if (!_isIdCurrent(request.id, generation, idGeneration)) {
        return DownloadRejection.offlineOrMetered;
      }

      // ENC-001/ENC-008: الإذن من الخادم قبل أي بايت. هو الذي يفحص الاستحقاق
      // وحدود الأجهزة والعناصر، ويُصدر الترخيص الموقَّع والقدرة. الرفض هنا رفض
      // الخادم لا تقدير العميل — والعميل لم يكن يسأل أصلًا.
      final authorizer = _authorize;
      if (authorizer != null) {
        final DownloadAuthorization authorization;
        try {
          authorization = await authorizer(request);
        } on DownloadNotEntitled {
          return DownloadRejection.notEntitled;
        } on DownloadLimitReached {
          return DownloadRejection.storageFull;
        } catch (_) {
          // خطأ شبكة أو خادم: لا تنزيل بلا ترخيص، والسبب أقرب ما يكون إلى
          // «لا اتصال» من منظور وليّ الأمر.
          return DownloadRejection.offlineOrMetered;
        }
        if (!_isIdCurrent(request.id, generation, idGeneration)) {
          return DownloadRejection.offlineOrMetered;
        }
        // الترخيص يُحفَظ قبل بدء التنزيل: انقطاع في المنتصف يترك ملفًا جزئيًّا
        // مع ترخيصه، وهو ما يجعل الاستئناف ممكنًا بلا جلسة جديدة.
        await _licenses?.store(request.id, authorization.licenceToken);
        _authorizations[request.id] = authorization;
        if (!_isIdCurrent(request.id, generation, idGeneration)) {
          return DownloadRejection.offlineOrMetered;
        }
      }

      final item = DownloadItem(
        id: request.id,
        childId: request.childId,
        contentType: request.contentType,
        title: request.title,
        subtitle: request.subtitle,
        // الرابط المخوَّل يحلّ محلّ الرابط العام حين يوجد: مسار Worker يفحص
        // القدرة، لا رابط R2 مفتوح.
        sourceUrl: _authorizations[request.id]?.url ?? request.sourceUrl,
        fileName: '${request.id}.enc',
        status: DownloadStatus.queued,
        receivedBytes: 0,
        totalBytes: 0,
        createdAt: DateTime.now().millisecondsSinceEpoch,
        posterUrl: request.posterUrl,
        quality: request.quality,
      );
      _upsert(item);
      await _saveSnapshot(
        generation,
        id: request.id,
        idGeneration: idGeneration,
      );
      if (!_isIdCurrent(request.id, generation, idGeneration)) {
        return DownloadRejection.offlineOrMetered;
      }
      unawaited(_startRun(request.id, generation));
      return DownloadRejection.none;
    } finally {
      _pendingEnqueues.remove(request.id);
    }
  }

  Future<void> _startRun(String id, int generation) {
    if (!_isCurrent(generation) || _isBlocked(id)) {
      return Future<void>.value();
    }
    final existing = _runs[id];
    if (existing != null) return existing.future;
    if (byId(id) == null) return Future<void>.value();

    final entry = _RunEntry(
      id: id,
      managerGeneration: generation,
      idGeneration: _nextIdGeneration(id),
    );
    final ticket = Completer<void>();
    final ticketFuture = ticket.future;
    _operations.add(ticketFuture);
    _runs[id] = entry;

    void finish() {
      if (identical(_runs[id], entry)) _runs.remove(id);
      if (!ticket.isCompleted) ticket.complete();
      _operations.remove(ticketFuture);
    }

    entry.future.then<void>(
      (_) => finish(),
      onError: (Object _, StackTrace __) => finish(),
    );
    try {
      final work = _run(entry);
      work.then<void>(
        (_) => entry.complete(),
        onError: (Object error, StackTrace stackTrace) {
          entry.completeError(error, stackTrace);
        },
      );
    } catch (error, stackTrace) {
      entry.completeError(error, stackTrace);
    }
    return entry.future;
  }

  /// يجدّد قدرة الوسائط لعنصر جارٍ تنزيله، بلا ترخيص جديد.
  Future<bool> _refreshCapability(String id) async {
    final current = _authorizations[id];
    final refresh = _refreshAuthorization;
    if (current == null || refresh == null) return false;
    try {
      final next = await refresh(current.licenceId);
      _authorizations[id] = next;
      return true;
    } catch (_) {
      return false;
    }
  }

  /// يضمن وجود تخويل قبل بدء الجري.
  ///
  /// لازم لمسار «إعادة المحاولة» وبعد إعادة تشغيل التطبيق: التخويل في الذاكرة
  /// وحدها، فبلا هذا كان الاستئناف يُرسل طلبًا بلا قدرة فيُرفَض. إعادة فتح جلسة
  /// لنفس المحتوى idempotent على الخادم: يعيد الترخيص نفسه بقدرة جديدة.
  Future<bool> _ensureAuthorization(DownloadItem item) async {
    final authorizer = _authorize;
    if (authorizer == null) return true;
    if (_authorizations.containsKey(item.id)) return true;
    try {
      final authorization = await authorizer(DownloadRequest(
        id: item.id,
        childId: item.childId,
        contentType: item.contentType,
        title: item.title,
        subtitle: item.subtitle,
        sourceUrl: item.sourceUrl,
        posterUrl: item.posterUrl,
        quality: item.quality,
      ));
      _authorizations[item.id] = authorization;
      await _licenses?.store(item.id, authorization.licenceToken);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _run(_RunEntry entry) async {
    if (!_isRunCurrent(entry)) return;
    _update(
      entry.id,
      (item) => item.copyWith(status: DownloadStatus.downloading),
    );

    var item = byId(entry.id);
    if (item == null || !_isRunCurrent(entry)) return;
    if (!await _ensureAuthorization(item)) {
      if (!_isRunCurrent(entry)) return;
      _fail(entry.id, entry.managerGeneration, run: entry);
      return;
    }
    if (!_isRunCurrent(entry)) return;
    http.StreamedResponse? unconsumedResponse;
    try {
      final uri = Uri.parse(item.sourceUrl);

      // ENC-003: موضع الاستئناف لم يعد طول الملف الجزئي، لأن الملف الجزئي صار
      // مشفَّرًا: طوله أكبر من النصّ الصريح بمقدار ترويسة ووسم لكل جزء. الموضع
      // الصحيح هو ما ثُبِّت من أجزاء كاملة بالنصّ الصريح، ويحسبه المستودع
      // ويقصّ معه أي إطار ناقص من انقطاع سابق.
      var offset = item.receivedBytes;
      final expectedEtag = item.etag;
      try {
        if (!_isRunCurrent(entry)) return;
        final resumeAt = await _repo.resumeOffsetFor(item);
        if (!_isRunCurrent(entry)) return;
        if (resumeAt != offset) {
          offset = resumeAt;
          _update(
            entry.id,
            (current) => current.copyWith(receivedBytes: offset),
          );
        }
      } catch (_) {
        if (!_isRunCurrent(entry)) return;
        // تعذّر قراءة الحزمة الجزئية: نبدأ من الصفر بدل البناء على مجهول.
        offset = 0;
      }

      final headers = <String, String>{};
      // ENC-008: القدرة في ترويسة لا في سلسلة استعلام، فلا تظهر في سجل ولا في
      // تحليلات ولا في تاريخ وسيط.
      final authorization = _authorizations[item.id]?.authorization;
      if (authorization != null && authorization.isNotEmpty) {
        headers['Authorization'] = authorization;
      }
      if (offset > 0) {
        headers['Range'] = 'bytes=$offset-';
        if (expectedEtag != null && expectedEtag.isNotEmpty) {
          headers['If-Match'] = expectedEtag;
        }
      }
      final request = http.Request('GET', uri);
      headers.forEach((key, value) => request.headers[key] = value);
      unconsumedResponse = await _send(request, entry);
      if (!_isRunCurrent(entry) || unconsumedResponse == null) return;

      // 416 or ETag mismatch: discard the response and restart from zero.
      if (unconsumedResponse.statusCode == 416 ||
          unconsumedResponse.statusCode == 412) {
        await _cancelResponse(unconsumedResponse);
        unconsumedResponse = null;
        if (!_isRunCurrent(entry)) return;

        try {
          final part = await _repo.partFileFor(item);
          if (!_isRunCurrent(entry)) return;
          await _deletePartIfPresent(part, entry);
          if (!_isRunCurrent(entry)) return;
        } catch (_) {
          if (!_isRunCurrent(entry)) return;
        }
        _update(
          entry.id,
          (current) =>
              current.copyWith(receivedBytes: 0, totalBytes: 0, etag: null),
        );
        offset = 0;

        final retryRequest = http.Request('GET', uri);
        unconsumedResponse = await _send(retryRequest, entry);
        if (!_isRunCurrent(entry) || unconsumedResponse == null) return;
        if (unconsumedResponse.statusCode < 200 ||
            unconsumedResponse.statusCode >= 300) {
          await _cancelResponse(unconsumedResponse);
          unconsumedResponse = null;
          if (!_isRunCurrent(entry)) return;
          _fail(entry.id, entry.managerGeneration, run: entry);
          return;
        }
        final retryResponse = unconsumedResponse;
        unconsumedResponse = null;
        await _streamToPart(
          entry,
          retryResponse,
          0,
          retryResponse.headers['etag'],
        );
        return;
      }

      // ENC-008: القدرة عمرها ثلاث دقائق والتنزيل قد يطول. انتهاؤها في المنتصف
      // يعود 401/403، فتُجدَّد **بلا** ترخيص جديد ويُعاد الطلب من نفس الموضع.
      // بلا هذا الفرع كان كل تنزيل أطول من ثلاث دقائق يفشل، وهو أكثر التنزيلات.
      if ((unconsumedResponse.statusCode == 401 || unconsumedResponse.statusCode == 403)
          && _authorizations.containsKey(entry.id)
          && !entry.capabilityRefreshed) {
        await _cancelResponse(unconsumedResponse);
        unconsumedResponse = null;
        if (!_isRunCurrent(entry)) return;
        entry.capabilityRefreshed = true;
        final refreshed = await _refreshCapability(entry.id);
        if (!_isRunCurrent(entry)) return;
        if (!refreshed) {
          _fail(entry.id, entry.managerGeneration, run: entry);
          return;
        }
        // نفس الجري يُعاد من الموضع المحفوظ، فلا يُعاد تنزيل ما وصل.
        await _run(entry);
        return;
      }

      if (unconsumedResponse.statusCode == 206) {
        final contentRange = unconsumedResponse.headers['content-range'];
        final etag = unconsumedResponse.headers['etag'] ?? expectedEtag;
        final total =
            _parseTotalFromContentRange(contentRange) ??
            unconsumedResponse.contentLength ??
            0;
        if (total > maxItemBytes) {
          await _cancelResponse(unconsumedResponse);
          unconsumedResponse = null;
          if (!_isRunCurrent(entry)) return;
          _fail(entry.id, entry.managerGeneration, run: entry);
          return;
        }
        if (total != 0) {
          _update(
            entry.id,
            (current) => current.copyWith(totalBytes: total, etag: etag),
          );
        }
        final partialResponse = unconsumedResponse;
        unconsumedResponse = null;
        await _streamToPart(entry, partialResponse, offset, etag);
        return;
      }

      if (unconsumedResponse.statusCode >= 200 &&
          unconsumedResponse.statusCode < 300) {
        // If a ranged request gets 200, the server ignored Range; opening the
        // part in write mode below truncates it and restarts from zero.
        if (offset > 0) {
          offset = 0;
          _update(entry.id, (current) => current.copyWith(receivedBytes: 0));
        }
        final etag = unconsumedResponse.headers['etag'];
        final total = unconsumedResponse.contentLength ?? 0;
        if (total > maxItemBytes) {
          await _cancelResponse(unconsumedResponse);
          unconsumedResponse = null;
          if (!_isRunCurrent(entry)) return;
          _fail(entry.id, entry.managerGeneration, run: entry);
          return;
        }
        if (total != 0) {
          _update(
            entry.id,
            (current) => current.copyWith(totalBytes: total, etag: etag),
          );
        }
        final fullResponse = unconsumedResponse;
        unconsumedResponse = null;
        await _streamToPart(entry, fullResponse, 0, etag);
        return;
      }

      await _cancelResponse(unconsumedResponse);
      unconsumedResponse = null;
      if (!_isRunCurrent(entry)) return;
      _fail(entry.id, entry.managerGeneration, run: entry);
    } catch (_) {
      if (!_isRunCurrent(entry)) return;
      _fail(entry.id, entry.managerGeneration, run: entry);
    } finally {
      final response = unconsumedResponse;
      if (response != null) await _cancelResponse(response);
    }
  }

  Future<http.StreamedResponse?> _send(
    http.BaseRequest request,
    _RunEntry entry,
  ) async {
    if (!_isRunCurrent(entry)) return null;

    late Future<http.StreamedResponse> pending;
    try {
      pending = _client.send(request);
    } catch (_) {
      if (!_isRunCurrent(entry)) return null;
      rethrow;
    }

    Object? result;
    try {
      result = await Future.any<Object?>([
        pending.then<Object?>((response) => response),
        entry.control.cancelled.then<Object?>((_) => null),
      ]);
    } catch (_) {
      if (!_isRunCurrent(entry)) return null;
      rethrow;
    }

    if (result == null) {
      _discardPendingResponse(pending);
      return null;
    }
    final response = result as http.StreamedResponse;
    if (!_isRunCurrent(entry)) {
      await _cancelResponse(response);
      return null;
    }
    return response;
  }

  void _discardPendingResponse(Future<http.StreamedResponse> pending) {
    unawaited(
      pending.then<void>(
        _cancelResponse,
        onError: (Object _, StackTrace __) {},
      ),
    );
  }

  Future<void> _cancelResponse(http.StreamedResponse response) async {
    StreamSubscription<List<int>>? subscription;
    try {
      subscription = response.stream.listen(null);
      await subscription.cancel();
    } catch (_) {
      try {
        await subscription?.cancel();
      } catch (_) {
        // إلغاء اشتراك أُلغي أو انقطع. الغرض من هذه الدالّة تحرير المقبس، وقد
        // تحرّر بالانقطاع نفسه. لا شيء يُسجَّل: المسار هو الحالة الطبيعية.
      }
    }
  }

  int? _parseTotalFromContentRange(String? contentRange) {
    if (contentRange == null) return null;
    // bytes 0-1023/5000
    final parts = contentRange.split('/');
    if (parts.length != 2) return null;
    return int.tryParse(parts[1]);
  }

  Future<void> _streamToPart(
    _RunEntry entry,
    http.StreamedResponse response,
    int offset,
    String? etag,
  ) async {
    ChunkedPackageWriter? writer;
    StreamingDigest? integrity;
    StreamIterator<List<int>>? iterator;
    if (!_isRunCurrent(entry)) {
      await _cancelResponse(response);
      return;
    }
    final item = byId(entry.id);
    if (item == null) {
      await _cancelResponse(response);
      return;
    }

    final streamIterator = StreamIterator<List<int>>(response.stream);
    iterator = streamIterator;
    entry.control.attachStream(streamIterator);
    // Start listening before any filesystem await so cancellation always owns
    // a live response subscription, while StreamIterator keeps at most one
    // chunk pending until the part file is ready.
    final firstMove = _moveNext(streamIterator, entry);
    unawaited(
      firstMove.then<void>((_) {}, onError: (Object _, StackTrace __) {}),
    );

    try {
      final partFile = await _repo.partFileFor(item);
      if (!_isRunCurrent(entry)) return;
      // ENC-003: يُشفَّر أثناء الوصول. لا نصّ صريح على القرص في أي لحظة.
      final packageWriter = await _repo.openEncryptingWriter(
        item,
        resume: offset > 0,
      );
      writer = packageWriter;
      if (packageWriter.plainOffset != offset) {
        // الحزمة الجزئية لا تطابق الموضع الذي طُلب به `Range`، فما سيوصل لا
        // يُلحَق بما هو موجود. البداية من الصفر أسلم من ملف مخيط من نصفين.
        await packageWriter.close();
        writer = null;
        await _deletePartIfPresent(partFile, entry);
        if (!_isRunCurrent(entry)) return;
        _fail(entry.id, entry.managerGeneration, run: entry);
        return;
      }

      // ENC-007: بصمة ما وصل تُحسب أثناء التدفّق لا بعده.
      //
      // حسابها بعد الكتابة كان يعني قراءة الملف كاملًا مرة ثانية — وهو ما أُزيل
      // في `ENC-006`. وتُحسب **قبل** التشفير لأن البصمة المنشورة بصمة النصّ
      // الصريح.
      //
      // الاستئناف يُلغيها: ما وصل في جلسة سابقة ليس في هذه، فلا يمكن حساب بصمة
      // الملف كاملًا. التحقّق يجري على التنزيلات المكتملة في جلسة واحدة، وهو
      // حدّ مذكور لا مُدَّعى عكسه.
      final expectedSha = offset == 0 ? _authorizations[item.id]?.sourceSha256 : null;
      if (expectedSha != null) integrity = StreamingDigest();

      var received = offset;
      var lastEmit = received;
      var lastSave = DateTime.now();
      var useFirstMove = true;
      while (true) {
        final hasNext = await (useFirstMove
            ? firstMove
            : _moveNext(streamIterator, entry));
        useFirstMove = false;
        if (!_isRunCurrent(entry) || hasNext == null) return;
        if (!hasNext) break;

        final chunk = streamIterator.current;
        if (!_isRunCurrent(entry)) return;
        await packageWriter.add(chunk);
        integrity?.add(chunk);
        received += chunk.length;
        if (received > maxItemBytes) {
          await packageWriter.close();
          writer = null;
          if (!_isRunCurrent(entry)) return;
          await entry.control.releaseStream(streamIterator);
          iterator = null;
          if (!_isRunCurrent(entry)) return;
          await _deletePartIfPresent(partFile, entry);
          if (!_isRunCurrent(entry)) return;
          _fail(entry.id, entry.managerGeneration, run: entry);
          return;
        }
        if (received - lastEmit > 64 * 1024) {
          lastEmit = received;
          _update(
            entry.id,
            (current) => current.copyWith(receivedBytes: received, etag: etag),
          );
          // Throttle persistence while preserving snapshot order.
          if (DateTime.now().difference(lastSave).inMilliseconds > 800) {
            lastSave = DateTime.now();
            await _saveSnapshot(
              entry.managerGeneration,
              id: entry.id,
              idGeneration: entry.idGeneration,
              run: entry,
            );
            if (!_isRunCurrent(entry)) return;
          }
        }
      }

      // ENC-007: لا يُعتمد ما لا تطابق بصمته.
      //
      // TLS وETag لا يكفيان: أصل مستبدل على المنشأ، أو استجابة مقطوعة يقبلها
      // الطرفان كـ200، تُخزَّن مشفَّرة وتُعتبر سليمة — ثم تفشل عند التشغيل بعد
      // أيام بلا سبب ظاهر.
      if (integrity != null && expectedSha != null) {
        final actual = integrity.hex();
        if (actual != expectedSha.toLowerCase()) {
          await packageWriter.close();
          writer = null;
          if (!_isRunCurrent(entry)) return;
          // الحزمة الجزئية تُحذف: البناء عليها في محاولة تالية يعني الاستئناف
          // فوق بايتات خطأ.
          await _deletePartIfPresent(partFile, entry);
          if (!_isRunCurrent(entry)) return;
          _fail(entry.id, entry.managerGeneration, run: entry);
          return;
        }
      }

      // إتمام الحزمة: الجزء الأخير بعلامته، ثم إغلاق.
      await packageWriter.finish();
      writer = null;
      if (!_isRunCurrent(entry)) return;

      final current = byId(entry.id);
      if (current == null) return;

      // الترقية بإعادة التسمية لا بإعادة التشفير: الملف مشفَّر أصلًا.
      // (سابقًا كان هنا `partFile.readAsBytes()` ثم تشفير الملف كله — نصف
      // جيجابايت في الذاكرة وملف صريح على القرص حتى تلك اللحظة.)
      final size = await _repo.promoteCompletedPart(current);
      if (!_isRunCurrent(entry)) return;

      // ENC-005: الانتهاء من الخادم إن كان مخوَّلًا، ومن الثابت المحلي في مسار
      // الاختبار وحده. الترخيص الموقَّع هو السلطة على أي حال — هذا الحقل صار
      // للعرض في القائمة لا للفرض، والفرض في `LicenseGuard.authorize`.
      final serverExpiry = _authorizations[item.id]?.expiresAt;
      final expiresAt = (serverExpiry ?? DateTime.now().add(offlineLicenseDuration))
          .millisecondsSinceEpoch;
      _update(
        entry.id,
        (download) => download.copyWith(
          status: DownloadStatus.ready,
          receivedBytes: size,
          totalBytes: size,
          expiresAt: expiresAt,
          etag: etag,
        ),
      );
      await _saveSnapshot(
        entry.managerGeneration,
        id: entry.id,
        idGeneration: entry.idGeneration,
        run: entry,
      );
      if (!_isRunCurrent(entry)) return;

      // ENC-001: الخادم يعرف أن التنزيل اكتمل، فيصير الترخيص `active` وتُسجَّل
      // صفوف ما نُزِّل. فشل الإبلاغ لا يُفشل التنزيل: الملف على الجهاز وترخيصه
      // صالح، وحالة `pending` تُصحَّح عند أول جلسة تالية.
      final completed = _authorizations.remove(entry.id);
      if (completed != null) {
        try {
          await _onDownloadCompleted?.call(completed.licenceId);
        } catch (error) {
          // لا يُفشِل التنزيل (السبب أعلاه)، لكنه يُسجَّل: تكراره يعني تراخيص
          // تبقى `pending` على الخادم بينما ملفاتها مكتملة على الجهاز — وهو فرق
          // يظهر في حدود الباقة لا في شاشة الأسرة.
          reportIgnoredError('download_manager.completion_report', error);
        }
      }
      if (!_isRunCurrent(entry)) return;
      MajarraAnalytics.downloadSucceeded(current.contentType);
    } catch (_) {
      if (!_isRunCurrent(entry)) return;
      _fail(entry.id, entry.managerGeneration, run: entry);
    } finally {
      // الإغلاق بلا جزء أخير: ما كُتب يبقى حزمة جزئية قابلة للاستئناف، وما
      // كان في مخزن الذاكرة (أقل من جزء) يُعاد تنزيله.
      await writer?.close();
      integrity?.close();
      final activeIterator = iterator;
      if (activeIterator != null) {
        await entry.control.releaseStream(activeIterator);
      }
    }
  }

  Future<bool?> _moveNext(
    StreamIterator<List<int>> iterator,
    _RunEntry entry,
  ) async {
    if (!_isRunCurrent(entry)) return null;
    final result = await Future.any<Object?>([
      iterator.moveNext().then<Object?>((hasNext) => hasNext),
      entry.control.cancelled.then<Object?>((_) => null),
    ]);
    if (!_isRunCurrent(entry) || result == null) return null;
    return result as bool;
  }

  Future<void> _deletePartIfPresent(File part, _RunEntry entry) async {
    if (!_isRunCurrent(entry)) return;
    try {
      final exists = await part.exists();
      if (!_isRunCurrent(entry)) return;
      if (exists) {
        await part.delete();
        if (!_isRunCurrent(entry)) return;
      }
    } catch (_) {
      if (!_isRunCurrent(entry)) return;
    }
  }

  /// Cancels an in-flight download but keeps the row so the user can retry.
  Future<void> pause(String id) => _startOperation<void>(
    (generation) => _pause(id, generation),
    whenFenced: () {},
  );

  Future<void> _pause(String id, int generation) async {
    if (!_isCurrent(generation)) return;
    _block(id);
    final idGeneration = _nextIdGeneration(id);
    final run = _runs[id];
    run?.control.requestCancel();
    try {
      if (run != null) {
        try {
          await run.future;
        } catch (_) {
          // انتظارٌ لجولة طُلب إلغاؤها قبل سطرين: فشلها هو **النتيجة المرجوّة**.
          // وسببها الحقيقي — إن كان عطلًا لا إلغاءً — مُسجَّل في حالة العنصر من
          // داخل الجولة نفسها، فتسجيله هنا تكرار.
        }
        if (!_isIdCurrent(id, generation, idGeneration)) return;
      }
      if (byId(id) == null) return;
      _update(id, (item) => item.copyWith(status: DownloadStatus.paused));
      await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
      if (!_isIdCurrent(id, generation, idGeneration)) return;
    } finally {
      _unblock(id);
    }
  }

  Future<void> resume(String id) => _startOperation<void>(
    (generation) => _resume(id, generation),
    whenFenced: () {},
  );

  Future<void> _resume(String id, int generation) async {
    if (!_isCurrent(generation) || _isBlocked(id)) return;
    final item = byId(id);
    if (item == null) return;
    final idGeneration = _idGeneration(id);

    final entitled = await _isEntitled();
    if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) return;
    if (!entitled) {
      _fail(id, generation, idGeneration: idGeneration);
      await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
      if (!_isIdCurrent(id, generation, idGeneration)) return;
      return;
    }

    final networkAllowed = await _networkAllows();
    if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) return;
    if (!networkAllowed) return;
    await _startRun(id, generation);
    if (!_isCurrent(generation)) return;
  }

  Future<void> retry(String id) => resume(id);

  Future<void> delete(String id) => _startOperation<void>(
    (generation) => _delete(id, generation),
    whenFenced: () {},
  );

  Future<void> _delete(String id, int generation) async {
    if (!_isCurrent(generation)) return;
    _block(id);
    final idGeneration = _nextIdGeneration(id);
    final run = _runs[id];
    run?.control.requestCancel();
    try {
      if (run != null) {
        try {
          await run.future;
        } catch (_) {
          // كما في `_pause`: فشل جولة أُلغيت عن قصد. والحذف يمضي بعده لأن غرضه
          // إزالة الملف لا إنجاح الجولة.
        }
        if (!_isIdCurrent(id, generation, idGeneration)) return;
      }

      final item = byId(id);
      if (item == null) return;
      await _repo.deleteFile(item);
      if (!_isIdCurrent(id, generation, idGeneration)) return;
      state = state.where((download) => download.id != id).toList();
      await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
      if (!_isIdCurrent(id, generation, idGeneration)) return;
    } finally {
      _unblock(id);
    }
  }

  Future<void> deleteAll([String? childId]) => _startOperation<void>(
    (generation) => _deleteAll(childId, generation),
    whenFenced: () {},
  );

  Future<void> _deleteAll(String? childId, int generation) async {
    if (!_isCurrent(generation)) return;
    final toRemove = childId == null
        ? List<DownloadItem>.from(state)
        : state.where((item) => item.childId == childId).toList();
    final generations = <String, int>{};
    final matchingRuns = <Future<void>>[];

    for (final item in toRemove) {
      _block(item.id);
      generations[item.id] = _nextIdGeneration(item.id);
      final run = _runs[item.id];
      if (run != null) {
        run.control.requestCancel();
        matchingRuns.add(run.future);
      }
    }

    try {
      if (matchingRuns.isNotEmpty) {
        try {
          await Future.wait<void>(matchingRuns);
        } catch (_) {
          // `Future.wait` ترفع بأوّل فشل، والمطلوب هنا **انتظار الكلّ** لا نجاح
          // الكلّ: كلّها جولات طُلب إلغاؤها.
        }
        if (!_isCurrent(generation)) return;
      }

      final removeIds = <String>{};
      for (final original in toRemove) {
        final idGeneration = generations[original.id]!;
        if (!_isIdCurrent(original.id, generation, idGeneration)) continue;
        final item = byId(original.id) ?? original;
        try {
          await _repo.deleteFile(item);
        } catch (_) {
          // Continue attempting every file. Metadata is removed below so a
          // failed orphan remains encrypted and is no longer playable by the app.
        }
        if (!_isCurrent(generation)) return;
        if (_idGeneration(original.id) == idGeneration) {
          removeIds.add(original.id);
        }
      }

      if (!_isCurrent(generation)) return;
      state = state.where((item) => !removeIds.contains(item.id)).toList();
      await _saveSnapshot(generation);
      if (!_isCurrent(generation)) return;
    } finally {
      for (final item in toRemove) {
        _unblock(item.id);
      }
    }
  }

  /// Resolves a ready download to a temporary plaintext file for playback, or
  /// null if it is not playable (expired, missing file, or corrupt).
  Future<String?> preparePlayback(String id) => _startOperation<String?>(
    (generation) => _preparePlayback(id, generation),
    whenFenced: () => null,
  );

  Future<String?> _preparePlayback(String id, int generation) async {
    if (!_isCurrent(generation) || _isBlocked(id)) return null;
    final item = byId(id);
    if (item == null || !item.status.isPlayable) return null;
    final idGeneration = _idGeneration(id);

    if (item.isExpired()) {
      _update(
        id,
        (current) => current.copyWith(status: DownloadStatus.expired),
      );
      await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
      if (!_isIdCurrent(id, generation, idGeneration)) return null;
      return null;
    }

    final hasFile = await _repo.hasFile(item);
    if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) {
      return null;
    }
    if (!hasFile) {
      _fail(id, generation, idGeneration: idGeneration);
      await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
      if (!_isIdCurrent(id, generation, idGeneration)) return null;
      return null;
    }

    // ENC-005: الترخيص الموقَّع يُتحقَّق منه قبل كل تشغيل.
    //
    // هذه هي البوابة التي كانت غائبة: `isExpired()` كان يقارن تاريخًا محسوبًا
    // على الجهاز بـ`DateTime.now()`، فتأخير الساعة أو تحرير الميتاداتا يمدّد
    // الصلاحية. الآن الانتهاء والملكية والجهاز والعهد كلها موقَّعة من الخادم،
    // وتحرير أي حقل يُفشل التوقيع.
    final licenses = _licenses;
    if (licenses != null) {
      try {
        await licenses.authorize(
          id,
          expectedEntityType: item.contentType,
          expectedEntityId: item.id,
          expectedChildId: item.childId,
        );
      } on LicenseException {
        // الرفض لا يحذف الملف: قد يكون السبب انتهاءً قابلًا للتجديد باتصال
        // واحد، وحذف المحتوى عقوبةً على ذلك يُهدر بيانات الأسرة.
        _fail(id, generation, idGeneration: idGeneration);
        await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
        return null;
      }
      if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) return null;
    }

    try {
      // ENC-004: رابط محلي يفكّ عند الطلب، لا ملف صريح على القرص.
      final source = await _repo.playbackSourceFor(item);
      if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) {
        await _repo.releasePlaybackSource(source);
        return null;
      }
      _playbackSources[id] = source;
      return source.toString();
    } catch (_) {
      if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) {
        return null;
      }
      // GCM tag mismatch → tampered/corrupt. Mark failed rather than crash.
      _fail(id, generation, idGeneration: idGeneration);
      await _saveSnapshot(generation, id: id, idGeneration: idGeneration);
      if (!_isIdCurrent(id, generation, idGeneration)) return null;
      return null;
    }
  }

  /// يوقف مصدر التشغيل المحلي، ويحفظ الحزمة المشفَّرة وبياناتها كما هي.
  ///
  /// ENC-004: لم يبقَ «ملف صريح مؤقّت» ليُحذَف — يُغلَق الرابط المحلي فيصير
  /// المسار السرّي بلا معنى. وحذف `.play_*` يبقى مستدعى لأن أجهزة المستخدمين
  /// قد تحمل ملفًا صريحًا كتبته نسخة أقدم من التطبيق.
  Future<void> cleanupPlaybackFile(String id) => _startOperation<void>(
    (generation) => _cleanupPlaybackFile(id, generation),
    whenFenced: () {},
  );

  Future<void> _cleanupPlaybackFile(String id, int generation) async {
    if (!_isCurrent(generation) || _isBlocked(id)) return;
    final source = _playbackSources.remove(id);
    if (source != null) await _repo.releasePlaybackSource(source);
    final item = byId(id);
    if (item == null) return;
    final idGeneration = _idGeneration(id);
    await _repo.deletePlayFile(item);
    if (!_isIdCurrent(id, generation, idGeneration)) return;
  }

  Future<void> _saveSnapshot(
    int generation, {
    String? id,
    int? idGeneration,
    _RunEntry? run,
  }) {
    if (!_isFenceCurrent(
      generation,
      id: id,
      idGeneration: idGeneration,
      run: run,
    )) {
      return Future<void>.value();
    }

    final snapshot = List<DownloadItem>.unmodifiable(state);
    final previous = _saveTail;
    final save = previous.then<void>((_) async {
      if (!_isFenceCurrent(
        generation,
        id: id,
        idGeneration: idGeneration,
        run: run,
      )) {
        return;
      }
      await _repo.saveAll(snapshot);
    });
    _saveTail = save.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return save;
  }

  void _fail(String id, int generation, {int? idGeneration, _RunEntry? run}) {
    if (!_isFenceCurrent(
      generation,
      id: id,
      idGeneration: idGeneration,
      run: run,
    )) {
      return;
    }
    final item = byId(id);
    _update(id, (current) => current.copyWith(status: DownloadStatus.failed));
    if (item != null) MajarraAnalytics.downloadFailed(item.contentType);
  }

  bool _isCurrent(int generation) =>
      !_shuttingDown && generation == _generation;

  bool _isIdCurrent(String id, int generation, int idGeneration) =>
      _isCurrent(generation) && _idGeneration(id) == idGeneration;

  bool _isRunCurrent(_RunEntry entry) =>
      !entry.control.isCancelled &&
      _isIdCurrent(entry.id, entry.managerGeneration, entry.idGeneration) &&
      identical(_runs[entry.id], entry);

  bool _isFenceCurrent(
    int generation, {
    String? id,
    int? idGeneration,
    _RunEntry? run,
  }) {
    if (run != null) return _isRunCurrent(run);
    if (!_isCurrent(generation)) return false;
    if (id == null) return true;
    return idGeneration != null && _idGeneration(id) == idGeneration;
  }

  int _idGeneration(String id) => _idGenerations[id] ?? 0;

  int _nextIdGeneration(String id) {
    final next = _idGeneration(id) + 1;
    _idGenerations[id] = next;
    return next;
  }

  bool _isBlocked(String id) => (_blockedIds[id] ?? 0) > 0;

  void _block(String id) {
    _blockedIds[id] = (_blockedIds[id] ?? 0) + 1;
  }

  void _unblock(String id) {
    final remaining = (_blockedIds[id] ?? 1) - 1;
    if (remaining <= 0) {
      _blockedIds.remove(id);
    } else {
      _blockedIds[id] = remaining;
    }
  }

  void _upsert(DownloadItem item) {
    final next = [
      for (final current in state)
        if (current.id != item.id) current,
      item,
    ];
    state = next;
  }

  void _update(String id, DownloadItem Function(DownloadItem) update) {
    state = [
      for (final item in state)
        if (item.id == id) update(item) else item,
    ];
  }
}

class _RunEntry {
  _RunEntry({
    required this.id,
    required this.managerGeneration,
    required this.idGeneration,
  });

  final String id;
  final int managerGeneration;
  final int idGeneration;
  final _RunControl control = _RunControl();

  /// هل جُدِّدت قدرة الوسائط في هذا الجري؟ (`ENC-008`)
  ///
  /// مرة واحدة لا حلقة: خادم يردّ 401 دائمًا — لأن الترخيص سُحب مثلًا — كان
  /// سيُنتج تجديدًا لا نهائيًّا لو لم يُحدَّ.
  bool capabilityRefreshed = false;

  final Completer<void> _completion = Completer<void>();

  Future<void> get future => _completion.future;

  void complete() {
    if (!_completion.isCompleted) _completion.complete();
  }

  void completeError(Object error, StackTrace stackTrace) {
    if (!_completion.isCompleted) {
      _completion.completeError(error, stackTrace);
    }
  }
}

class _RunControl {
  final Completer<void> _cancelled = Completer<void>();
  StreamIterator<List<int>>? _iterator;
  Future<void>? _streamCancellation;

  bool get isCancelled => _cancelled.isCompleted;
  Future<void> get cancelled => _cancelled.future;

  void requestCancel() {
    if (!_cancelled.isCompleted) _cancelled.complete();
    final iterator = _iterator;
    if (iterator != null && _streamCancellation == null) {
      _streamCancellation = _cancelIterator(iterator);
    }
  }

  void attachStream(StreamIterator<List<int>> iterator) {
    _iterator = iterator;
    if (isCancelled && _streamCancellation == null) {
      _streamCancellation = _cancelIterator(iterator);
    }
  }

  Future<void> releaseStream(StreamIterator<List<int>> iterator) {
    if (identical(_iterator, iterator)) _iterator = null;
    final cancellation = _streamCancellation;
    if (cancellation != null) return cancellation;
    return _cancelIterator(iterator);
  }

  Future<void> _cancelIterator(StreamIterator<List<int>> iterator) async {
    try {
      await iterator.cancel();
    } catch (_) {
      // نفس المنطق: الإلغاء بعد انقطاع يرفع، والمقبس محرَّر أصلًا.
    }
  }
}
