import type { VisualStyleRecord } from '../types/api'

export type StyleFamily = 'soft2d' | 'adventure' | 'storybook' | 'learning' | 'premium3d' | 'special'

export const familyLabels: Record<string, Record<StyleFamily, string>> = {
  ar: {
    soft2d: 'مجارا ناعم 2D',
    adventure: 'مجارا مغامرات 2D',
    storybook: 'مجارا كتاب القصص',
    learning: 'مجارا التعليمي',
    premium3d: 'مجارا بريميوم 3D',
    special: 'إنتاج خاص',
  },
  en: {
    soft2d: 'Majarra Soft 2D',
    adventure: 'Majarra Adventure 2D',
    storybook: 'Majarra Storybook',
    learning: 'Majarra Learning Visual',
    premium3d: 'Majarra Premium 3D',
    special: 'Special Production',
  },
}

const mapping: Record<string, StyleFamily> = {
  'soft-2d': 'soft2d',
  'limited-2d': 'soft2d',
  'adventure-2d': 'adventure',
  'painterly-storybook': 'storybook',
  'watercolor-motion-story': 'storybook',
  'tech-2d': 'learning',
  'motion-graphics': 'learning',
  'cinematic-infographic': 'learning',
  'cinematic-stylized-3d': 'premium3d',
  'felt-puppet': 'special',
  'cloth-doll': 'special',
  'puppet-stage': 'special',
  'clay-stop-motion': 'special',
  'paper-cutout': 'special',
  'family-live-program': 'special',
  'class-default': 'special',
}

export function familyOf(style: Pick<VisualStyleRecord, 'id' | 'slug'>): StyleFamily {
  return mapping[style.slug] ?? mapping[style.id] ?? 'special'
}

export function familyUsage(family: StyleFamily, styles: VisualStyleRecord[]) {
  return styles.filter((s) => familyOf(s) === family).length
}
