import type { LandingLocale } from '../i18n'
import { ar, type LandingCopy } from './ar'
import { en } from './en'
import { fr } from './fr'

export type { LandingCopy }

export const COPY: Record<LandingLocale, LandingCopy> = { ar, en, fr }

export function copyFor(locale: LandingLocale): LandingCopy {
  return COPY[locale] ?? COPY.ar
}
