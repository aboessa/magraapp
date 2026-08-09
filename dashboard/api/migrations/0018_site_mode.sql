-- وضع الموقع العام: مباشر أو تحت الإنشاء أو تحت الصيانة.
--
-- يُخزَّن في platform_settings الموجود من المهاجرة 0017 بمفاتيح/قيم، فلا حاجة
-- لجدول جديد ولا لمهاجرة عند إضافة إعداد لاحق.
--
-- القيمة الافتراضية `construction`: الموقع لم يُطلق بعد، والافتراض الآمن هو
-- ألا يظهر محتوى غير جاهز لزائر. تبديله إلى `live` قرار صريح من اللوحة.

INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('site_mode', 'construction');

-- موعد الإطلاق المتوقّع، اختياري بصيغة ISO 8601. فارغ يعني «لا موعد معلن»،
-- ولا نخترع موعدًا افتراضيًا حتى لا نعِد الزائر بما لم يُقرّر.
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('site_launch_at', '');

-- رسالة اختيارية تُعرض على صفحة الحالة. فارغة تعني استخدام النص المُصمَّم
-- في الواجهة، وهو مترجم للغات الثلاث؛ الرسالة المخصّصة نص واحد كما يكتبه المسؤول.
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('site_status_message', '');

-- نافذة الصيانة المتوقّعة بالدقائق، اختيارية. فارغة تعني «مدة غير محدّدة».
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('maintenance_eta_minutes', '');
