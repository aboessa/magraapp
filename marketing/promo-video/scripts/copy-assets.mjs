// Copies the reviewed production assets the ad uses into public/.
// Character avatars are copied too, but the video only shows them when
// rendered with includeCharacters=true (after the Character Sheet is approved).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..');
const pub = resolve(here, '..', 'public');

const files = [
  ['app_main/assets/brand/majarra-logo.png', 'brand/logo.png'],
  ['app_main/assets/fonts/ReadexPro-Regular.ttf', 'fonts/ReadexPro-Regular.ttf'],
  ['app_main/assets/fonts/ReadexPro-SemiBold.ttf', 'fonts/ReadexPro-SemiBold.ttf'],
  ['app_main/assets/fonts/ReadexPro-Bold.ttf', 'fonts/ReadexPro-Bold.ttf'],
  ...['qisas', 'arqam', 'oloom', 'abjad', 'qiyam', 'maharat'].map((p) => [
    `.tmp_covers/avatars-webp/planets/${p}.webp`,
    `planets/${p}.webp`,
  ]),
  ...[
    'aalami-akbar', 'abni-kalima', 'adventures-of-numbers', 'al-arqam-fi-hayati',
    'alahiz-wa-ataajjab', 'ashyaa-laha-hikaya', 'bedtime-stories', 'hekaya-wa-hikma',
    'junior-future-lab', 'junior-journey-civilizations', 'junior-robo-codes',
    'junior-science-in-a-minute', 'kids-explorers-adventures', 'mawaqif-wa-qararat',
    'preschool-colors-around-us', 'preschool-count-with-me', 'preschool-luna-discovers-words',
    'qisas-min-alhayat', 'qiyami-alsaghira', 'try-it-at-home', 'ufakkir-khutwa-khutwa',
  ].map((p) => [`.tmp_covers/webp/posters/${p}-poster.webp`, `posters/${p}.webp`]),
  // 3D app avatars (gated behind Character Sheet approval). Only files that
  // passed visual review are listed; broken/duplicate avatars are excluded.
  ...['zaina-front', 'zaina-full', 'zaina-jump', 'yaseen-front', 'yaseen-full', 'yaseen-surprised'].map((n) => [
    `app_main/assets/avatars/characters/${n}.png`,
    `characters/${n}.png`,
  ]),
];

let missing = 0;
for (const [src, dst] of files) {
  const from = join(repo, src);
  const to = join(pub, dst);
  if (!existsSync(from)) {
    console.error(`missing: ${src}`);
    missing++;
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log(`copied ${files.length - missing}/${files.length} assets`);
if (missing) process.exit(1);
