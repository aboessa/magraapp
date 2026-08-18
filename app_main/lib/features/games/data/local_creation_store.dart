/// Local storage for what a child draws.
///
/// ## The default is local
///
/// A drawing lives on the device and goes nowhere else unless someone explicitly
/// saves it. Nothing here uploads, and nothing here is called automatically on
/// level completion: `docs` and the product rule are both explicit that child
/// creations are never public and never leave the device implicitly.
///
/// ## Limits are enforced before anything is written
///
/// Dimensions are capped and the encoded size is checked, because a child can
/// tap "save" repeatedly and an uncapped canvas export on a high-DPI tablet is
/// several megabytes. Exceeding the cap is a refusal with a reason, not a
/// silently truncated file.
library;

import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Hard limits for an exported creation.
class CreationLimits {
  const CreationLimits({
    this.maxDimension = 1024,
    this.maxBytes = 2 * 1024 * 1024,
  });

  /// Longest edge, in pixels. 1024 is enough to look good on a phone and to
  /// print small, and small enough that the encode stays fast.
  final int maxDimension;

  /// 2 MiB. A flood-filled line drawing compresses far below this; anything
  /// above it is a sign the export went wrong.
  final int maxBytes;
}

enum CreationSaveOutcome { saved, tooLarge, renderFailed }

class CreationSaveResult {
  const CreationSaveResult({required this.outcome, this.creation, this.detail});

  final CreationSaveOutcome outcome;
  final LocalCreation? creation;
  final String? detail;

  bool get isSuccess => outcome == CreationSaveOutcome.saved;
}

/// A drawing held on the device.
///
/// New saves keep both a flattened PNG (for fast gallery grids) and the
/// versioned editable document JSON (for متابعة الرسم). Legacy entries that
/// have only the PNG are kept readable and surfaced as `flattened/legacy`.
class LocalCreation {
  const LocalCreation({
    required this.id,
    required this.childId,
    required this.gameId,
    required this.drawingMode,
    required this.width,
    required this.height,
    required this.byteLength,
    required this.createdAt,
    required this.pngBase64,
    this.uploadedCreationId,
    this.documentJson,
    this.documentVersion,
    this.title,
  });

  factory LocalCreation.fromJson(Map<String, dynamic> json) => LocalCreation(
    id: json['id'] as String,
    childId: json['child_id'] as String,
    gameId: json['game_id'] as String,
    drawingMode: json['drawing_mode'] as String,
    width: (json['width'] as num).toInt(),
    height: (json['height'] as num).toInt(),
    byteLength: (json['byte_length'] as num).toInt(),
    createdAt: DateTime.parse(json['created_at'] as String),
    pngBase64: json['png_base64'] as String,
    uploadedCreationId: json['uploaded_creation_id'] as String?,
    documentJson: json['document_json'] as String?,
    documentVersion: (json['document_version'] as num?)?.toInt(),
    title: json['title'] as String?,
  );

  final String id;
  final String childId;
  final String gameId;
  final String drawingMode;
  final int width;
  final int height;
  final int byteLength;
  final DateTime createdAt;

  /// The PNG itself. Base64 in shared preferences keeps this dependency-free;
  /// the byte cap is what makes that acceptable.
  final String pngBase64;

  /// Set once the creation has been copied to private family storage. Null means
  /// it exists only on this device, which is the default and needs no consent.
  final String? uploadedCreationId;

  /// Versioned editable document JSON (strokes/fills/canvas etc). Null for
  /// legacy flattened saves.
  final String? documentJson;

  /// Document version when [documentJson] is present.
  final int? documentVersion;

  /// Optional parent/child-friendly title for rename.
  final String? title;

  String get displayTitle =>
      title != null && title!.trim().isNotEmpty ? title! : drawingMode;

  Uint8List get bytes => base64Decode(pngBase64);

  bool get isUploaded => uploadedCreationId?.trim().isNotEmpty ?? false;

