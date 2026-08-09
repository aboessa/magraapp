// Master inventory: planet -> section/category -> series -> expected/source episodes vs catalogue
// episodes vs missing episodes vs missing artwork. Built from D1 + the on-disk source inventory.
import fs from 'node:fs';

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))[0].results;
const inv = rd('_inventory.json');
const content = JSON.parse(fs.readFileSync('_content.json', 'utf8'));

// source episode/story counts per series slug
const srcEpisodes = new Map();
for (const e of content.episodes) srcEpisodes.set(e.series_slug, (srcEpisodes.get(e.series_slug) ?? 0) + 1);
const srcStories = new Map();
for (const s of content.stories) srcStories.set(s.series_slug, (srcStories.get(s.series_slug) ?? 0) + 1);
// mazen-wa-thaaloub's source is the video folder, not a script folder
srcEpisodes.set('mazen-wa-thaaloub', 14);

const pad = (v, n) => String(v ?? '').padEnd(n);
const padS = (v, n) => String(v ?? '').padStart(n);

let planet = null;
const lines = [];
lines.push('PLANET / SECTION      SERIES                            STATUS      SRC  CAT  MISS  SSN  ART(poster,banner)  EP-THUMBS  STREAMS');
lines.push('─'.repeat(132));
const totals = { src: 0, cat: 0, miss: 0, poster: 0, banner: 0, thumbs: 0, streams: 0, eps: 0 };

for (const r of inv) {
  if (planet !== r.planet_id) {
    planet = r.planet_id;
    lines.push('');
    lines.push(`${r.planet_id}  (${r.planet_name})   section: ${r.category_id ?? 'NONE'}   planet artwork: [${r.planet_roles ?? 'none'}]`);
  }
  const src = (srcEpisodes.get(r.slug) ?? 0) + (srcStories.get(r.slug) ?? 0);
  const miss = Math.max(0, src - r.episodes);
  totals.src += src; totals.cat += r.episodes; totals.miss += miss;
  totals.poster += r.posters ? 1 : 0; totals.banner += r.banners ? 1 : 0;
  totals.thumbs += r.ep_thumbs; totals.streams += r.ep_streams; totals.eps += r.episodes;
  lines.push([
    '  ', pad('', 20), pad(r.slug, 34), pad(r.status, 12),
    padS(src, 3), padS(r.episodes, 5), padS(miss, 5), padS(r.seasons, 5),
    padS(r.posters ? 'yes' : 'NO', 9) + padS(r.banners ? 'yes' : 'NO', 9),
    padS(`${r.ep_thumbs}/${r.episodes}`, 11), padS(`${r.ep_streams}/${r.episodes}`, 9),
  ].join(''));
}
lines.push('');
lines.push('─'.repeat(132));
lines.push(`TOTAL   source items ${totals.src}   catalogue episodes ${totals.cat}   still missing ${totals.miss}   series with poster ${totals.poster}/${inv.length}   with banner ${totals.banner}/${inv.length}   episode thumbnails ${totals.thumbs}/${totals.eps}   streams ${totals.streams}/${totals.eps}`);

const text = lines.join('\n');
fs.writeFileSync('_MASTER_INVENTORY.txt', text + '\n', 'utf8');
console.log(text);
