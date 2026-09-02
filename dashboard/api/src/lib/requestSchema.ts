/// تحقّق مخطَّطي مركزي لأجسام الطلبات (`SEC-110`).
///
/// ## العلّة
///
/// خمسمئة نقطة نهاية كانت تتحقّق من مدخلاتها **يدويًّا داخل كل معالج**، فصار
/// التحقّق دالّةً على انتباه كاتب كل واحد. والفرق مرئي في الكود نفسه: مسار يفحص
/// النوع والمدى بدقّة، وآخر يكتفي بوجود الحقل، وثالث يقرأ `body.x as string`.
///
/// ## لماذا مُصادِق مكتوب لا `zod`
///
/// `zod` أداة ممتازة، ورُفضت لثلاثة أسباب قابلة للقياس:
///
/// 1. **الحجم.** Worker له سقف حزمة، و`zod` يضيف عشرات الكيلوبايتات لأجل عشرة
///    أنواع نستخدمها فعلًا: نصّ، عدد، منطقي، قائمة مغلقة، مصفوفة، كائن.
/// 2. **الاعتماد.** كل حزمة جديدة سطح توريد يُصان ويُدقَّق ويُرقَّى.
/// 3. **العقد المعلَن.** المطلوب هنا ليس أنواعًا في وقت الترجمة بل **رفضًا في وقت
///    التشغيل** برسالة موحّدة، وهو مئتا سطر لا مكتبة.
///
/// وما ليس هنا مقصود: لا تحويلات، ولا قيَم افتراضية، ولا اتحادات مركَّبة. المخطَّط
/// **يصفّي** ولا يُنشئ، فما يخرج منه هو ما دخل — أو لا شيء.
///
/// ## رفض الحقل غير المعروف
///
/// السلوك الافتراضي، لا خيارًا. حقل زائد يُقبَل صامتًا هو إمّا خطأ إملائي في
/// العميل يُهمَل بلا أثر — فيُرسل `child_Id` ويُقرأ الطلب كأنه بلا طفل — أو حقل
/// حقيقي أُزيل من الخادم وما زال العميل يرسله. والحالتان تستحقّان جوابًا.

/// نوع الحقل: يقرأ قيمة خامًا ويعيد إمّا قيمة مقبولة أو رفضًا.
export type FieldRule = {
  optional?: boolean;
  /// يعود `null` عند القبول، أو سبب الرفض كاسم رمزي لا رسالة.
  check: (value: unknown) => 'type' | 'range' | 'pattern' | 'enum' | null;
};

/// مخطَّط جسم الطلب: اسم الحقل إلى قاعدته.
export type BodySchema = Record<string, FieldRule>;

/// نتيجة التحقّق. الفشل يحمل أسماء الحقول وحدها.
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fields: string[]; reason: 'missing' | 'invalid' | 'unknown' | 'malformed' };

/* --------------------------------------------------------------- بناة الحقول */

export function text(options: {
  min?: number;
  max?: number;
  pattern?: RegExp;
  optional?: boolean;
  /// يقبل `null` صريحًا: مسارات التحديث تحتاج «امسح هذا الحقل».
  nullable?: boolean;
} = {}): FieldRule {
  const { min = 1, max = 4096, pattern, optional, nullable } = options;
  return {
    optional,
    check: (value) => {
      if (value === null) return nullable ? null : 'type';
      if (typeof value !== 'string') return 'type';
      if (value.length < min || value.length > max) return 'range';
      return pattern && !pattern.test(value) ? 'pattern' : null;
    },
  };
}

export function integer(options: {
  min?: number;
  max?: number;
  optional?: boolean;
  nullable?: boolean;
} = {}): FieldRule {
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, optional, nullable } = options;
  return {
    optional,
    check: (value) => {
      if (value === null) return nullable ? null : 'type';
      // `Number.isInteger` يرفض `NaN` و`Infinity` والنصّ الرقمي معًا. وقبول
      // `'7'` كان سيعني أن العميل يتحكّم في نوع ما نُدرجه في القاعدة.
      if (!Number.isInteger(value)) return 'type';
      return (value as number) < min || (value as number) > max ? 'range' : null;
    },
  };
}

export function boolean(options: { optional?: boolean } = {}): FieldRule {
  return {
    optional: options.optional,
    check: (value) => (typeof value === 'boolean' ? null : 'type'),
  };
}

/// قائمة مغلقة. القيمة إمّا فيها أو مرفوضة.
export function oneOf(values: readonly string[], options: {
  optional?: boolean;
  nullable?: boolean;
} = {}): FieldRule {
  return {
    optional: options.optional,
    check: (value) => {
      if (value === null) return options.nullable ? null : 'type';
      if (typeof value !== 'string') return 'type';
      return values.includes(value) ? null : 'enum';
    },
  };
}

/// مصفوفة عناصرها تتبع قاعدة واحدة، بسقف طول **إلزامي**.
///
/// السقف ليس خيارًا: مصفوفة بلا حدّ هي طلب واحد يستهلك ذاكرة Worker كلّها.
export function list(item: FieldRule, options: {
  max: number;
  min?: number;
  optional?: boolean;
}): FieldRule {
  return {
    optional: options.optional,
    check: (value) => {
      if (!Array.isArray(value)) return 'type';
      if (value.length < (options.min ?? 0) || value.length > options.max) return 'range';
      for (const entry of value) {
        const failure = item.check(entry);
        if (failure) return failure;
      }
      return null;
    },
  };
}

