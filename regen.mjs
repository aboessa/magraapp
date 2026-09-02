/**
 * regen.mjs — rebuild app_main/assets/data/complete_items.json from the
 * "أكمل الرسمة" manifest.
 *
 * Emits ABSOLUTE CDN URLs, not bare R2 keys. DrawingAsset resolves an id/path
 * in exactly three ways (drawing_asset.dart:38-42): a key in kDrawingAssetMap,
 * something starting with `http`, or something starting with `assets/`. A bare
 * key like `public/studio/complete-drawing/bird-01/challenge.png` matches none
 * of them, so it fell through to the "Unresolvable drawing asset" branch at
 * drawing_asset.dart:118 and every one of the 50 cards rendered the same grey
 * placeholder. Writing full URLs puts these on the Image.network path.
 */
import fs from 'fs';

const CDN = 'https://cdn.majarra.app';
const KEY_PREFIX = 'public/studio/complete-drawing';

const manifest = JSON.parse(fs.readFileSync('tools/playveo/complete-drawing.manifest.json', 'utf8'));
const bg_map = {
  animals: 'FF7E3A', space: '7C3AED', nature: '2EAC5A', vehicles: 'DC2626',
  home: 'F59E0B', food: 'EC4899', fantasy: '8B5CF6',
};

const out = manifest.assets.map((a) => ({
  id: `complete-${a.id}`,
  label: a.titleAr,
  // challenge = the puzzle the child completes; the board draws on top of this
  assetId: `${CDN}/${KEY_PREFIX}/${a.id}/challenge.png`,
  // reference_full = the answer key shown in the board's side panel
  referenceFull: `${CDN}/${KEY_PREFIX}/${a.id}/reference_full.png`,
  // 512px thumb for grid cards, so a 3-column grid does not pull 50 x ~600KB
  thumbnail: `${CDN}/${KEY_PREFIX}/${a.id}/thumbnail.jpg`,
  bg: bg_map[a.group] || '0F172A',
  difficulty: a.difficulty,
  group: a.group,
  order: a.order,
}));

fs.writeFileSync('app_main/assets/data/complete_items.json', JSON.stringify(out, null, 2));
console.log('wrote', out.length);