  /// True when an editable document is present and can be continued.
  bool get isEditable => documentJson != null && documentJson!.isNotEmpty;

  /// Legacy flattened-only save with no replay data.
  bool get isLegacy => !isEditable;

  Map<String, dynamic> toJson() => {
    'id': id,
    'child_id': childId,
    'game_id': gameId,
    'drawing_mode': drawingMode,
    'width': width,
    'height': height,
    'byte_length': byteLength,
    'created_at': createdAt.toIso8601String(),
    'png_base64': pngBase64,
    if (isUploaded) 'uploaded_creation_id': uploadedCreationId,
    if (documentJson != null) 'document_json': documentJson,
    if (documentVersion != null) 'document_version': documentVersion,
    if (title != null) 'title': title,
  };

  LocalCreation copyWith({
    String? uploadedCreationId,
    bool clearUploadedCreationId = false,
    String? documentJson,
    int? documentVersion,
    String? title,
  }) => LocalCreation(
    id: id,
    childId: childId,
    gameId: gameId,
    drawingMode: drawingMode,
    width: width,
    height: height,
    byteLength: byteLength,
    createdAt: createdAt,
    pngBase64: pngBase64,
    uploadedCreationId: clearUploadedCreationId
        ? null
        : uploadedCreationId ?? this.uploadedCreationId,
    documentJson: documentJson ?? this.documentJson,
    documentVersion: documentVersion ?? this.documentVersion,
    title: title ?? this.title,
  );
}

/// Renders and stores creations on the device.
class LocalCreationStore {
  LocalCreationStore({
    CreationLimits limits = const CreationLimits(),
    Future<SharedPreferences> Function()? preferences,
  }) : _limits = limits,
       _preferences = preferences ?? SharedPreferences.getInstance;

  static const _keyPrefix = 'majarra.creations.';

  /// How many creations are retained per child on the device.
  ///
  /// Was 24 (oldest dropped silently). New policy: 100 soft limit, UI warns at 80
  /// and at 95, never silently deletes oldest. Hard cap 200 to prevent unbounded growth.
  static const retainPerChild = 100;
  static const warnAt = 80;
  static const hardCap = 200;

  final CreationLimits _limits;
  final Future<SharedPreferences> Function() _preferences;

  String _key(String childId) => '$_keyPrefix$childId';

