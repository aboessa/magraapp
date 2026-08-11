import type { VisualStyleRecord } from '../../types/api'

// Production preview priority: hero/reference asset > approved example > generated/test > placeholder
// Visual_styles currently has no image column, so we fall back to meaningful placeholder that still shows the style.
// The placeholder uses medium-based palette + prompt fragment hint so cards are not empty dark rectangles.

const mediumPalette: Record<string, { bg: string; accent: string }> = {
  '2d': { bg: '#e8f0ff', accent: '#5679f2' },
  '3d': { bg: '#f3e8ff', accent: '#8b5cf6' },
  'mixed': { bg: '#e0f7ff', accent: '#06b6d4' },
  'stop_motion': { bg: '#fff1e6', accent: '#f59e0b' },
  'live': { bg: '#e6f4ea', accent: '#22c55e' },
  'graphic': { bg: '#fde8f0', accent: '#ec4899' },
}

export function StylePreview({ style, size = 'card' }: { style: VisualStyleRecord; size?: 'card' | 'hero' }) {
  const pal = mediumPalette[style.medium] ?? mediumPalette['2d']
  const h = size === 'hero' ? 260 : 140
  return (
    <div
      role="img"
      aria-label={style.name_en}
      style={{
        height: h,
        display: 'grid',
        placeItems: 'center',
        background: `linear-gradient(135deg, ${pal.bg}, #fff)`,
        borderBottom: size === 'card' ? `4px solid ${pal.accent}` : undefined,
        padding: 16,
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      <div>
        <div style={{ fontSize: size === 'hero' ? 28 : 18, fontWeight: 800, color: pal.accent }}>{style.name_en}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' as const }}>
          {style.prompt_fragment.slice(0, 110)}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{style.medium} · {style.slug}</div>
      </div>
    </div>
  )
}
