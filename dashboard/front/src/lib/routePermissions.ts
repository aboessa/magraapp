/**
 * الصلاحية المطلوبة لكل مسار في اللوحة (`ADM-102`).
 *
 * ## العلّة
 *
 * الخادم يفرض التصاريح بجدية: **196** استدعاءً لـ`requirePermission` في ستّة
 * وثلاثين موجّهًا إداريًّا. واللوحة كانت تفتح كل شاشة لأي حساب مُصادَق، ثم يفشل
 * النداء بـ403.
 *
 * وأثره ليس أمنيًّا — الأمان سليم — بل **تشغيليّ**: مراجعٌ لغوي يرى قائمة كاملة
 * بشاشات لا يملكها، يفتح واحدة، يملأ نموذجًا، ثم يفقد عمله على 403. والنتيجة
 * التي تتكرّر في كل فريق: **يتعلّم المستخدمون تجاهل الأخطاء**.
 *
 * ## القاعدة التي اخترتها، وحدودها
 *
 * `null` تعني «أي حساب إداري مُصادَق يرى هذه الشاشة». وهي الافتراض لكل شاشة
 * **قراءة**: القوائم وصفحات التفاصيل ولوحات المتابعة. فالخادم يحرس الكتابة على
 * أي حال، وحجبُ القراءة يمنع مراجعًا من أن يفهم ما يراجعه.
 *
 * والصلاحية تُطلَب حيث تكون الشاشة **كلّها فعلًا** لا يملكه الحساب: إدارة
 * المستخدمين والأدوار والمنح، ومزوّدو الذكاء الاصطناعي، والفوترة والأسعار، وسجل
 * التدقيق، ووضع الموقع. هناك يكون فتح الشاشة وعدًا كاذبًا كاملًا.
 *
 * **وهذا ليس بديلًا عن حرس الخادم.** الخريطة تحسّن التجربة وتمنع فقدان العمل؛
 * والسلطة تبقى في `requirePermission`. عميلٌ يُعدَّل في المتصفح يتجاوز هذه
 * الخريطة ولا يتجاوز الخادم.
 *
 * ## أسماء الصلاحيات
 *
 * مقروءة من مواضع `requirePermission` في الخادم لا مُختلقة، وهي ثمانية عشر اسمًا.
 * واسمٌ لا يعرفه الخادم يعني حجبًا دائمًا لا يفسّره أحد، فيحرسه اختبار يوازن
 * القائمتين.
 */

/// أسماء الصلاحيات التي يفرضها الخادم فعلًا، مرتَّبة كما وردت في `requirePermission`.
export const SERVER_PERMISSIONS = [
  'edit_metadata', 'publish', 'create', 'archive', 'manage_permissions',
  'assign_members', 'review', 'manage_ai_providers', 'edit_text', 'manage_team',
  'upload_images', 'upload_audio', 'manage_billing', 'approve', 'update',
  'delete', 'view_audit_log', 'delete_draft',
] as const

export type ServerPermission = typeof SERVER_PERMISSIONS[number]

/**
 * مسار → الصلاحية التي بلا وجودها تكون الشاشة عديمة الجدوى.
 *
 * المفتاح هو نصّ `path` كما هو مكتوب في `AdminRoutes.tsx` حرفيًّا، ويحرس اختبارٌ
 * أن القائمتين متطابقتان — فمسارٌ يُضاف بلا قرارٍ هنا يُفشل الجولة بدل أن يُفتح
 * للجميع بالسهو.
 */
