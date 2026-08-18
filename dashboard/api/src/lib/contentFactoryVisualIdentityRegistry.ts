export const CONTENT_FACTORY_VISUAL_IDENTITY_REGISTRY_SCHEMA =
  'content-factory.visual-identity-registry/v1' as const;

export type ApprovedFactoryVisualIdentityPack = {
  identity_id: string;
  version: string;
  series_slug: string;
  status: 'approved';
  reference_pack_sha256: string;
  references: Array<{
    kind: 'character_sheet' | 'world_sheet' | 'prop_sheet' | 'style_frame' | 'visual_guide';
    path: string;
    sha256: string;
  }>;
  approved_by: string;
  approved_at: string;
};

export const APPROVED_FACTORY_VISUAL_IDENTITY_PACKS = Object.freeze([
  {
    identity_id: 'luna-discovers-words/luna-v2',
    version: 'luna-v2',
    series_slug: 'luna-discovers-words',
    status: 'approved',
    reference_pack_sha256: '0132d294f45a6fe644d5b2034e86f15e4627ff146f5f8130247d41c9202905a7',
    references: [{
      kind: 'character_sheet',
      path: 'majarra_images/assets/images/characters/luna-preschool-character-sheet.png',
      sha256: '0edcd9e6280dbece120a3f6a6247dac55e0fac20a09489b54e37f04a08b20deb',
    }, {
      kind: 'visual_guide',
      path: 'tools/content-factory/reference-packs/luna-v2-visual-guide.json',
      sha256: 'ba579c39b4b462d7709e53fdb984601d8c926a3525c63dcbf0b05f02007ff1c6',
    }],
    approved_by: 'majarra-creative-direction',
    approved_at: '2026-08-12T00:00:00.000Z',
  },
] satisfies ApprovedFactoryVisualIdentityPack[]);

export function approvedFactoryVisualIdentityPack(
  seriesSlug: string,
  version: string,
): ApprovedFactoryVisualIdentityPack | null {
  return APPROVED_FACTORY_VISUAL_IDENTITY_PACKS.find(
    (pack) => pack.series_slug === seriesSlug && pack.version === version,
  ) ?? null;
}
