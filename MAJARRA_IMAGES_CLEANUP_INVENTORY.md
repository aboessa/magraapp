# majarra_images — Safe Cleanup Inventory

**Date:** 2026-08-07
**Scope:** `F:\Projects\cartoonapp\majarra_images` — 434 files, 575.6 MB
**Method:** SHA-256 of every file; Pillow dimension read on every file; per-pair
perceptual comparison (RGB mean absolute difference on 128×128 downscales);
literal filename search across every known consumer.
**Nothing was modified, moved or deleted.**

---

## 1. Headline: almost none of this is safely deletable

I previously told you roughly 198 MB was reclaimable — **36 duplicate files
(72.1 MB) plus 184 redundant JPG derivatives (126.1 MB)**. That was wrong, and
it was wrong because I inferred redundancy from filename patterns instead of
comparing file contents. Measured properly:

| Claim I made earlier | Measured reality |
|---|---|
| 36 duplicate files, 72.1 MB | **0 duplicates.** SHA-256 finds **zero** exact-content duplicate groups in the whole tree. The 36 `(1)` files are *different renders*. |
| 184 redundant JPG derivatives, 126.1 MB | **0 redundant.** Not one of the 184 PNG/JPG stem pairs is the same image. |
| ~198 MB safely reclaimable | **0 MB safely reclaimable without human curation.** |

Blocking the deletion was the right call.

---

## 2. The 36 `(1)` files are alternative renders, not copies

All 36 have a same-named base file. In every case the `(1)` file has **identical
pixel dimensions but a different byte size and different content** — the
signature of a second generation pass from the image tool against the same
prompt, not a download duplicate.

Choosing between them is an **art-direction decision**, not a mechanical one.
Nobody but the content owner can say which render is canonical.

| Folder | Base file | Base | `(1)` variant |
|---|---|---|---|
| app/avatars | junior-avatar-boy-inventor.png | 1770 KB | 1660 KB |
| app/avatars | junior-avatar-boy-textured-hair.png | 1523 KB | 1624 KB |
| app/avatars | junior-avatar-girl-purple-hijab.png | 1738 KB | 1660 KB |
| app/avatars | junior-avatar-girl-tied-curls.png | 1961 KB | 1689 KB |
| app/avatars | preschool-avatar-boy-coiled-hair.png | 1512 KB | 1733 KB |
| books/covers | junior-civilization-innovations-cover.png | 2677 KB | 2667 KB |
| books/covers | junior-coding-logic-cover.png | 2073 KB | 2075 KB |
| books/covers | junior-everyday-forces-cover.png | 2220 KB | 2515 KB |
| books/covers | junior-solar-rover-guide-cover.png | 2438 KB | 2476 KB |
| characters | zaina-yasin-kids-character-sheet.png | 1954 KB | 1927 KB |
| episodes | junior-civilizations-01-water-engineering.png | 2473 KB | 2627 KB |
| episodes | junior-civilizations-02-observatory.png | 1778 KB | 1968 KB |
| episodes | junior-code-01-sequence-path.png | 2071 KB | 1587 KB |
| episodes | junior-code-02-debug-the-route.png | 1951 KB | 1916 KB |
| episodes | junior-future-01-solar-rover.png | 2065 KB | 1886 KB |
| episodes | junior-future-02-strong-bridge.png | 1918 KB | 1977 KB |
| episodes | junior-minute-01-light-refraction.png | 1894 KB | 1835 KB |
| episodes | junior-minute-02-air-pressure.png | 1829 KB | 1816 KB |
| games | junior-circuit-builder-cover.png | 2246 KB | 2291 KB |
| games | junior-civilizations-timeline-cover.png | 2528 KB | 2516 KB |
| games | junior-code-sequence-cover.png | 2251 KB | 2027 KB |
| games | junior-science-evidence-cover.png | 2529 KB | 2277 KB |
| marketing/vertical | junior-track-story.png | 2160 KB | 2262 KB |
| marketing/vertical | preschool-track-story.png | 1877 KB | 1988 KB |
| projects/covers | junior-project-branching-story-cover.png | 2060 KB | 2133 KB |
| projects/covers | junior-project-family-timeline-cover.png | 2118 KB | 2011 KB |
| projects/covers | junior-project-paper-bridge-cover.png | 2036 KB | 1991 KB |
| projects/covers | junior-project-solar-oven-cover.png | 2037 KB | 2204 KB |
| series/banners | junior-future-lab-banner.png | 1978 KB | 1976 KB |
| series/banners | junior-journey-civilizations-banner.png | 2205 KB | 2340 KB |
| series/banners | junior-robo-codes-banner.png | 1950 KB | 2006 KB |
| series/banners | junior-science-in-a-minute-banner.png | 1735 KB | 1811 KB |
| series/posters | junior-future-lab-poster.png | 2238 KB | 2075 KB |
| series/posters | junior-journey-civilizations-poster.png | 2568 KB | 2516 KB |
| series/posters | junior-robo-codes-poster.png | 2099 KB | 2107 KB |
| series/posters | junior-science-in-a-minute-poster.png | 1864 KB | 1709 KB |

Note the pattern: **every one is `junior`, `preschool` or a character/avatar
asset.** These are the tracks whose content is least finished, which is
consistent with them having been regenerated during review.

---

## 3. The 184 PNG/JPG pairs are different images, not format derivatives