/// كائن متداخل بمخطَّطه، ويرفض الحقول غير المعروفة كالجسم نفسه.
export function nested(shape: BodySchema, options: {
  optional?: boolean;
  nullable?: boolean;
} = {}): FieldRule {
  return {
    optional: options.optional,
    check: (value) => {
      if (value === null) return options.nullable ? null : 'type';
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'type';
      const result = validateBody(value, shape);
      if (result.ok) return null;
      return result.reason === 'missing' || result.reason === 'unknown' ? 'type' : 'range';
    },
  };
}

/// قيمة حرّة الشكل يفحصها المعالج بنفسه (حمولة لعبة، إعدادات مُخزَّنة كما هي).
///
/// معلَنة صراحةً حتى يبقى «هذا الحقل بلا مخطَّط» **قرارًا مكتوبًا** لا سهوًا.
export function opaque(options: { optional?: boolean } = {}): FieldRule {
  return { optional: options.optional, check: () => null };
}

/* ---------------------------------------------------------------- التصفية */

/// يتحقّق من كائن مقابل مخطَّط ويعيد **الحقول المعلَنة وحدها**.
///
/// الإرجاع منسوخ لا مُمرَّرًا: ما بعد هذه الدالّة لا يرى حقلًا لم يُعلَن، فلا
/// يمكن أن يقرأ معالجٌ حقلًا نسي المخطَّط إعلانه.
export function validateBody<T extends Record<string, unknown>>(
  body: unknown,
  schema: BodySchema,
): ValidationResult<T> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: [], reason: 'malformed' };
  }
  const source = body as Record<string, unknown>;

  const unknown = Object.keys(source).filter((key) => !(key in schema));
  if (unknown.length > 0) return { ok: false, fields: unknown.sort(), reason: 'unknown' };

  const missing: string[] = [];
  const invalid: string[] = [];
  const value: Record<string, unknown> = {};

  for (const [name, rule] of Object.entries(schema)) {
    const entry = source[name];
    if (entry === undefined) {
      if (!rule.optional) missing.push(name);
      continue;
    }
    if (rule.check(entry)) invalid.push(name);
    else value[name] = entry;
  }

  // الناقص قبل الخاطئ: «أين الحقل؟» سؤال أوضح من «ما خطبه؟» لمن يبني عميلًا.
  if (missing.length > 0) return { ok: false, fields: missing.sort(), reason: 'missing' };
  if (invalid.length > 0) return { ok: false, fields: invalid.sort(), reason: 'invalid' };
  return { ok: true, value: value as T };
}

/// شكل الخطأ الموحَّد.
///
/// ## ما يُقال وما لا يُقال
///
/// يُقال: **أسماء الحقول** ورمز السبب. ولا يُقال: القاعدة المخروقة، ولا الحدّ،
/// ولا النمط، ولا نوع العمود، ولا اسم جدول. «`birth_year` غير صالح» يكفي من
/// يبني عميلًا شريفًا، و«`birth_year` يجب أن يكون بين 2008 و2024» يرسم لمن
/// يستكشف حدود القاعدة خريطةً مجّانًا.
///
/// والرمز واحد لكل الأسباب (`invalid_body`) حتى لا يفرّق العميل بين «مجهول» و
/// «ناقص» و«خاطئ»: التفريق يجعل من المسار أوراكل لمعرفة الحقول المعروفة.
export function validationFailure(result: Extract<ValidationResult<never>, { ok: false }>) {
  return {
    success: false as const,
    code: 'invalid_body' as const,
    error: 'Request body is invalid',
    data: { fields: result.fields },
  };
}

/// يقرأ جسم الطلب ويتحقّق منه. الاستعمال الوحيد المقصود في المعالجات.
///
/// ```ts
/// const parsed = await parseBody(c, { child_id: text({ max: 64 }) });
/// if (!parsed.ok) return c.json(validationFailure(parsed), 400);
/// ```
export async function parseBody<T extends Record<string, unknown>>(
  c: { req: { json(): Promise<unknown> } },
  schema: BodySchema,
): Promise<ValidationResult<T>> {
  // JSON غير صالح ليس حالة استثناء بل مدخل خاطئ: الرفض بنفس شكل رفض حقل.
  const raw = await c.req.json().catch(() => null);
  return validateBody<T>(raw, schema);
}

/// يقرأ الجسم ويعيد ردَّ الرفض **جاهزًا** عند الفشل.
///
/// كُتب هذا المُغلِّف في أربعة موجّهات بأربع نسخ متطابقة في الدفعة 18، فانتقل
/// إلى هنا: نسخةٌ خامسة كانت ستعني خمسة مواضع يمكن أن يفترق فيها شكل الرفض.
export async function bodyOr400<T>(
  c: { req: { json(): Promise<unknown> } },
  schema: BodySchema,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const parsed = await parseBody(c, schema);
  if (parsed.ok) return { ok: true, value: parsed.value as T };
  return { ok: false, response: Response.json(validationFailure(parsed), { status: 400 }) };
}

/// جسمٌ **لا يقبل أي حقل**.
///
/// لمسارٍ كل معلوماته في مساره (مثل `POST /:id/read`). ومعناه صريح: أي حقل يُرسَل
/// يُرفَض بدل أن يُهمَل — فعميلٌ يظنّ أنه يرسل معلومة مؤثّرة يُصحَّح فورًا.
export const NO_FIELDS: BodySchema = {};
