export type IconName =
  | 'dashboard' | 'analytics' | 'planets' | 'series' | 'seasons' | 'episodes'
  | 'characters' | 'books' | 'games' | 'skills' | 'objectives' | 'parents'
  | 'children' | 'devices' | 'subscriptions' | 'rights' | 'reviews'
  | 'search' | 'sun' | 'moon' | 'menu' | 'close' | 'plus' | 'edit'
  | 'archive' | 'refresh' | 'arrow' | 'sparkles' | 'logout' | 'play' | 'bell'
  | 'media' | 'styles' | 'upload' | 'link' | 'settings' | 'globe'
  // أيقونات طبقة UX المشتركة (فلاتر، أعمدة، تقويم، خطّ زمني، شجرة) وشاشات
  // الموقع والمدوّنة و SEO. أُضيفت هنا لا كرموز نصّية في كل شاشة: الرمز النصّي
  // يختلف عرضه بين الخطوط ولا يورَث لونه، فتظهر الأزرار غير متناسقة.
  | 'filter' | 'columns' | 'calendar' | 'timeline' | 'tree' | 'trash' | 'eye'
  | 'check' | 'warning' | 'clock' | 'text' | 'grip' | 'blog' | 'seo' | 'website'

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

  switch (name) {
    case 'dashboard': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="11" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="18" width="7" height="3" rx="1.5"/></svg>
    case 'analytics': return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
    case 'planets': return <svg {...common}><circle cx="12" cy="12" r="7"/><path d="M3 15c3.5 2 8.5 2.3 13 .7 3.3-1.2 5.3-3 4.6-4.3-.5-.9-2.3-1.1-4.6-.7M12 3v2M19 12h2"/></svg>
    case 'series': return <svg {...common}><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M8 7h8M8 17h5"/></svg>
    case 'seasons': return <svg {...common}><path d="M4 5h16M4 12h16M4 19h16"/><path d="M7 3v4M12 10v4M17 17v4"/></svg>
    case 'episodes': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>
    case 'characters': return <svg {...common}><circle cx="12" cy="7" r="3"/><path d="M4 20c0-4 3-7 8-7s8 3 8 7"/></svg>
    case 'books': return <svg {...common}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23zM20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23z"/></svg>
    case 'games': return <svg {...common}><path d="M6 11h4M8 9v4M15 10h.01M18 13h.01"/><path d="M4 10a8 8 0 0 1 16 0v4a8 8 0 0 1-16 0z"/></svg>
    case 'skills': return <svg {...common}><path d="M12 3 5 7v5c0 5 3.5 8 7 9 3.5-1 7-4 7-9V7z"/><path d="m9 12 2 2 4-5"/></svg>
    case 'objectives': return <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>
    case 'parents': return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3.5 20c0-4 2.4-6 5.5-6s5.5 2 5.5 6M14 15c3.7-.8 6.5 1.1 6.5 4"/></svg>
    case 'children': return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M5 21c.5-5 3-7 7-7s6.5 2 7 7M9 8h.01M15 8h.01M10 11c1 .8 3 .8 4 0"/></svg>
    case 'devices': return <svg {...common}><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
    case 'subscriptions': return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h4"/></svg>
    case 'rights': return <svg {...common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>
    case 'reviews': return <svg {...common}><rect x="4" y="4" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5M9 18l3 3 3-3"/></svg>
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>
    case 'moon': return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
    case 'menu': return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>
    case 'edit': return <svg {...common}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
    case 'archive': return <svg {...common}><path d="M3 6h18M5 6v14h14V6M9 10h6M4 3h16v3H4z"/></svg>
    case 'refresh': return <svg {...common}><path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5"/></svg>
    case 'arrow': return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>
    case 'sparkles': return <svg {...common}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></svg>
    case 'logout': return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>
    case 'play': return <svg {...common}><path d="m9 7 8 5-8 5Z"/><circle cx="12" cy="12" r="10"/></svg>
    case 'bell': return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
    case 'media': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg>
    case 'styles': return <svg {...common}><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h2a7 7 0 0 0-2-11Z"/><circle cx="7.5" cy="10" r=".7" fill="currentColor"/><circle cx="10" cy="6.8" r=".7" fill="currentColor"/><circle cx="15" cy="7.5" r=".7" fill="currentColor"/></svg>
    case 'upload': return <svg {...common}><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>
    case 'link': return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></svg>
    case 'filter': return <svg {...common}><path d="M3 5h18l-7 8v6l-4-2v-4Z"/></svg>
    case 'columns': return <svg {...common}><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="16" rx="1.5"/><rect x="17" y="4" width="4" height="16" rx="1.5"/></svg>
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
    case 'timeline': return <svg {...common}><path d="M6 3v18"/><circle cx="6" cy="8" r="2"/><circle cx="6" cy="16" r="2"/><path d="M10 8h10M10 16h7"/></svg>
    case 'tree': return <svg {...common}><rect x="3" y="3" width="6" height="4" rx="1"/><rect x="14" y="10" width="7" height="4" rx="1"/><rect x="14" y="17" width="7" height="4" rx="1"/><path d="M6 7v10h8M6 12h8"/></svg>
    case 'trash': return <svg {...common}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>
    case 'eye': return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>
    case 'check': return <svg {...common}><path d="m4 12 5 5L20 6"/></svg>
    case 'warning': return <svg {...common}><path d="M12 3 2 20h20Z"/><path d="M12 9v5M12 17h.01"/></svg>
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>
    case 'text': return <svg {...common}><path d="M4 6h16M4 11h16M4 16h10"/></svg>
    case 'grip': return <svg {...common}><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/></svg>
    case 'blog': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 17h7"/></svg>
    case 'seo': return <svg {...common}><circle cx="10" cy="10" r="6"/><path d="m19 19-4.5-4.5M8 10h4M10 8v4"/></svg>
    case 'website': return <svg {...common}><rect x="2" y="4" width="20" height="15" rx="2"/><path d="M2 9h20M6 6.5h.01M9 6.5h.01"/></svg>
  }
}
