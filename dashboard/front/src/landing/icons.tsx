import type { ReactNode } from 'react'

/** أيقونات صفحة الهبوط. كلها 24×24 بخط outline موحّد. */
const GLYPHS = {
  arrowStart: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowNext: <path d="M14 6l-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  play: <path d="M8 5v14l11-7z" />,
  pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" />,
  check: <path d="m6 12 4 4 8-9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,

  tv: <path d="M4 5h16v11H4zM9 20h6M12 16v4" />,
  tvPlain: <path d="M4 5h16v11H4zM8 20h8" />,
  tvWide: <path d="M3 5h18v11H3zM9 20h6M12 16v4" />,
  tvSmart: <path d="M3 5h18v12H3zM7 21h10" />,
  phone: <path d="M7 3h10v18H7zM10 20h4" />,
  phoneApple: <path d="M7 3h10v18H7zM11 5.5h2" />,
  devices: <path d="M3 5h13v9H3zM8 18h6M11 14v4M18 8h3v10h-3z" />,
  continuity: <path d="M4 7h8v10H4zM14 9h6v8h-6M8 20h4" />,

  book: <path d="M12 6.5S9.5 4 4 4v14c5.5 0 8 2.5 8 2.5s2.5-2.5 8-2.5V4c-5.5 0-8 2.5-8 2.5zM12 6.5v14" />,
  bookPlain: <path d="M12 6.5S9.5 4 4 4v14c5.5 0 8 2.5 8 2.5s2.5-2.5 8-2.5V4c-5.5 0-8 2.5-8 2.5z" />,
  headphones: <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1z" />,
  headphonesTop: <path d="M4 14v-2a8 8 0 0 1 16 0v2" />,
  gamepad: <path d="M6 12H3m3 0 1.5-4.5h9L18 12M6 12v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3M21 12h-3M9.5 14h1M14 14h1" />,
  graduation: <path d="m12 4 9 4.5-9 4.5L3 8.5zM7 11v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" />,
  graduationPlain: <path d="m12 4 9 4.5-9 4.5L3 8.5z" />,

  shield: <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6z" />,
  lock: <path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3M12 15v2" />,
  external: <path d="M10 14 21 3M21 3v6h-6M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />,

  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </>
  ),
  globeHalf: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18" />
    </>
  ),
  users: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M17 8.5a2.5 2.5 0 1 0 0-5M18 19.5c0-2.2-.9-4.2-2.4-5.6" />,
  usersPlain: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />,

  report: <path d="M6 3h12v18l-6-3-6 3zM9 9h6M9 13h4" />,
  reportPlain: <path d="M6 3h12v18l-6-3-6 3zM9 9h6" />,
  doc: <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />,
  docShort: <path d="M5 4h14v16H5zM9 9h6M9 13h4" />,
  bars: <path d="M4 18V8M9 18V5M14 18v-7M19 18v-4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  heart: <path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />,
  moon: <path d="M18 13a6 6 0 1 1-11-3.5A7 7 0 0 0 18 13z" />,

  lines: <path d="M4 7h10M4 12h16M4 17h7" />,
  pageTurn: <path d="M4 6h10l6 6-6 6H4z" />,
  highlight: <path d="M5 4h9l5 5v11H5zM9 13h6" />,
  speaker: <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" />,
  speakerFull: <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />,

  googlePlay: <path d="M5 4.5 19 12 5 19.5zM5 4.5 14 12l-9 7.5" />,
  appStore: <path d="M16 3c-1 1.4-2.6 2-3.6 1.8M12 8c-3 0-5 2.2-5 5.5S9.5 21 12 21s5-4.2 5-7.5S15 8 12 8z" />,
  youtube: <path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM11 9.5l4 2.5-4 2.5z" />,
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M16.8 7.2h.01" />
    </>
  ),
  xSocial: <path d="M5 5l14 14M19 5 5 19" />,
  tiktok: <path d="M15 4c.4 2.2 1.9 3.6 4 3.8v2.8c-1.5 0-2.9-.5-4-1.3V15a5 5 0 1 1-5-5v2.9a2.1 2.1 0 1 0 2.1 2.1V4z" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof GLYPHS

type IcoProps = {
  name: IconName
  /** يملأ الشكل بدل رسم الحدود، يستخدم لزر التشغيل */
  solid?: boolean
  className?: string
}

export function Ico({ name, solid = false, className }: IcoProps) {
  return (
    <svg
      className={className ? `mj-icon ${className}` : 'mj-icon'}
      viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  )
}

/** رمز QR توضيحي مرسوم بالـSVG، بدون صورة خارجية */
export function QrCode({ label }: { label: string }) {
  return (
    <svg className="mj-qr" viewBox="0 0 29 29" role="img" aria-label={label}>
      <rect width="29" height="29" fill="#fff" />
      <g fill="#10162f">
        <path d="M0 0h7v7H0zm1 1v5h5V1z" />
        <path d="M2 2h3v3H2z" />
        <path d="M22 0h7v7h-7zm1 1v5h5V1z" />
        <path d="M24 2h3v3h-3z" />
        <path d="M0 22h7v7H0zm1 1v5h5v-5z" />
        <path d="M2 24h3v3H2z" />
        <path d="M9 0h1v2H9zm2 0h1v1h-1zm2 1h1v2h-1zm2-1h1v3h-1zm2 2h1v1h-1z" />
        <path d="M0 9h2v1H0zm3 0h1v1H3zm2 1h2v1H5zm-5 2h1v1H0zm2 0h2v1H2zm4-1h1v2H6z" />
        <path d="M9 9h2v2H9zm3 0h1v1h-1zm2 1h2v1h-2zm3-1h1v2h-1zm2 0h1v1h-1zm2 1h1v1h-1zm2-1h1v2h-1zm2 1h2v1h-2z" />
        <path d="M9 12h1v2H9zm2 1h2v1h-2zm3-1h1v1h-1zm2 1h1v2h-1zm2-1h2v1h-2zm3 1h1v1h-1zm2-1h1v2h-1zm2 1h1v1h-1z" />
        <path d="M9 15h2v1H9zm3 0h1v2h-1zm2 1h2v1h-2zm3-1h1v1h-1zm2 1h1v1h-1zm2-1h2v1h-2zm3 0h1v2h-1z" />
        <path d="M9 18h1v1H9zm2 1h2v1h-2zm3-1h2v1h-2zm3 1h1v1h-1zm2-1h1v2h-1zm2 1h2v1h-2zm3-1h1v1h-1z" />
        <path d="M9 21h2v1H9zm3 1h1v1h-1zm2-1h1v2h-1zm2 1h2v1h-2zm3-1h1v1h-1zm2 1h1v1h-1zm2-1h2v1h-2z" />
        <path d="M9 24h1v2H9zm2 1h2v1h-2zm3-1h2v1h-2zm3 1h1v1h-1zm2-1h1v2h-1zm2 1h2v1h-2zm3-1h1v1h-1z" />
        <path d="M9 27h2v1H9zm3 0h1v1h-1zm2 0h2v1h-2zm3 0h1v1h-1zm2 0h1v1h-1zm2 0h2v1h-2zm3 0h1v1h-1z" />
      </g>
    </svg>
  )
}
