import { readFile as nodeReadFile } from 'node:fs/promises';
import path from 'node:path';

import { sha256Hex } from './contract.mjs';

export const INVENTORY_VERSION = 'content-factory.inventory/v1';

const PLANETS = Object.freeze([
  '01-abjad',
  '02-arqam',
  '03-oloom',
  '04-qiyam',
  '05-qisas',
  '06-maharat',
  '07-tarikh',
  '08-alam',
]);

const PRODUCTION_LEVELS = new Set(['limited_2d', 'stylized_3d', 'motion_story', 'live']);
const EXPECTED_CURRENT_TOTALS = Object.freeze({
  series_count: 24,
  episode_count: 117,
  story_count: 15,
  story_page_count: 194,
  top_level_unit_count: 132,
  catalog_duration_seconds: 36_125,
  video_duration_seconds: 32_150,
  story_duration_seconds: 3_975,
});

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function relativePath(root, absolutePath) {
  return normalizePath(path.relative(root, absolutePath));
}

function cleanCell(value) {
  return value
    .replace(/<!--.*?-->/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

function pipeCells(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cleanCell);
}

function isSeparatorRow(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line);
}

export function parseDuration(value) {
  const match = String(value ?? '').match(/(?:^|\D)(\d{1,3}):(\d{2})(?:\D|$)/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) return null;
  return minutes * 60 + seconds;
}

function metadataTokens(line) {
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
}

function metadataDefaultDuration(line) {
  const pieces = line.split('·').map((piece) => cleanCell(piece));
  return parseDuration(pieces.at(-1));
}

function parseSeriesSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+السلسلة\s+(\d+)\s*[—–-]\s*(.+?)\s*$/gm)];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    title: cleanCell(match[2]),
    body: markdown.slice(match.index, matches[index + 1]?.index ?? markdown.length),
  }));
}

function explicitProfile({ kind, productionLevel }) {
  if (productionLevel === 'live') return 'live_action';
  if (kind === 'story') return 'illustrated_read_to_me';
  if (productionLevel === 'limited_2d' || productionLevel === 'stylized_3d') {
    return 'cartoon_video_model_audio';
  }
  return null;
}

function findContentTable(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes('|') || (!line.includes('الحلقة') && !line.includes('القصة'))) continue;
    const headers = pipeCells(line);
    if (!lines[index + 1] || !isSeparatorRow(lines[index + 1])) continue;
    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex];
      if (!row.trim().startsWith('|') || isSeparatorRow(row)) break;
      rows.push({ cells: pipeCells(row), raw: row });
    }
    return { headers, rows };
  }
  return null;
}

function columnIndex(headers, name) {
  return headers.findIndex((header) => header === name || header.includes(name));
}