184 PNG files have a same-stem `.jpg` sibling. I assumed the JPG was a
compressed derivative. It is not.

**115 pairs differ in dimensions**, frequently in aspect ratio or orientation:

| Stem | PNG | JPG |
|---|---|---|
| activity-family-kindness-cover | 768×1376 portrait | 1376×768 **landscape** |
| activity-nature-observation-cover | 768×1376 portrait | 1376×768 **landscape** |
| activity-safe-experiment-cover | 768×1376 portrait | 1376×768 **landscape** |
| avatar-boy-medium-hair | 1024×1024 square | 1376×768 **landscape** |
| avatar-boy-neat-hair | 1024×1024 square | 1376×768 **landscape** |
| avatar-boy-short-curls | 1024×1024 square | 1376×768 **landscape** |

**The remaining 69 pairs share dimensions but are still visually different.**
Mean absolute RGB difference on 128×128 downscales — a true JPEG derivative
scores ~0–2; these score 6 to 125:

| Stem | mean diff | verdict |
|---|---|---|
| nouma-character-sheet | 125.59 | entirely different artwork |
| salma-presenter-reference | 87.81 | entirely different artwork |
| weekly-report-illustration | 74.37 | entirely different artwork |
| preschool-count-01-one-for-each | 72.53 | entirely different artwork |
| family-plan-illustration | 67.22 | entirely different artwork |
| landing-three-tracks-showcase | 64.63 | entirely different artwork |

**Zero of the 69 scored below the 6.0 similarity threshold.** So all 126.1 MB of
JPG is distinct artwork. Deleting any of it destroys unique images.

---

## 4. Which file is the authoritative master

Given the above, the honest answer per group:

| Group | Authoritative master | Confidence |
|---|---|---|
| Single-format files (no sibling, no variant) | The file itself | High |
| PNG in a PNG/JPG pair | **Undetermined.** Both are distinct artwork. Both must be kept until an art review decides whether the landscape and portrait framings are both wanted. | — |
| Base vs `(1)` variant | **Undetermined.** Same subject, different render. Requires visual review. | — |
| `icons/*.jpeg` (10 files, 7.1 MB) | The JPEG is the master; `tools/process_planet_icons.py` derives the app planet assets from it | High |

**Recommended master format going forward:** PNG for anything with
transparency or destined for further editing; the largest available render
otherwise. But that rule cannot be applied retroactively here because the
two formats hold different pictures.

---

## 5. Consumers

| Consumer | How it consumes | Filenames it names | Breaks if the tree moves? |
|---|---|---|---|
| `dashboard/api/scripts/import-images.mjs` | **Recursively walks the entire tree** as `imageRoot`; uploads to R2 via wrangler and upserts DB rows | 0 by name — takes everything | **Yes.** Primary pipeline. |
| `tools/landing-assets/manifest.json` | Explicit path list | **53** | **Yes** |
| `majarra-landing.v3.html` | Direct `<img>`/CSS paths (117 occurrences) | **53** | **Yes** |
| `majarra-landing.v2.html` | Direct paths (38 occurrences) | **32** | Yes (older version) |
| `tools/process_planet_icons.py` | Reads `majarra_images/icons/*.jpeg` | **10** | **Yes** |
| `tools/landing-assets/build.mjs` | Globs via manifest | 0 by name | **Yes** |
| `chrome_extension_google_flow/flowContentScript.js` | Write target of the generation tool | 0 by name | No (producer, not consumer) |

**94 of 434 files are named explicitly by some consumer.** The other 340
(436.6 MB) are not named anywhere — but they are **not orphaned**, because
`import-images.mjs` ingests the whole directory recursively. Nothing here is
dead weight from the pipeline's point of view.

### Database records
**None.** No `content_assets` or `asset_links` rows are seeded by any of the 17
migrations, and no `r2_key` values exist yet. So there are currently **zero
database references** to any of these files. This is the one genuinely clean
part of the picture, and it means the R2 mapping can be defined freely.

---

## 6. What is actually safe to do, and when

Ordered by risk, lowest first. **None of it before the R2 path is verified.**

1. **Safe now, zero deletion:** repoint `majarra-landing.v2/v3.html`,
   `tools/landing-assets/manifest.json` and `process_planet_icons.py` at CDN
   URLs instead of local paths. Removes the "breaks if the tree moves"
   dependency without touching a file.
2. **Safe after R2 upload is verified:** nothing needs deleting at all —
   R2 becomes the authoritative store and the local tree becomes a working
   copy. This alone solves the git problem.
3. **Requires art-direction review:** the 36 base-vs-`(1)` pairs. Present them
   side by side, pick one, delete the other. Ceiling ~36 MB, not 72 MB, since
   one of each pair is kept.
4. **Requires art-direction review:** decide whether both the portrait PNG and
   landscape JPG framings are wanted per subject. If only one framing is
   needed, up to ~126 MB becomes reclaimable — but this is a content decision
   with no mechanical shortcut.
5. **Never delete without a verified R2 copy plus a checksum manifest.**

### Suggested guard rail
Before any deletion, generate a manifest of `path → sha256 → size → R2 key`
and confirm every file is retrievable from R2 by checksum. Deletion should
then be driven off that manifest, not off filename patterns — which is
precisely the mistake that produced my earlier wrong estimate.
