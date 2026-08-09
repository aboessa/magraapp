/// Keeping a drawing in private family storage.
///
/// ## Explicit by construction
///
/// Nothing in this file runs on its own. It is reached only when a parent taps
/// "keep this drawing", and it refuses until the `child_creations` consent has been
/// granted. The device copy remains the primary one either way: this adds a second
/// copy, it does not move the drawing off the device.
///
/// The consent decision comes from the server rather than being recomputed here.
/// Two copies of a consent policy would eventually disagree, and the client's copy
/// is the one that would be wrong.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../data/local_creation_store.dart';

/// The consent a cloud save requires, and the version the parent must agree to.
///
/// Mirrors `CONSENT_VERSIONS` in `dashboard/api/src/lib/consent.ts`. A stale app
/// naming an old version is refused by the server rather than silently accepted,
/// which is why the version is sent rather than assumed.
const String kCreationsConsentType = 'child_creations';
const String kCreationsConsentVersion = '1';

enum CloudSaveOutcome {
  saved,
  /// The parent has not granted the creations consent yet. Not a failure: the UI
  /// asks for it.
  consentRequired,
  /// Storage is not configured on the server, which is a deployment state rather
  /// than something the family did.
  storageUnavailable,
  failed,
}

class CloudSaveResult {
  const CloudSaveResult(this.outcome, {this.remoteId, this.detail});

  final CloudSaveOutcome outcome;
  final String? remoteId;
  final String? detail;

  bool get isSuccess => outcome == CloudSaveOutcome.saved;
}

class CreationCloudService {
  CreationCloudService({required this.ref});

  final Ref ref;

  /// Whether the family has granted the creations consent for [childId].
  Future<bool> hasConsent(String childId) async {
    try {
      final response = await ref.read(majarraApiClientProvider).fetchConsents(childId: childId);
      final decisions = response['data'] is Map
          ? (response['data'] as Map)['decisions']
          : null;
      if (decisions is! Map) return false;
      final decision = decisions[kCreationsConsentType];
      return decision is Map && decision['granted'] == true;
    } catch (_) {
      // Offline or unreachable: treat as not granted. Assuming consent because a
      // request failed would be the worst possible default here.
      return false;
    }
  }

  /// Records the parent's consent.
  Future<bool> grantConsent(String childId) async {
    try {
      await ref.read(majarraApiClientProvider).setConsent(
            consentType: kCreationsConsentType,
            version: kCreationsConsentVersion,
            childId: childId,
          );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Withdraws it, and removes what was already stored.
  ///
  /// Revoking without purging would leave images in storage the parent has just
  /// said they did not agree to, so the two happen together.
  Future<bool> revokeConsentAndPurge(String childId) async {
    final api = ref.read(majarraApiClientProvider);
    try {
      await api.setConsent(
        consentType: kCreationsConsentType,
        version: kCreationsConsentVersion,
        childId: childId,
        revoke: true,
      );
      await api.purgeCreations(childId: childId);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Uploads one local creation.
  Future<CloudSaveResult> save(LocalCreation creation) async {
    final api = ref.read(majarraApiClientProvider);
    try {
      final response = await api.uploadCreation(
        childId: creation.childId,
        gameId: creation.gameId,
        drawingMode: creation.drawingMode,
        width: creation.width,
        height: creation.height,
        bytes: creation.bytes,
      );
      final remoteId = response['data'] is Map ? (response['data'] as Map)['id'] : null;
      if (remoteId is! String) {
        return const CloudSaveResult(CloudSaveOutcome.failed, detail: 'no id returned');
      }
      // Recorded locally so the gallery can show which copies exist remotely, and
      // so a second tap does not upload the same drawing twice.
      await ref.read(localCreationStoreProvider)
          .markUploaded(creation.childId, creation.id, remoteId);
      return CloudSaveResult(CloudSaveOutcome.saved, remoteId: remoteId);
    } catch (error) {
      final message = error.toString();
      if (message.contains('consent')) {
        return const CloudSaveResult(CloudSaveOutcome.consentRequired);
      }
      if (message.contains('not configured')) {
        return const CloudSaveResult(CloudSaveOutcome.storageUnavailable);
      }
      return CloudSaveResult(CloudSaveOutcome.failed, detail: message);
    }
  }

  /// Deletes the remote copy, leaving the device copy alone.
  Future<bool> deleteRemote(String creationId) async {
    try {
      await ref.read(majarraApiClientProvider).deleteCreation(creationId: creationId);
      return true;
    } catch (_) {
      return false;
    }
  }
}

/// Injected so the gallery can be widget-tested without a network.
final creationCloudServiceProvider = Provider<CreationCloudService>((ref) {
  return CreationCloudService(ref: ref);
});

/// One store for the app; declared here so both the route and the cloud service
/// share an instance.
final localCreationStoreProvider = Provider<LocalCreationStore>((ref) {
  return LocalCreationStore();
});
