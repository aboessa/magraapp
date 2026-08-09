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
  const CreationSaveResult({
    required this.outcome,
    this.creation,
    this.detail,
  });

  final CreationSaveOutcome outcome;
  final LocalCreation? creation;
  final String? detail;

  bool get isSuccess => outcome == CreationSaveOutcome.saved;
}

/// A drawing held on the device.
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

  Uint8List get bytes => base64Decode(pngBase64);

  bool get isUploaded => uploadedCreationId != null;

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
        if (uploadedCreationId != null) 'uploaded_creation_id': uploadedCreationId,
      };

  LocalCreation copyWith({String? uploadedCreationId}) => LocalCreation(
        id: id,
        childId: childId,
        gameId: gameId,
        drawingMode: drawingMode,
        width: width,
        height: height,
        byteLength: byteLength,
        createdAt: createdAt,
        pngBase64: pngBase64,
        uploadedCreationId: uploadedCreationId ?? this.uploadedCreationId,
      );
}

/// Renders and stores creations on the device.
class LocalCreationStore {
  LocalCreationStore({
    CreationLimits limits = const CreationLimits(),
    Future<SharedPreferences> Function()? preferences,
  })  : _limits = limits,
        _preferences = preferences ?? SharedPreferences.getInstance;

  static const _keyPrefix = 'majarra.creations.';

  /// How many creations are retained per child on the device.
  ///
  /// Bounded because this is a cache, not an archive: the durable copy is the
  /// optional cloud save. Oldest are dropped first.
  static const retainPerChild = 24;

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
    if (image.width > _limits.maxDimension || image.height > _limits.maxDimension) {
      return CreationSaveResult(
        outcome: CreationSaveOutcome.tooLarge,
        detail: '${image.width}x${image.height} exceeds ${_limits.maxDimension}px',
      );
    }
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) {
      return const CreationSaveResult(outcome: CreationSaveOutcome.renderFailed);
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
        id: idFactory?.call() ??
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

  Future<void> persist(LocalCreation creation) async {
    final prefs = await _preferences();
    final existing = await list(creation.childId);
    final next = [creation, ...existing.where((entry) => entry.id != creation.id)]
        .take(retainPerChild)
        .toList(growable: false);
    await prefs.setString(
      _key(creation.childId),
      jsonEncode(next.map((entry) => entry.toJson()).toList()),
    );
  }

  /// Creations for one child, newest first.
  Future<List<LocalCreation>> list(String childId) async {
    final prefs = await _preferences();
    final raw = prefs.getString(_key(childId));
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

  Future<void> delete(String childId, String creationId) async {
    final prefs = await _preferences();
    final remaining = (await list(childId))
        .where((entry) => entry.id != creationId)
        .toList(growable: false);
    await prefs.setString(
      _key(childId),
      jsonEncode(remaining.map((entry) => entry.toJson()).toList()),
    );
  }

  /// Records that a creation now also exists in private family storage.
  Future<void> markUploaded(String childId, String creationId, String remoteId) async {
    final prefs = await _preferences();
    final updated = (await list(childId))
        .map((entry) => entry.id == creationId
            ? entry.copyWith(uploadedCreationId: remoteId)
            : entry)
        .toList(growable: false);
    await prefs.setString(
      _key(childId),
      jsonEncode(updated.map((entry) => entry.toJson()).toList()),
    );
  }

  /// Removes every creation for a child. Called when a child profile is deleted,
  /// so on-device copies do not outlive the profile they belong to.
  Future<void> clearChild(String childId) async {
    final prefs = await _preferences();
    await prefs.remove(_key(childId));
  }
}