export const ROUTE_PERMISSIONS: Record<string, ServerPermission | null> = {
  // --- قراءة ومتابعة: مفتوحة لكل حساب إداري ---------------------------------
  '/': null,
  'my-account': null,
  'security': null,
  'sessions': null,
  'app-diagnostics': null,
  'taxonomy': null,
  'planets': null,
  'planets/:id': null,
  'availability': null,
  'skills': null,
  'objectives': null,
  'objectives/:id': null,
  'content-reviews': null,
  'series': null,
  'series/:id': null,
  'seasons': null,
  'seasons/:id': null,
  'episodes': null,
  'episodes/:id': null,
  'characters': null,
  'characters/:id': null,
  'stories': null,
  'stories/:id': null,
  'library': null,
  'library-content': null,
  'library-content/:kind/:id': null,
  'books': null,
  'books/:id': null,
  'games': null,
  'games/:id': null,
  'games-ops': null,
  'games-audio-queue': null,
  'games-art-queue': null,
  'projects': null,
  'projects/:id': null,
  'media': null,
  'media/:id': null,
  'visual-styles': null,
  'visual-styles/:id': null,
  'visual-styles/compare': null,
  'creative-studio': null,
  'creative-studio/v2': null,
  'creative-studio/coloring': null,
  'creative-studio/draw-like-me': null,
  'creative-studio/connect-dots': null,
  'creative-studio/complete': null,
  'creative-studio/trace': null,
  'creative-studio/copy-pattern': null,
  'creative-studio/reference': null,
  'creative-studio/reference/:id': null,
  'creative-studio/authoring': null,
  'parents': null,
  'parents/:id': null,
  'customers': null,
  'customers/:id': null,
  'children': null,
  'children/:id': null,
  'analytics': null,
  'tasks': null,
  'production': null,
  'production/factory': null,
  'production/factory/:runId': null,
  'calendar': null,
  'quality': null,
  'mastery': null,
  'devices-admin': null,
  'devices/:id': null,
  'support-center': null,
  'workflows': null,
  'rights': null,
  'rights/:id': null,
  'ops': null,
  'ops/services/:id': null,
  'ops/incidents': null,
  'ops/incidents/:id': null,
  'ops/alerts': null,
  'ops/queues/:name': null,
  'ops/telemetry': null,
  'ops-sla': null,
  'ops-sla/policy/:id': null,
  'campaigns': null,
  'campaigns/:id': null,
  'revenue': null,
  'translation': null,
  'translation/:id': null,
  'quiz': null,
  'quiz/:id': null,
  'recommendations': null,
  'school': null,
  'partnerships': null,
  'website/pages': null,
  'website/pages/:id': null,
  'blog/posts': null,
  'blog/posts/:id': null,
  'blog/taxonomy': null,
  'seo': null,
  'app-releases': null,
  'app-experience': null,
  'stories/:id/builder': null,
  'settings': null,

  // --- شاشات هي فعلٌ كامل: بلا الصلاحية لا يبقى فيها شيء ---------------------
  //
  // إدارة الفريق والأدوار والمنح: كل زرّ فيها يحتاج الصلاحية، فالفتح بلا صلاحية
  // عرضٌ لأسماء لا يمكن تغيير شيء فيها.
  'teams': 'manage_team',
  'teams/:id': 'manage_team',
  // `GET /admin/grants` نفسه محروس بـ`manage_permissions` في الخادم، وشاشة
  // «الموظفون والتصاريح» تُحمّل المنح، فبلا الصلاحية لا تُحمَّل الشاشة أصلًا.
  'team-access': 'manage_permissions',
  'team-access/:id': 'manage_permissions',
  'governance': 'manage_permissions',
  'roles': 'manage_permissions',
  'roles/:id': 'manage_permissions',
  'grants': 'manage_permissions',
  'grants/:id': 'manage_permissions',

  // مزوّدو الذكاء الاصطناعي: مفاتيح وحدود إنفاق. القراءة نفسها محروسة في الخادم.
  'ai-providers': 'manage_ai_providers',

  // الفوترة والأسعار: أرقام مالية تُقرأ ثم تُغيَّر، والخادم يحرس الاثنين.
  'billing': 'manage_billing',
  'billing/subscription/:id': 'manage_billing',
  'billing/transaction/:id': 'manage_billing',
  'packages': 'manage_billing',
  'plans/:id': 'manage_billing',
  'finance-advanced': 'manage_billing',

  // سجل التدقيق: صلاحيته مُسمّاة في الخادم بالاسم نفسه.
  'audit-logs': 'view_audit_log',
  'audit-logs/:id': 'view_audit_log',

  // وضع الموقع العام والضبط البعيد وإعادة تشغيل الأحداث الفاشلة: كلها تحوّل ما
  // يراه المستخدم النهائي، وحرسها في الخادم `publish`.
  'website/mode': 'publish',
  'remote-config': 'publish',
  'failed-events': 'publish',
  'failed-events/:id': 'publish',

  // خطّ إنتاج الصوت: الشاشة كلّها رفعُ ملفات نطق.
  'narration': 'upload_audio',
}

/**
 * يوازن مسار الموقع الحالي بنمط مُعلَن في [ROUTE_PERMISSIONS].
 *
 * المطابقة على المقاطع مع اعتبار `:param` مقطعًا حرًّا، والأطول تخصيصًا يفوز: لولا
 * ذلك لطابق `stories/:id` المسارَ `stories/x/builder` جزئيًّا، أو طابق نمطٌ عامّ
 * مسارًا له نمطه الخاصّ.
 */
export function permissionForPath(path: string): ServerPermission | null {
  const clean = path.replace(/^\/+|\/+$/g, '')
  if (clean === '') return ROUTE_PERMISSIONS['/'] ?? null
  const segments = clean.split('/')

  let best: { score: number; permission: ServerPermission | null } | null = null
  for (const [pattern, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pattern === '/') continue
    const patternSegments = pattern.split('/')
    if (patternSegments.length !== segments.length) continue
    let score = 0
    let matched = true
    for (let index = 0; index < patternSegments.length; index += 1) {
      const expected = patternSegments[index]
      if (expected.startsWith(':')) continue
      if (expected !== segments[index]) { matched = false; break }
      // المقطع الحرفي يرفع التخصيص، فالنمط الأكثر حرفيةً يفوز.
      score += 1
    }
    if (!matched) continue
    if (!best || score > best.score) best = { score, permission }
  }

  // مسارٌ غير معروف: لا يُحجَب. الحجب هنا يعني شاشةً بيضاء لخطأ في الخريطة، وهو
  // أسوأ من فتح شاشةٍ يحرسها الخادم أصلًا. والاختبار يمنع بقاء مسار بلا إعلان.
  return best ? best.permission : null
}