  /// Encodes a rendered canvas to PNG, honouring the dimension cap.
  ///
  /// Separated from [save] so the size policy can be tested without a real
  /// `RenderRepaintBoundary`.
  Future<CreationSaveResult> encode({
    required ui.Image image,
    required String childId,
    required String gameId,
    required String drawingMode,
    String Function()? idFactory,
  }) async {
    if (image.width > _limits.maxDimension ||
        image.height > _limits.maxDimension) {
      return CreationSaveResult(
        outcome: CreationSaveOutcome.tooLarge,
        detail:
            '${image.width}x${image.height} exceeds ${_limits.maxDimension}px',
      );
    }
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) {
      return const CreationSaveResult(
        outcome: CreationSaveOutcome.renderFailed,
      );
    }
    final bytes = data.buffer.asUint8List();
    if (bytes.lengthInBytes > _limits.maxBytes) {
      return CreationSaveResult(
        outcome: CreationSaveOutcome.tooLarge,
        detail: '${bytes.lengthInBytes} bytes exceeds ${_limits.maxBytes}',
      );
    }
    return CreationSaveResult(
      outcome: CreationSaveOutcome.saved,
      creation: LocalCreation(
        id:
            idFactory?.call() ??
            'creation-${DateTime.now().microsecondsSinceEpoch}',
        childId: childId,
        gameId: gameId,
        drawingMode: drawingMode,
        width: image.width,
        height: image.height,
        byteLength: bytes.lengthInBytes,
        createdAt: DateTime.now(),
        pngBase64: base64Encode(bytes),
      ),
    );
  }

  /// Captures [boundary] and stores the result.
  ///
  /// `pixelRatio` is clamped so a high-DPI device cannot produce an export above
  /// the dimension cap: the cap is about bytes on a child's device, not about the
  /// screen it happened to be drawn on.
  Future<CreationSaveResult> saveFromBoundary({
    required RenderRepaintBoundary boundary,
    required String childId,
    required String gameId,
    required String drawingMode,
    double pixelRatio = 2.0,
  }) async {
    final logicalMax = boundary.size.longestSide;
    final safeRatio = logicalMax <= 0
        ? pixelRatio
        : (_limits.maxDimension / logicalMax).clamp(0.5, pixelRatio);

    ui.Image image;
    try {
      image = await boundary.toImage(pixelRatio: safeRatio);
    } catch (error) {
      return CreationSaveResult(
        outcome: CreationSaveOutcome.renderFailed,
        detail: error.toString(),
      );
    }
    try {
      final result = await encode(
        image: image,
        childId: childId,
        gameId: gameId,
        drawingMode: drawingMode,
      );
      if (result.isSuccess) await persist(result.creation!);
      return result;
    } finally {
      image.dispose();
    }
  }

  /// Saves with an editable document (versioned JSON) alongside the rendered PNG.
  ///
  /// The PNG is the gallery thumbnail; the document is what makes `متابعة الرسم`
  /// possible. Both are persisted atomically in one prefs entry.
  Future<CreationSaveResult> saveFromBoundaryWithDocument({
    required RenderRepaintBoundary boundary,
    required String childId,
    required String gameId,
    required String drawingMode,
    required String documentJson,
    required int documentVersion,
    LocalCreation? existingCreation,
    double pixelRatio = 2.0,
    String Function()? idFactory,
  }) async {
    if (existingCreation != null && existingCreation.childId != childId) {
      throw ArgumentError.value(
        existingCreation.childId,
        'existingCreation.childId',
        'must match childId',
      );
    }
    final logicalMax = boundary.size.longestSide;
    final safeRatio = logicalMax <= 0
        ? pixelRatio
        : (_limits.maxDimension / logicalMax).clamp(0.5, pixelRatio);
    ui.Image image;
    try {
      image = await boundary.toImage(pixelRatio: safeRatio);
    } catch (error) {
      return CreationSaveResult(
        outcome: CreationSaveOutcome.renderFailed,
        detail: error.toString(),
      );
    }
    try {
      final encoded = await encode(
        image: image,
        childId: childId,
        gameId: gameId,
        drawingMode: drawingMode,
        idFactory: idFactory,
      );
      if (!encoded.isSuccess || encoded.creation == null) return encoded;
      // Document size guard: typical doc is ~2-8KB; 200KB is already pathological.
      if (documentJson.length > 256 * 1024) {
        return const CreationSaveResult(
          outcome: CreationSaveOutcome.tooLarge,
          detail: 'document too large',
        );
      }
      final rendered = encoded.creation!;
      final withDoc = LocalCreation(
        id: existingCreation?.id ?? rendered.id,
        childId: rendered.childId,
        gameId: rendered.gameId,
        drawingMode: rendered.drawingMode,
        width: rendered.width,
        height: rendered.height,
        byteLength: rendered.byteLength,
        createdAt: existingCreation?.createdAt ?? rendered.createdAt,
        pngBase64: rendered.pngBase64,
        uploadedCreationId: existingCreation?.uploadedCreationId,
        documentJson: documentJson,
        documentVersion: documentVersion,
        title: existingCreation?.title,
      );
      await persist(withDoc);
      return CreationSaveResult(
        outcome: CreationSaveOutcome.saved,
        creation: withDoc,
      );
    } finally {
      image.dispose();
    }
  }

  /// Persists a document directly without re-rendering, for instrumentation tests.
  Future<void> saveDocumentDirect({
    required String childId,
    required String gameId,
    required String drawingMode,
    required String documentJson,
    required int documentVersion,
    required Uint8List pngBytes,
    required int width,
    required int height,
    String Function()? idFactory,
  }) async {
    if (pngBytes.lengthInBytes > _limits.maxBytes) return;
    final creation = LocalCreation(
      id:
          idFactory?.call() ??
          'creation-${DateTime.now().microsecondsSinceEpoch}',
      childId: childId,
      gameId: gameId,
      drawingMode: drawingMode,
      width: width,
      height: height,
      byteLength: pngBytes.lengthInBytes,
      createdAt: DateTime.now(),
      pngBase64: base64Encode(pngBytes),
      documentJson: documentJson,
      documentVersion: documentVersion,
    );
    await persist(creation);
  }

  final Set<Future<void>> _operations = <Future<void>>{};

  Future<void> _mutationTail = Future<void>.value();
  Future<void>? _shutdownFuture;
  var _generation = 0;
  var _shuttingDown = false;

  Future<void> persist(LocalCreation creation) => _startMutation(
    (generation) => _serializeMutation(
      () => _rewriteChild(
        childId: creation.childId,
        generation: generation,
        transform: (existing) {
          // Do not silently delete oldest — keep all up to hardCap, UI warns
          // before the limit.
          final merged = [
            creation,
            ...existing.where((entry) => entry.id != creation.id),
          ];
          return merged.length > hardCap
              ? merged.take(hardCap).toList(growable: false)
              : merged;
        },
      ),
    ),
  );

  /// Permanently fences new creation writes and drains admitted writes.
  ///
  /// Reads and authoritative removal operations remain available. The fence is
  /// set before this method returns, so callers do not have to await the future
  /// before old references stop admitting writes.
  Future<void> shutdown() {
    final existing = _shutdownFuture;
    if (existing != null) return existing;

    _shuttingDown = true;
    _generation++;
    final draining = _drainOperations();
    _shutdownFuture = draining;
    return draining;
  }

  /// Returns true if child is approaching limit (for UI warning).
  Future<bool> isApproachingLimit(String childId) async {
    final list = await this.list(childId);
    return list.length >= warnAt;
  }

  /// Creations for one child, newest first.
  Future<List<LocalCreation>> list(String childId) async {
    final prefs = await _preferences();
    return _decodeList(prefs.getString(_key(childId)));
  }

  Future<void> delete(String childId, String creationId) => _startMutation(
    (generation) => _serializeMutation(
      () => _rewriteChild(
        childId: childId,
        generation: generation,
        transform: (existing) => existing
            .where((entry) => entry.id != creationId)
            .toList(growable: false),
      ),
    ),
  );

  Future<void> rename(String childId, String creationId, String newTitle) {
    final normalized = newTitle.trim();
    final safeTitle = normalized.isEmpty
        ? null
        : normalized.substring(0, normalized.length.clamp(0, 60));
    return _startMutation(
      (generation) => _serializeMutation(
        () => _rewriteChild(
          childId: childId,
          generation: generation,
          transform: (existing) => existing
              .map(
                (entry) => entry.id == creationId
                    ? entry.copyWith(title: safeTitle)
                    : entry,
              )
              .toList(growable: false),
        ),
      ),
    );
  }

  /// Records that a creation now also exists in private family storage.
  Future<void> markUploaded(
    String childId,
    String creationId,
    String remoteId,
  ) async {
    final normalizedRemoteId = remoteId.trim();
    if (normalizedRemoteId.isEmpty) {
      throw ArgumentError.value(
        remoteId,
        'remoteId',
        'Use clearUploaded to remove the family-storage marker.',
      );
    }
    await _startMutation(
      (generation) => _serializeMutation(
        () => _rewriteChild(
          childId: childId,
          generation: generation,
          transform: (existing) => existing
              .map(
                (entry) => entry.id == creationId
                    ? entry.copyWith(uploadedCreationId: normalizedRemoteId)
                    : entry,
              )
              .toList(growable: false),
        ),
      ),
    );
  }

  /// Clears only the family-storage marker; the on-device creation is retained.
  Future<void> clearUploaded(String childId, String creationId) =>
      _startMutation(
        (generation) => _serializeMutation(
          () => _rewriteChild(
            childId: childId,
            generation: generation,
            transform: (existing) => existing
                .map(
                  (entry) => entry.id == creationId
                      ? entry.copyWith(clearUploadedCreationId: true)
                      : entry,
                )
                .toList(growable: false),
          ),
        ),
      );

  /// Removes every creation for a child. Called when a child profile is deleted,
  /// so on-device copies do not outlive the profile they belong to.
  Future<void> clearChild(String childId) => _serializeMutation(() async {
    final prefs = await _preferences();
    await _removeKeys(prefs, [_key(childId)]);
  });

  /// Privacy-safe fallback for refresh failure, where the server can no longer
  /// enumerate the family's child ids. Only Majarra creation keys are removed.
  Future<void> clearAll() => _serializeMutation(() async {
    final prefs = await _preferences();
    final keys = prefs
        .getKeys()
        .where((key) => key.startsWith(_keyPrefix))
        .toList(growable: false);
    await _removeKeys(prefs, keys);
  });

  Future<void> _removeKeys(
    SharedPreferences prefs,
    Iterable<String> keys,
  ) async {
    var failed = false;
    for (final key in keys) {
      try {
        if (!prefs.containsKey(key)) continue;
        if (!await prefs.remove(key)) failed = true;
      } catch (_) {
        failed = true;
      }
    }
    if (!failed) return;

    try {
      await prefs.reload();
    } catch (_) {
      // The generic failure below remains retryable by the teardown caller.
    }
    throw StateError('Local creation removal failed');
  }

  Future<void> _rewriteChild({
    required String childId,
    required int generation,
    required List<LocalCreation> Function(List<LocalCreation>) transform,
  }) async {
    if (!_isCurrent(generation)) return;
    final prefs = await _preferences();
    if (!_isCurrent(generation)) return;

    final existing = _decodeList(prefs.getString(_key(childId)));
    if (!_isCurrent(generation)) return;
    final next = transform(existing);
    if (!_isCurrent(generation)) return;
    final encoded = jsonEncode(next.map((entry) => entry.toJson()).toList());
    if (!_isCurrent(generation)) return;

    await prefs.setString(_key(childId), encoded);
    if (!_isCurrent(generation)) return;
  }

  List<LocalCreation> _decodeList(String? raw) {
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(LocalCreation.fromJson)
          .toList(growable: false);
    } catch (_) {
      // Corrupt local cache is not worth surfacing to a child; an empty gallery
      // is recoverable, a crash on opening it is not.
      return const [];
    }
  }

  Future<void> _startMutation(Future<void> Function(int generation) body) {
    if (_shuttingDown) return Future<void>.value();

    final generation = _generation;
    late Future<void> result;
    try {
      result = body(generation);
    } catch (error, stackTrace) {
      result = Future<void>.error(error, stackTrace);
    }

    late final Future<void> ticket;
    ticket = result.then<void>(
      (_) {
        _operations.remove(ticket);
      },
      onError: (Object _, StackTrace __) {
        _operations.remove(ticket);
      },
    );
    _operations.add(ticket);
    return result;
  }

  Future<T> _serializeMutation<T>(Future<T> Function() mutation) {
    final result = _mutationTail.then<T>((_) => mutation());
    _mutationTail = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return result;
  }

  Future<void> _drainOperations() async {
    while (_operations.isNotEmpty) {
      await Future.wait<void>(List<Future<void>>.of(_operations));
    }
  }

  bool _isCurrent(int generation) =>
      !_shuttingDown && generation == _generation;
}
