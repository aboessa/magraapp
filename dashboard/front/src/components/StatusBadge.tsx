import type { AgeTrack, ContentStatus } from '../types/api'
import { statusLabels, trackLabels } from '../lib/labels'
import { usePreferences } from '../context/preferences'

export function StatusBadge({ status }: { status: ContentStatus }) {
  const { locale } = usePreferences()
  return <span className={`status-badge status-badge--${status}`}>{statusLabels[locale][status]}</span>
}

export function TrackBadge({ track }: { track: AgeTrack }) {
  const { locale } = usePreferences()
  return <span className={`track-badge track-badge--${track}`}>{trackLabels[locale][track]}</span>
}
