// One-off audit helper: reconcile majarra_images files on disk against content_assets.expected_path
// Catalogue paths are .webp (import converts), disk holds .png/.jpg, so match on stem not extension.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'F:\\Projects\\cartoonapp\\majarra_images';
const d1 = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const rows = Array.isArray(d1) ? d1[0].results : d1.results;

const norm = (p) => p.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
const stemOf = (p) => norm(p).replace(/\.[^./]+$/, '');
// "foo (1)" is an alternative render of "foo", not a separate asset
const baseStem = (s) => s.replace(/ \(\d+\)$/, '');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .map((f) => {
    const rel = norm(path.relative(ROOT, f));
    const s = stemOf(rel);
    return { full: f, rel, stem: s, base: baseStem(s), size: fs.statSync(f).size };
  });

const diskByBase = new Map();
for (const f of files) {
  if (!diskByBase.has(f.base)) diskByBase.set(f.base, []);
  diskByBase.get(f.base).push(f);
}

const cat = rows.filter((r) => r.expected_path).map((r) => ({ ...r, stem: stemOf(r.expected_path) }));
const catByStem = new Map(cat.map((r) => [r.stem, r]));

const catNoSource = cat.filter((r) => !diskByBase.has(r.stem));
const diskNoCat = [...diskByBase.entries()].filter(([b]) => !catByStem.has(b));

const dirOf = (s) => s.split('/').slice(0, -1).join('/');
const group = (keys) => {
  const m = new Map();
  for (const k of keys) m.set(dirOf(k), (m.get(dirOf(k)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const out = {
  disk_image_files: files.length,
  disk_distinct_base_stems: diskByBase.size,
  catalogue_rows_with_expected_path: cat.length,
  matched_by_stem: cat.length - catNoSource.length,
  catalogue_rows_with_no_source_file: catNoSource.map((r) => ({
    id: r.id, status: r.status, path: r.expected_path,
  })),
  disk_stems_with_no_catalogue_row: diskNoCat.map(([b, fs_]) => ({
    stem: b, files: fs_.map((f) => f.rel), bytes: fs_.reduce((a, f) => a + f.size, 0),
  })),
  disk_gap_by_dir: group(diskNoCat.map(([b]) => b)),
  cat_gap_by_dir: group(catNoSource.map((r) => r.stem)),
};
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 2), 'utf8');

console.log(`disk image files:                        ${out.disk_image_files}`);
console.log(`  distinct base stems (ignoring ext/(1)): ${out.disk_distinct_base_stems}`);
console.log(`catalogue rows with expected_path:       ${out.catalogue_rows_with_expected_path}`);
console.log(`MATCHED by stem:                         ${out.matched_by_stem}`);
console.log(`CATALOGUE ROWS WITH NO SOURCE FILE:      ${out.catalogue_rows_with_no_source_file.length}`);
console.log(`DISK STEMS WITH NO CATALOGUE ROW:        ${out.disk_stems_with_no_catalogue_row.length}`);
console.log('');
console.log('disk files missing from catalogue, by directory:');
for (const [d, n] of out.disk_gap_by_dir) console.log(`  ${String(n).padStart(4)}  ${d || '(root)'}`);
console.log('');
console.log('catalogue rows with no source file:');
for (const r of out.catalogue_rows_with_no_source_file) console.log(`  [${r.status}] ${r.path}`);