function extractLink(rawRow) {
  const links = [...rawRow.matchAll(/\[([^\]]+)\]\(([^)]+\.md(?:#[^)]+)?)\)/g)];
  const contentLink = links.find((match) => /(?:ep|story)-\d+/i.test(match[1]) || /(?:ep|story)-\d+/i.test(match[2]));
  if (!contentLink) return null;
  return { label: contentLink[1], href: contentLink[2].split('#')[0] };
}

function entityId(link, fallbackIndex, kind) {
  const source = `${link?.label ?? ''} ${link?.href ?? ''}`;
  const match = source.match(new RegExp(`${kind === 'story' ? 'story' : 'ep'}-\\d+[A-Za-z0-9-]*`, 'i'));
  return match?.[0].toLowerCase() ?? `${kind}-${String(fallbackIndex).padStart(2, '0')}`;
}

function parseSeries(section, planetSlug, readmeAbsolutePath, root) {
  const lines = section.body.split(/\r?\n/);
  const metadataLine = lines.find((line) => /^\s*`[^`]+`\s*·/.test(line));
  const tokens = metadataTokens(metadataLine ?? '');
  const slug = tokens[0] ?? `${planetSlug}-series-${section.number}`;
  const declaredType = tokens[1] ?? null;
  const productionLevel = tokens.find((token) => PRODUCTION_LEVELS.has(token)) ?? null;
  const defaultDurationSeconds = metadataDefaultDuration(metadataLine ?? '');
  const table = findContentTable(lines);
  const issues = [];

  if (!metadataLine) {
    issues.push({
      code: 'SERIES_METADATA_MISSING', severity: 'error',
      message: `Series ${section.number} has no parseable metadata line.`,
      path: relativePath(root, readmeAbsolutePath),
    });
  }
  if (!table) {
    issues.push({
      code: 'CONTENT_TABLE_MISSING', severity: 'error',
      message: `Series ${slug} has no episode or story table.`,
      path: relativePath(root, readmeAbsolutePath),
    });
    return {
      planet_slug: planetSlug,
      series_number: section.number,
      series_slug: slug,
      title: section.title,
      declared_type: declaredType,
      declared_production_level: productionLevel,
      default_duration_seconds: defaultDurationSeconds,
      items: [],
      issues,
    };
  }

  const kind = columnIndex(table.headers, 'القصة') >= 0 ? 'story' : 'episode';
  const titleIndex = columnIndex(table.headers, kind === 'story' ? 'القصة' : 'الحلقة');
  const durationIndex = columnIndex(table.headers, 'المدة');
  const pagesIndex = columnIndex(table.headers, 'الصفحات');
  const items = table.rows.map((row, rowIndex) => {
    const link = extractLink(row.raw);
    const durationSeconds = durationIndex >= 0
      ? parseDuration(row.cells[durationIndex])
      : defaultDurationSeconds;
    const pageCount = kind === 'story' && pagesIndex >= 0
      ? Number.parseInt(row.cells[pagesIndex].match(/\d+/)?.[0] ?? '', 10)
      : null;
    let sourceAbsolutePath = null;
    let sourcePath = null;
    if (link) {
      sourceAbsolutePath = path.resolve(path.dirname(readmeAbsolutePath), decodeURIComponent(link.href));
      sourcePath = relativePath(root, sourceAbsolutePath);
    }
    const profile = explicitProfile({ kind, productionLevel });
    const itemIssues = [];
    if (!link) {
      itemIssues.push({
        code: 'SOURCE_LINK_MISSING', severity: 'error',
        message: `${slug} row ${rowIndex + 1} has no episode/story Markdown link.`,
        path: relativePath(root, readmeAbsolutePath),
      });
    }
    if (!durationSeconds) {
      itemIssues.push({
        code: 'DURATION_MISSING', severity: 'error',
        message: `${slug}/${entityId(link, rowIndex + 1, kind)} has no parseable duration.`,
        path: relativePath(root, readmeAbsolutePath),
      });
    }
    if (kind === 'story' && (!Number.isInteger(pageCount) || pageCount < 1)) {
      itemIssues.push({
        code: 'PAGE_COUNT_MISSING', severity: 'error',
        message: `${slug}/${entityId(link, rowIndex + 1, kind)} has no parseable page count.`,
        path: relativePath(root, readmeAbsolutePath),
      });
    }
    if (!profile && productionLevel === 'motion_story') {
      itemIssues.push({
        code: 'PIPELINE_PROFILE_UNRESOLVED', severity: 'error',
        message: 'motion_story alone is ambiguous; an explicit motion_story_video or illustrated_read_to_me profile is required.',
        path: sourcePath ?? relativePath(root, readmeAbsolutePath),
      });
    } else if (!profile) {
      itemIssues.push({
        code: 'PIPELINE_PROFILE_UNRESOLVED', severity: 'error',
        message: `No explicit factory profile maps declared production level ${productionLevel ?? '<missing>'}.`,
        path: sourcePath ?? relativePath(root, readmeAbsolutePath),
      });
    }
    return {
      entity_type: kind,
      entity_id: entityId(link, rowIndex + 1, kind),
      title: row.cells[titleIndex] ?? null,
      duration_seconds: durationSeconds,
      page_count: Number.isInteger(pageCount) ? pageCount : null,
      source_path: sourcePath,
      _source_absolute_path: sourceAbsolutePath,
      pipeline_profile: profile,
      eligibility: productionLevel === 'live' ? 'excluded' : 'plannable',
      exclusion_code: productionLevel === 'live' ? 'LIVE_ACTION' : null,
      issues: itemIssues,
    };
  });

  return {
    planet_slug: planetSlug,
    series_number: section.number,
    series_slug: slug,
    title: section.title,
    declared_type: declaredType,
    declared_production_level: productionLevel,
    default_duration_seconds: defaultDurationSeconds,
    items,
    issues,
  };
}

function durationDeclarations(markdown) {
  const card = markdown.match(/\|\s*`duration_seconds`\s*\|\s*\**(\d+)\**/i);
  const acceptance = markdown.match(/معايير القبول[\s\S]{0,800}?المدة\s+\**(\d+)\**\s*ثانية/i);
  return {
    source_card_seconds: card ? Number(card[1]) : null,
    acceptance_seconds: acceptance ? Number(acceptance[1]) : null,
  };
}

async function enrichItem(item, { readFile, root }) {
  const enriched = { ...item };
  delete enriched._source_absolute_path;
  if (!item._source_absolute_path) return enriched;
  const resolvedRoot = `${path.resolve(root)}${path.sep}`.toLowerCase();
  if (!`${item._source_absolute_path}${path.sep}`.toLowerCase().startsWith(resolvedRoot)) {
    enriched.issues.push({
      code: 'SOURCE_PATH_ESCAPES_ROOT', severity: 'hard_block',
      message: 'Linked source resolves outside the workspace root.', path: item.source_path,
    });
    return enriched;
  }
  try {
    const markdown = await readFile(item._source_absolute_path, 'utf8');
    enriched.source_sha256 = sha256Hex(markdown);
    const declarations = durationDeclarations(markdown);
    enriched.duration_declarations = {
      index_seconds: item.duration_seconds,
      ...declarations,
    };
    const distinct = new Set([
      item.duration_seconds,
      declarations.source_card_seconds,
      declarations.acceptance_seconds,
    ].filter(Number.isFinite));
    if (distinct.size > 1) {
      enriched.issues.push({
        code: 'DURATION_CONFLICT',
        severity: 'hard_block',
        message: `Conflicting duration declarations: ${[...distinct].join(', ')} seconds.`,
        path: item.source_path,
        details: enriched.duration_declarations,
      });
    }
  } catch (error) {
    enriched.source_sha256 = null;
    enriched.issues.push({
      code: error?.code === 'ENOENT' ? 'SOURCE_FILE_MISSING' : 'SOURCE_FILE_UNREADABLE',
      severity: 'hard_block',
      message: `Cannot read linked source: ${error.message}`,
      path: item.source_path,
    });
  }
  return enriched;
}

function parseFirstTable(markdown, requiredHeader) {
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes(requiredHeader) || !lines[index].includes('|')) continue;
    if (!isSeparatorRow(lines[index + 1] ?? '')) continue;
    const headers = pipeCells(lines[index]);
    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      if (!lines[rowIndex].trim().startsWith('|') || isSeparatorRow(lines[rowIndex])) break;
      rows.push(pipeCells(lines[rowIndex]));
    }
    return { headers, rows };
  }
  return null;
}

async function scanIslamicShells({ root, readFile }) {
  const readmePath = path.join(root, 'docs', 'content', 'planets', '09-islamic', 'README.md');
  const shellsPath = path.join(root, 'docs', 'content', 'planets', '09-islamic', 'series-shells.md');
  const issues = [{
    code: 'RELIGIOUS_CONTENT_UNAPPROVED',
    severity: 'hard_block',
    message: 'Planet 09 contains shells only and zero approved religious scripts; no jobs may be created.',
    path: relativePath(root, shellsPath),
  }];
  try {
    const [readme, shells] = await Promise.all([
      readFile(readmePath, 'utf8'),
      readFile(shellsPath, 'utf8'),
    ]);
    const advertisedSeries = Number(shells.match(/(\d+)\s+سلسلة/)?.[1] ?? 0);
    const advertisedUnits = Number(shells.match(/(\d+)\s+وحدة/)?.[1] ?? 0);
    const writtenUnits = Number(readme.match(/الوحدات المكتوبة\s*\|[^\d]*(\d+)/)?.[1] ?? 0);
    const table = parseFirstTable(shells, 'السلسلة');
    const unitIndex = table ? columnIndex(table.headers, 'الوحدات') : -1;
    const rowUnitTotal = table && unitIndex >= 0
      ? table.rows.reduce((sum, row) => sum + Number(row[unitIndex].match(/\d+/)?.[0] ?? 0), 0)
      : null;
    if (rowUnitTotal !== null && rowUnitTotal !== advertisedUnits) {
      issues.push({
        code: 'ISLAMIC_SHELL_UNIT_COUNT_CONFLICT',
        severity: 'hard_block',
        message: `Planet 09 advertises ${advertisedUnits} units while its series rows sum to ${rowUnitTotal}.`,
        path: relativePath(root, shellsPath),
        details: { advertised_units: advertisedUnits, row_unit_total: rowUnitTotal },
      });
    }
    return {
      planet_slug: '09-islamic',
      status: 'blocked',
      advertised_series_count: advertisedSeries,
      advertised_unit_count: advertisedUnits,
      row_unit_count: rowUnitTotal,
      written_unit_count: writtenUnits,
      generated_job_count: 0,
      issues,
    };
  } catch (error) {
    issues.push({
      code: 'ISLAMIC_SHELL_INVENTORY_UNREADABLE', severity: 'hard_block',
      message: error.message, path: relativePath(root, shellsPath),
    });
    return {
      planet_slug: '09-islamic', status: 'blocked', generated_job_count: 0, issues,
    };
  }
}

async function scanStaleIndexes({ root, readFile, currentUnitCount }) {
  const paths = [
    path.join(root, 'docs', 'content', 'README.md'),
    path.join(root, 'docs', 'content', '01-status-and-gap.md'),
  ];
  const issues = [];
  for (const absolutePath of paths) {
    try {
      const markdown = await readFile(absolutePath, 'utf8');
      const hasLegacyClaim = /79\s+(?:حلقة\/قصة|وحدة المكتوبة|وحدة)/.test(markdown)
        || /المحتوى الإنتاجي المكتوب[^\n]*79/.test(markdown);
      if (hasLegacyClaim && currentUnitCount !== 79) {
        issues.push({
          code: 'STALE_CONTENT_INDEX',
          severity: 'warning',
          message: `Legacy index reports 79 written units; canonical planet indexes currently report ${currentUnitCount}.`,
          path: relativePath(root, absolutePath),
          details: { legacy_count: 79, canonical_count: currentUnitCount },
        });
      }
    } catch {
      // Supplemental legacy indexes are evidence only and do not block canonical inventory.
    }
  }
  return issues;
}

function sum(items, selector) {
  return items.reduce((total, item) => total + (selector(item) ?? 0), 0);
}

function mismatchIssues(totals) {
  return Object.entries(EXPECTED_CURRENT_TOTALS)
    .filter(([field, expected]) => totals[field] !== expected)
    .map(([field, expected]) => ({
      code: 'CANONICAL_TOTAL_MISMATCH',
      severity: 'hard_block',
      message: `${field} expected ${expected} but scanner found ${totals[field]}.`,
      path: 'docs/content/planets',
      details: { field, expected, actual: totals[field] },
    }));
}

export async function scanInventory({
  root = process.cwd(),
  readFile = nodeReadFile,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const series = [];
  const readmePaths = [];
  const scanIssues = [];

  for (const planetSlug of PLANETS) {
    const readmeAbsolutePath = path.join(resolvedRoot, 'docs', 'content', 'planets', planetSlug, 'README.md');
    readmePaths.push(relativePath(resolvedRoot, readmeAbsolutePath));
    try {
      const markdown = await readFile(readmeAbsolutePath, 'utf8');
      const sections = parseSeriesSections(markdown);
      if (sections.length === 0) {
        scanIssues.push({
          code: 'PLANET_SERIES_MISSING', severity: 'hard_block',
          message: `No series sections found for ${planetSlug}.`, path: relativePath(resolvedRoot, readmeAbsolutePath),
        });
      }
      series.push(...sections.map((section) => parseSeries(
        section,
        planetSlug,
        readmeAbsolutePath,
        resolvedRoot,
      )));
    } catch (error) {
      scanIssues.push({
        code: 'PLANET_INDEX_UNREADABLE', severity: 'hard_block',
        message: error.message, path: relativePath(resolvedRoot, readmeAbsolutePath),
      });
    }
  }

  for (const entry of series) {
    entry.items = await Promise.all(entry.items.map((item) => enrichItem(item, {
      readFile,
      root: resolvedRoot,
    })));
  }

  const items = series.flatMap((entry) => entry.items.map((item) => ({
    planet_slug: entry.planet_slug,
    series_slug: entry.series_slug,
    declared_type: entry.declared_type,
    declared_production_level: entry.declared_production_level,
    ...item,
  })));
  const episodes = items.filter((item) => item.entity_type === 'episode');
  const stories = items.filter((item) => item.entity_type === 'story');
  const excludedItems = items.filter((item) => item.eligibility === 'excluded');
  const aiEligibleItems = items.filter((item) => item.eligibility !== 'excluded');
  const aiEligibleSeries = new Set(aiEligibleItems.map((item) => `${item.planet_slug}/${item.series_slug}`));
  const totals = {
    series_count: series.length,
    episode_count: episodes.length,
    story_count: stories.length,
    story_page_count: sum(stories, (item) => item.page_count),
    top_level_unit_count: items.length,
    catalog_duration_seconds: sum(items, (item) => item.duration_seconds),
    video_duration_seconds: sum(episodes, (item) => item.duration_seconds),
    story_duration_seconds: sum(stories, (item) => item.duration_seconds),
    ai_eligible_series_count: aiEligibleSeries.size,
    ai_eligible_episode_count: episodes.filter((item) => item.eligibility !== 'excluded').length,
    ai_eligible_story_count: stories.filter((item) => item.eligibility !== 'excluded').length,
    ai_eligible_bundle_count: aiEligibleItems.length,
    excluded_episode_count: episodes.filter((item) => item.eligibility === 'excluded').length,
  };

  const islamic = await scanIslamicShells({ root: resolvedRoot, readFile });
  const issues = [
    ...scanIssues,
    ...series.flatMap((entry) => entry.issues),
    ...items.flatMap((item) => item.issues.map((issue) => ({
      ...issue,
      entity_key: `${item.entity_type}:${item.planet_slug}/${item.series_slug}/${item.entity_id}`,
    }))),
    ...mismatchIssues(totals),
    ...islamic.issues,
    ...await scanStaleIndexes({ root: resolvedRoot, readFile, currentUnitCount: totals.top_level_unit_count }),
  ];

  const blockers = issues.filter((issue) => issue.severity === 'error' || issue.severity === 'hard_block');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const inventory = {
    inventory_version: INVENTORY_VERSION,
    canonical_sources: readmePaths,
    totals,
    exclusions: excludedItems.map((item) => ({
      entity_key: `${item.entity_type}:${item.planet_slug}/${item.series_slug}/${item.entity_id}`,
      code: item.exclusion_code,
      reason: 'Live-action content is inventory-only and cannot create automated generation jobs.',
    })),
    conflicts: issues.filter((issue) => issue.code.includes('CONFLICT') || issue.code === 'STALE_CONTENT_INDEX'),
    blockers,
    warnings,
    islamic,
    series,
  };
  inventory.inventory_sha256 = sha256Hex({
    inventory_version: inventory.inventory_version,
    totals: inventory.totals,
    exclusions: inventory.exclusions,
    conflicts: inventory.conflicts,
    series: inventory.series,
  });
  return inventory;
}

export function inventoryCheck(inventory) {
  return {
    ok: inventory.blockers.length === 0,
    blocker_count: inventory.blockers.length,
    warning_count: inventory.warnings.length,
    inventory_sha256: inventory.inventory_sha256,
  };
}
