#!/usr/bin/env node
// validate-series-localizations.mjs
// Validates EN/FR localization coverage of the 208 canonical source units.
//
// Reads:
//   docs/content/planets/_localizations-manifest.json   (unit-centric)
//   docs/content/_localization-source-index.json        (source sha authority)
//
// Contract (schema, matching the builder):
//   unit.id === unit.source.rel_path
//   unit.source.rel_path + unit.source.sha256
//   unit.edition_type + unit.review_state live on the UNIT (not the locale)
//   unit.localizations[locale] = { locale, rel_path, status, review_state }
//
// Checks per unit/locale:
//   R2_MISSING     edition file absent on disk
//   R3_SHA_DRIFT   manifest source sha != current source sha (index cross-check)
//   R10_LOCALE     localizations[locale].locale must equal the locale key
//   R11_SHARIA     islamic units must carry review_state=review_sharia both
//                  on the unit and each locale; reviewer/approval/license fields
//                  in the edition file must be empty/pending/tbd/--
//
// Coverage is keyed by (rel_path, locale field) so a FR file is never counted
// as EN. Exits 1 (ok:false) until 208/208 per locale.

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO, "docs", "content");
const PLANETS = path.join(CONTENT, "planets");
const LOCALES = ["en", "fr"];

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}
async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}
async function sha256(absPath) {
  const buf = await fs.readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}
function absFromPlanetsRel(rel) {
  return path.join(PLANETS, rel.split("/").join(path.sep));
}

const EMPTYISH = new Set(["", "—", "-", "--", "tbd", "pending", "none", "n/a", "na"]);
function isEmptyish(v) {
  if (v == null) return true;
  return EMPTYISH.has(String(v).trim().toLowerCase());
}

// Extract a value from a markdown table row: | `key` | value |
function tableValue(text, key) {
  const re = new RegExp("\\|\\s*`?" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`?\\s*\\|\\s*(.*?)\\s*\\|", "i");
  const m = text.match(re);
  if (!m) return null;
  return m[1].replace(/`/g, "").trim();
}

async function main() {
  const manifestPath = path.join(PLANETS, "_localizations-manifest.json");
  const indexPath = path.join(CONTENT, "_localization-source-index.json");

  const violations = [];
  if (!(await exists(manifestPath))) {
    fail(["MANIFEST_MISSING docs/content/planets/_localizations-manifest.json"], {});
    return;
  }
  if (!(await exists(indexPath))) {
    fail(["SOURCE_INDEX_MISSING docs/content/_localization-source-index.json"], {});
    return;
  }

  const manifest = await readJson(manifestPath);
  const index = await readJson(indexPath);
  const indexByRel = new Map(index.sources.map((s) => [s.rel_path, s]));

  const coverage = { en: 0, fr: 0 };
  const totalUnits = manifest.units.length;

  for (const unit of manifest.units) {
    const src = indexByRel.get(unit.source.rel_path);
    if (!src) {
      violations.push(`INDEX_MISS ${unit.id} — source rel_path not in source index`);
    } else if (src.source_sha256 !== unit.source.sha256) {
      violations.push(`R3_SHA_DRIFT ${unit.id} — manifest sha != index sha`);
    } else {
      // Cross-check current on-disk source sha
      const srcAbs = absFromPlanetsRel(unit.source.rel_path);
      if (await exists(srcAbs)) {
        const cur = await sha256(srcAbs);
        if (cur !== unit.source.sha256) {
          violations.push(`R3_SHA_DRIFT ${unit.id} — on-disk source sha changed since index build`);
        }
      } else {
        violations.push(`SOURCE_GONE ${unit.id} — canonical source missing on disk`);
      }
    }

    const isIslamic = unit.edition_type === "islamic";
    if (isIslamic && unit.review_state !== "review_sharia") {
      violations.push(`R11_SHARIA ${unit.id} — islamic unit review_state must be review_sharia`);
    }

    for (const loc of LOCALES) {
      const led = unit.localizations[loc];
      if (!led) { violations.push(`LOCALE_ENTRY_MISSING ${unit.id} [${loc}]`); continue; }
      if (led.locale !== loc) {
        violations.push(`R10_LOCALE ${unit.id} [${loc}] — locale field '${led.locale}' != key`);
      }
      const edAbs = absFromPlanetsRel(led.rel_path);
      const present = await exists(edAbs);
      if (!present) {
        violations.push(`R2_MISSING ${unit.id} [${loc}] — ${led.rel_path}`);
        continue;
      }
      // Count coverage strictly by the locale field of the entry
      coverage[led.locale] = (coverage[led.locale] || 0) + 1;

      if (isIslamic) {
        const txt = await fs.readFile(edAbs, "utf8");
        if (!/review_sharia/.test(txt)) {
          violations.push(`R11_SHARIA ${unit.id} [${loc}] — edition missing review_sharia status`);
        }
        for (const k of ["sharia_reviewer_id", "sharia_review_version", "language_reviewer_id", "recitation_license_id"]) {
          const v = tableValue(txt, k);
          if (v !== null && !isEmptyish(v)) {
            violations.push(`R11_SHARIA ${unit.id} [${loc}] — ${k} must be empty/pending, got '${v}'`);
          }
        }
        for (const forbidden of ["sharia-approved", "معتمد شرعا", "معتمد شرعاً", "جاهز للنشر", "production_ready"]) {
          if (txt.toLowerCase().includes(forbidden.toLowerCase())) {
            violations.push(`R11_SHARIA ${unit.id} [${loc}] — forbidden claim '${forbidden}'`);
          }
        }
      }
    }
  }

  const ok = violations.length === 0 && coverage.en === totalUnits && coverage.fr === totalUnits;

  console.log("=== Series localization validation ===\n");
  console.log(`Total canonical source units: ${totalUnits}`);
  console.log(`EN coverage: ${coverage.en}/${totalUnits}`);
  console.log(`FR coverage: ${coverage.fr}/${totalUnits}`);
  console.log(`Violations: ${violations.length}`);
  const shown = violations.slice(0, 40);
  for (const v of shown) console.log("  - " + v);
  if (violations.length > shown.length) console.log(`  ... and ${violations.length - shown.length} more`);
  console.log("");
  console.log(JSON.stringify({ ok, coverage: { en: coverage.en, fr: coverage.fr, total: totalUnits }, violations: violations.length }));
  process.exit(ok ? 0 : 1);
}

function fail(vs, coverage) {
  for (const v of vs) console.log("  - " + v);
  console.log(JSON.stringify({ ok: false, coverage, violations: vs.length }));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
