import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../../core/analytics/analytics.dart';
import '../data/download_repository.dart';
import '../domain/download_models.dart';

/// Why a download could not start. Surfaced to the UI so the reason is truthful
/// ("you are on mobile data") rather than a generic failure.
enum DownloadRejection {
  none,
  notEntitled,
  offlineOrMetered,
  storageFull,
  alreadyExists,
  noSource,
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
  }) : _repo = repository,
       _client = client,
       _isEntitled = isEntitled,
       _networkAllows = networkAllowsDownload,
       super(const []) {
    unawaited(_startOperation<void>(_restore, whenFenced: () {}));
  }

  final DownloadRepository _repo;
  final http.Client _client;
  final Future<bool> Function() _isEntitled;
  final Future<bool> Function() _networkAllows;
  final Duration offlineLicenseDuration;
  final int maxTotalBytes;
  final int maxItemBytes;

  final Set<Future<void>> _operations = <Future<void>>{};
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

      final item = DownloadItem(
        id: request.id,
        childId: request.childId,
        contentType: request.contentType,
        title: request.title,
        subtitle: request.subtitle,
        sourceUrl: request.sourceUrl,
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

  Future<void> _run(_RunEntry entry) async {
    if (!_isRunCurrent(entry)) return;
    _update(
      entry.id,
      (item) => item.copyWith(status: DownloadStatus.downloading),
    );

    var item = byId(entry.id);
    if (item == null || !_isRunCurrent(entry)) return;
    http.StreamedResponse? unconsumedResponse;
    try {
      final uri = Uri.parse(item.sourceUrl);

      // Determine resume offset from the persisted part file.
      var offset = item.receivedBytes;
      final expectedEtag = item.etag;
      try {
        if (!_isRunCurrent(entry)) return;
        final part = await _repo.partFileFor(item);
        if (!_isRunCurrent(entry)) return;
        final exists = await part.exists();
        if (!_isRunCurrent(entry)) return;
        if (exists) {
          final length = await part.length();
          if (!_isRunCurrent(entry)) return;
          if (length != offset && length > 0) {
            offset = length;
            _update(
              entry.id,
              (current) => current.copyWith(receivedBytes: offset),
            );
          }
        } else if (offset > 0) {
          // Persisted offset but no part file — restart.
          offset = 0;
        }
      } catch (_) {
        if (!_isRunCurrent(entry)) return;
      }

      final headers = <String, String>{};
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
      } catch (_) {}
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
    IOSink? sink;
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
      final openSink = partFile.openWrite(
        mode: offset > 0 ? FileMode.append : FileMode.write,
      );
      sink = openSink;

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
        openSink.add(chunk);
        received += chunk.length;
        if (received > maxItemBytes) {
          await _safeCloseSink(openSink);
          sink = null;
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

      await openSink.flush();
      if (!_isRunCurrent(entry)) return;
      await openSink.close();
      sink = null;
      if (!_isRunCurrent(entry)) return;

      // Read the completed part and encrypt it into managed storage.
      final bytes = await partFile.readAsBytes();
      if (!_isRunCurrent(entry)) return;
      final current = byId(entry.id);
      if (current == null) return;

      final size = await _repo.writeEncrypted(current, bytes);
      if (!_isRunCurrent(entry)) return;
      await _deletePartIfPresent(partFile, entry);
      if (!_isRunCurrent(entry)) return;

      final expiresAt = DateTime.now()
          .add(offlineLicenseDuration)
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
      MajarraAnalytics.downloadSucceeded(current.contentType);
    } catch (_) {
      if (!_isRunCurrent(entry)) return;
      _fail(entry.id, entry.managerGeneration, run: entry);
    } finally {
      final openSink = sink;
      if (openSink != null) await _safeCloseSink(openSink);
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

  Future<void> _safeCloseSink(IOSink sink) async {
    try {
      await sink.close();
    } catch (_) {}
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
        } catch (_) {}
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
        } catch (_) {}
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
        } catch (_) {}
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

    try {
      final file = await _repo.decryptForPlayback(item);
      if (!_isIdCurrent(id, generation, idGeneration) || _isBlocked(id)) {
        return null;
      }
      return file.path;
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

  /// Removes the temporary plaintext copy created for playback while keeping
  /// the encrypted offline file and its metadata intact.
  Future<void> cleanupPlaybackFile(String id) => _startOperation<void>(
    (generation) => _cleanupPlaybackFile(id, generation),
    whenFenced: () {},
  );

  Future<void> _cleanupPlaybackFile(String id, int generation) async {
    if (!_isCurrent(generation) || _isBlocked(id)) return;
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
    } catch (_) {}
  }
}
