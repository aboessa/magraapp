/// Decides whether a catalogue asset path is public artwork or private media.
///
/// ## Why this is its own module
///
/// This rule previously existed as three separate copies: `inferVisibility()` in
/// `routes/adminAssets.ts`, another in `scripts/import-images.mjs`, and the
/// implicit assumption in the migration tooling. They had already drifted once —
/// the original pair only treated `landing|marketing|worlds|store` as public, so
/// every poster, banner and episode still was minted `private/…` and could never
/// resolve on the CDN. Any future divergence reintroduces exactly that class of
/// bug, so all callers now import from here.
///
/// ## The rule
///
/// Catalogue artwork is browse-surface decoration: posters, banners, episode
/// thumbnails, planet art, character sheets, covers. It is served anonymously
/// from the public bucket behind `cdn.majarra.app`, because putting an image
/// behind a 180-second capability token is unusable in a scrolling grid.
///
/// Entitlement-controlled media — episode video, streams, downloadables and game
/// packs — stays private in `MEDIA_BUCKET` and is reachable only through a
/// short-lived signed capability minted by the playback-session route.
///
/// The private test runs first and wins, so `.../series/streams/ep-01.mp4`
/// classifies private even though `series` appears in the path.
///
/// ## Audio is not public artwork
///
/// `audio` used to sit in [PUBLIC_ARTWORK_SEGMENTS], which put every generated
/// narration in the CDN-fronted bucket, readable by anyone with the URL and no
/// token. That contradicts the protection plan on three counts:
///
///   * `تشفير المحتوي.md:70` — paid audio is "Streaming خاص" online
///   * `تشفير المحتوي.md:175` — `audio/` is listed under the `private/` prefix
///   * `تشفير المحتوي.md:157` — a public bucket for paid content is prohibited
///
/// Narration is the substance of an `audio_story`, not decoration around it, so
/// it now classifies private by default and is served through the capability
/// path in `routes/media.ts`.
///
/// Interface sound effects are the deliberate exception: a button click or a win
/// chime has no resale value, and routing it through a 180-second token would
/// add latency to protect nothing. Those live under an explicit
/// [PUBLIC_AUDIO_SEGMENTS] path so the choice is visible in the key rather than
/// inherited from the word "audio".

/// Path segments whose contents are public catalogue artwork.
///
/// `audio` is deliberately absent — see the note above.
export const PUBLIC_ARTWORK_SEGMENTS = [
  'landing', 'marketing', 'worlds', 'store', 'series', 'episodes', 'planets',
  'characters', 'books', 'games', 'stories', 'projects', 'quizzes',
  'flashcards', 'activities', 'islamic', 'app',
] as const;

/// Audio that is safe to serve anonymously from the CDN.
///
/// Scoped to interface and gameplay sound: `sfx/` for effects, `ui-audio/` for
/// chrome, `audio-samples/` for the free previews the plan permits to be public
/// (`تشفير المحتوي.md:66`). Narration must never be placed under these.
export const PUBLIC_AUDIO_SEGMENTS = ['sfx', 'ui-audio', 'audio-samples'] as const;

/// Path segments that are always entitlement controlled, checked first.
///
/// `audio` is included so that any path containing an `/audio/` segment — which
/// is where narration lives, per the plan's story layout at
/// `تشفير المحتوي.md:196` — resolves private even when the surrounding path
/// contains a public segment such as `stories`.
export const PRIVATE_MEDIA_SEGMENTS = [
  'downloads', 'packs', 'streams', 'video', 'audio', 'narration',
] as const;

const PUBLIC_ARTWORK_PATTERN = new RegExp(`/(${PUBLIC_ARTWORK_SEGMENTS.join('|')})/`);
const PUBLIC_AUDIO_PATTERN = new RegExp(`/(${PUBLIC_AUDIO_SEGMENTS.join('|')})/`);
const PRIVATE_MEDIA_PATTERN = new RegExp(`/(${PRIVATE_MEDIA_SEGMENTS.join('|')})/`);

export type Visibility = 'public' | 'private';

/// Classifies a catalogue-relative path such as
/// `assets/images/series/posters/adventures-of-numbers-poster.webp`.
///
/// Accepts Windows or POSIX separators. Unknown locations fail closed to
/// `private`: leaking an unclassified asset publicly is worse than an image that
/// needs an explicit decision.
///
/// Test order is significant. The public-audio allowlist is checked before the
/// private list because `sfx/` and `ui-audio/` are the narrow, deliberate
/// exception to "audio is private"; without this ordering an effect stored at
/// `assets/audio/sfx/click.mp3` would match the private `audio` segment and be
/// pushed behind a token for no benefit.
export function inferVisibilityFromPath(rawPath: string): Visibility {
  const normalized = `/${String(rawPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()}`;
  if (PUBLIC_AUDIO_PATTERN.test(normalized)) return 'public';
  if (PRIVATE_MEDIA_PATTERN.test(normalized)) return 'private';
  return PUBLIC_ARTWORK_PATTERN.test(normalized) ? 'public' : 'private';
}

/// Kinds that are entitlement controlled no matter where they sit on disk.
///
/// `audio` is intentionally NOT listed here even though narration must be
/// private. A blanket kind rule would also force interface sound effects private,
/// and the plan explicitly permits free and public audio
/// (`تشفير المحتوي.md:65-66`). Audio is therefore decided by path, with
/// [PUBLIC_AUDIO_SEGMENTS] as the only route to a public placement.
const ALWAYS_PRIVATE_KINDS = ['video', 'archive'] as const;

/// The corrected visibility for an existing asset row, combining its path
/// classification with the hard rule that video and archives are never public.
///
/// Used by the bucket migration to decide the target placement for the assets
/// imported before the classification fix.
export function correctedVisibility(asset: {
  kind?: string | null;
  expected_path?: string | null;
  r2_key?: string | null;
}): Visibility {
  if (asset.kind && (ALWAYS_PRIVATE_KINDS as readonly string[]).includes(asset.kind)) {
    return 'private';
  }
  // expected_path is the editorial location and is the authoritative signal.
  // r2_key is a fallback for assets created directly through the upload API,
  // with its own scope prefix stripped so a wrong prefix cannot be self-confirming.
  const source = asset.expected_path?.trim()
    || String(asset.r2_key ?? '').replace(/^(public|private)\/(catalog\/)?/, '');
  if (!source) return 'private';
  return inferVisibilityFromPath(source);
}
