#!/usr/bin/env node
// build-localization-index.mjs
// Canonically enumerates the 208 source units under docs/content/planets and
// (re)builds:
//   docs/content/_localization-source-index.json
//   docs/content/planets/_localizations-manifest.json
//
// Enumeration contract (canonical):
//   - 117 ep-*.md episodes in planets 01-08
//   -  25 story-*.md stories in 05-qisas (incl. 10 under audio-only-stories)
//   -  66 ep-*.md Islamic units in planet 09
// Excludes: _localizations, books, games, activities, bibles, READMEs,
//           manifests, and model (*model*) files, review-drafts.md.
// Locales tracked: en, fr. Islamic units => edition_type=islamic / review_sharia.
//
// This script is deterministic and idempotent; scaffold copies are NOT inputs.

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO, "docs", "content");
const PLANETS = path.join(CONTENT, "planets");
const LOCALES = ["en", "fr"];

const EXCLUDE_DIR = new Set(["_localizations", "books", "games", "activities"]);

function isExcludedName(name) {
  const lower = name.toLowerCase();
  if (lower === "review-drafts.md") return true;
  if (lower === "readme.md") return true;
  if (lower.includes("manifest")) return true;
  if (lower.includes("bible")) return true;
  if (lower.includes("model")) return true;
  return false;
}

function isSourceUnit(name) {
  return /^ep-.*\.md$/.test(name) || /^story-.*\.md$/.test(name);
}

async function walk(dir, acc) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIR.has(e.name)) continue;
      await walk(path.join(dir, e.name), acc);
    } else if (e.isFile()) {
      if (isExcludedName(e.name)) continue;
      if (!isSourceUnit(e.name)) continue;
      acc.push(path.join(dir, e.name));
    }
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

async function sha256(absPath) {
  const buf = await fs.readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const abs = [];
  await walk(PLANETS, abs);
  abs.sort();

  const units = [];
  for (const a of abs) {
    const relFromPlanets = toPosix(path.relative(PLANETS, a)); // e.g. 02-arqam/series/ep-01.md
    const relFromContent = toPosix(path.relative(CONTENT, a)); // planets/02-arqam/...
    const parts = relFromPlanets.split("/");
    const planet = parts[0];
    const series = parts[parts.length - 2];
    const fileName = parts[parts.length - 1];
    const type = fileName.startsWith("story-") ? "story" : "episode";
    const isIslamic = planet === "09-islamic";
    const seriesDir = path.dirname(a);

    const localizations = {};
    for (const loc of LOCALES) {
      const locPath = path.join(seriesDir, "_localizations", loc, fileName);
      let present = false;
      try {
        await fs.access(locPath);
        present = true;
      } catch {
        present = false;
      }
      localizations[loc] = {
        locale: loc,
        rel_path: toPosix(path.relative(PLANETS, locPath)),
        status: isIslamic ? "review_sharia" : "review_lang",
        review_state: isIslamic ? "review_sharia" : "review_lang",
        present,
      };
    }

    units.push({
      id: relFromPlanets,
      planet,
      series,
      type,
      edition_type: isIslamic ? "islamic" : "standard",
      review_state: isIslamic ? "review_sharia" : "review_lang",
      source: {
        rel_path: relFromPlanets,
        rel_path_from_content: relFromContent,
        abs_path: toPosix(a),
        source_file: fileName,
        sha256: await sha256(a),
      },
      localizations,
    });
  }

  // Source index (sources authoritative; localization presence tracked separately)
  const sourceIndex = {
    generated_at: new Date().toISOString(),
    generator: "tools/content/build-localization-index.mjs",
    content_root: "docs/content",
    planets_root: "docs/content/planets",
    total_sources: units.length,
    by_planet: countBy(units, (u) => u.planet),
    by_type: countBy(units, (u) => u.type),
    sources: units.map((u) => ({
      rel_path: u.source.rel_path,
      abs_path: u.source.abs_path,
      source_sha256: u.source.sha256,
      source_file: u.source.source_file,
      planet: u.planet,
      series: u.series,
      type: u.type,
      edition_type: u.edition_type,
    })),
  };

  // Localizations manifest (unit-centric; edition_type + review_state on the unit)
  const manifest = {
    generated_at: new Date().toISOString(),
    generator: "tools/content/build-localization-index.mjs",
    locales: LOCALES,
    total_units: units.length,
    expected_editions: units.length * LOCALES.length,
    coverage: coverage(units),
    units: units.map((u) => ({
      id: u.id,
      edition_type: u.edition_type,
      review_state: u.review_state,
      source: {
        rel_path: u.source.rel_path,
        sha256: u.source.sha256,
      },
      localizations: Object.fromEntries(
        Object.entries(u.localizations).map(([loc, v]) => [
          loc,
          { locale: v.locale, rel_path: v.rel_path, status: v.status, review_state: v.review_state },
        ])
      ),
    })),
  };

  await fs.writeFile(
    path.join(CONTENT, "_localization-source-index.json"),
    JSON.stringify(sourceIndex, null, 2) + "\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(PLANETS, "_localizations-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  console.log("Wrote docs/content/_localization-source-index.json");
  console.log("Wrote docs/content/planets/_localizations-manifest.json");
  console.log(`total_sources=${units.length}`);
  console.log("by_planet:", JSON.stringify(sourceIndex.by_planet));
  console.log("by_type:", JSON.stringify(sourceIndex.by_type));
  console.log("coverage:", JSON.stringify(manifest.coverage));
}

function countBy(arr, keyFn) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function coverage(units) {
  const out = {};
  for (const loc of LOCALES) {
    out[loc] = units.filter((u) => u.localizations[loc].present).length;
  }
  out.total = units.length;
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
