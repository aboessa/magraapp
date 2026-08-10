import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../data/download_repository.dart';
import '../domain/download_models.dart';

/// Why a download could not start. Surfaced to the UI so the reason is truthful
/// ("you are on mobile data") rather than a generic failure.
enum DownloadRejection { none, notEntitled, offlineOrMetered, storageFull, alreadyExists, noSource }

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
/// client and a temp-directory repository.
class DownloadManager extends StateNotifier<List<DownloadItem>> {
  DownloadManager({
    required DownloadRepository repository,
    required http.Client client,
    required Future<bool> Function() isEntitled,
    required Future<bool> Function() networkAllowsDownload,
    this.offlineLicenseDuration = const Duration(days: 30),
    this.maxTotalBytes = 2 * 1024 * 1024 * 1024, // 2 GiB device budget.
    this.maxItemBytes = 512 * 1024 * 1024,
  })  : _repo = repository,
        _client = client,
        _isEntitled = isEntitled,
        _networkAllows = networkAllowsDownload,
        super(const []) {
    _restore();
  }

  final DownloadRepository _repo;
  final http.Client _client;
  final Future<bool> Function() _isEntitled;
  final Future<bool> Function() _networkAllows;
  final Duration offlineLicenseDuration;
  final int maxTotalBytes;
  final int maxItemBytes;

  final Set<String> _cancelled = {};

  Future<void> _restore() async {
    final items = _repo.loadAll();
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
    if (!listEquals(items, reconciled)) await _repo.saveAll(reconciled);
  }

  DownloadItem? byId(String id) {
    for (final item in state) {
      if (item.id == id) return item;
    }
    return null;
  }

  List<DownloadItem> forChild(String childId) =>
      state.where((i) => i.childId == childId).toList();

  Future<int> storageUsedBytes() => _repo.totalBytesOnDisk();

  /// Validates and enqueues a download, then starts it. Returns the reason it
  /// was refused, or [DownloadRejection.none] on success.
  Future<DownloadRejection> enqueue(DownloadRequest request) async {
    if (request.sourceUrl.isEmpty) return DownloadRejection.noSource;
    if (byId(request.id) != null) return DownloadRejection.alreadyExists;

    if (!await _isEntitled()) return DownloadRejection.notEntitled;
    if (!await _networkAllows()) return DownloadRejection.offlineOrMetered;

    final used = await _repo.totalBytesOnDisk();
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
    );
    _upsert(item);
    await _repo.saveAll(state);
    unawaited(_run(item.id));
    return DownloadRejection.none;
  }

  Future<void> _run(String id) async {
    _cancelled.remove(id);
    _update(id, (i) => i.copyWith(status: DownloadStatus.downloading));

    final item = byId(id);
    if (item == null) return;

    try {
      final uri = Uri.parse(item.sourceUrl);
      final requestObj = http.Request('GET', uri);
      final response = await _client.send(requestObj);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        _fail(id);
        return;
      }

      final total = response.contentLength ?? 0;
      if (total > maxItemBytes) {
        _fail(id);
        return;
      }
      _update(id, (i) => i.copyWith(totalBytes: total));

      final builder = BytesBuilder(copy: false);
      var received = 0;
      var lastEmit = 0;
      await for (final chunk in response.stream) {
        if (_cancelled.contains(id)) {
          _update(id, (i) => i.copyWith(status: DownloadStatus.paused));
          return;
        }
        builder.add(chunk);
        received += chunk.length;
        if (received - lastEmit > 64 * 1024) {
          lastEmit = received;
          _update(id, (i) => i.copyWith(receivedBytes: received));
        }
        if (received > maxItemBytes) {
          _fail(id);
          return;
        }
      }

      final bytes = builder.toBytes();
      final current = byId(id);
      if (current == null || _cancelled.contains(id)) return;
      final size = await _repo.writeEncrypted(current, Uint8List.fromList(bytes));

      final expiresAt = DateTime.now()
          .add(offlineLicenseDuration)
          .millisecondsSinceEpoch;
      _update(
        id,
        (i) => i.copyWith(
          status: DownloadStatus.ready,
          receivedBytes: size,
          totalBytes: size,
          expiresAt: expiresAt,
        ),
      );
      await _repo.saveAll(state);
    } catch (_) {
      _fail(id);
    }
  }

  /// Cancels an in-flight download but keeps the row so the user can retry.
  void pause(String id) {
    _cancelled.add(id);
    _update(id, (i) => i.copyWith(status: DownloadStatus.paused));
  }

  Future<void> resume(String id) async {
    final item = byId(id);
    if (item == null) return;
    if (!await _networkAllows()) return;
    await _run(id);
  }

  Future<void> retry(String id) => resume(id);

  Future<void> delete(String id) async {
    final item = byId(id);
    if (item == null) return;
    _cancelled.add(id);
    await _repo.deleteFile(item);
    state = state.where((i) => i.id != id).toList();
    await _repo.saveAll(state);
  }

  Future<void> deleteAll([String? childId]) async {
    final toRemove = childId == null
        ? List<DownloadItem>.from(state)
        : state.where((i) => i.childId == childId).toList();
    for (final item in toRemove) {
      _cancelled.add(item.id);
      await _repo.deleteFile(item);
    }
    final removeIds = toRemove.map((i) => i.id).toSet();
    state = state.where((i) => !removeIds.contains(i.id)).toList();
    await _repo.saveAll(state);
  }

  /// Resolves a ready download to a temporary plaintext file for playback, or
  /// null if it is not playable (expired, missing file, or corrupt).
  Future<String?> preparePlayback(String id) async {
    final item = byId(id);
    if (item == null || !item.status.isPlayable) return null;
    if (item.isExpired()) {
      _update(id, (i) => i.copyWith(status: DownloadStatus.expired));
      await _repo.saveAll(state);
      return null;
    }
    if (!await _repo.hasFile(item)) {
      _fail(id);
      await _repo.saveAll(state);
      return null;
    }
    try {
      final file = await _repo.decryptForPlayback(item);
      return file.path;
    } catch (_) {
      // GCM tag mismatch → tampered/corrupt. Mark failed rather than crash.
      _fail(id);
      await _repo.saveAll(state);
      return null;
    }
  }

  void _fail(String id) =>
      _update(id, (i) => i.copyWith(status: DownloadStatus.failed));

  void _upsert(DownloadItem item) {
    final next = [for (final i in state) if (i.id != item.id) i, item];
    state = next;
  }

  void _update(String id, DownloadItem Function(DownloadItem) fn) {
    state = [for (final i in state) if (i.id == id) fn(i) else i];
  }
}
