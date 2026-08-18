import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const registry = require('../visual-identity-registry.v1.json');

export const VISUAL_IDENTITY_REGISTRY_SCHEMA = 'content-factory.visual-identity-registry/v1';

if (registry.schema_version !== VISUAL_IDENTITY_REGISTRY_SCHEMA || !Array.isArray(registry.packs)) {
  throw new Error('Visual identity registry is invalid or uses an unsupported schema');
}

export const APPROVED_VISUAL_IDENTITY_PACKS = Object.freeze(
  registry.packs.map((pack) => Object.freeze(structuredClone(pack))),
);

export function approvedVisualIdentityPack(seriesSlug, version) {
  return APPROVED_VISUAL_IDENTITY_PACKS.find(
    (pack) => pack.series_slug === seriesSlug && pack.version === version,
  ) ?? null;
}
