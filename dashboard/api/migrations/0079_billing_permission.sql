-- صلاحية الفوترة: `manage_billing`
--
-- ## العلّة التي يغلقها هذا الترحيل
--
-- `routes/adminBilling.ts` كان يفرض `requireAdmin` وحده على كل مساراته، فأخطر
-- عمليتين فيه — `POST /billing/refunds` و`POST /billing/grant` — كانتا بلا أي
-- فحص صلاحية. أي حساب لوحة مُصادَق، بأي دور، حتى `viewer` أو `translator`،
-- كان يستطيع منح باقة `family_plus` لسنة كاملة أو إنشاء صف استرداد أموال.
--
-- المسح في `test/routeGuards.test.mjs` يكشف هذا صراحةً، وكان يفشل عليهما.
--
-- ## لماذا صلاحية جديدة لا `manage_permissions`
--
-- `manage_permissions` هي صلاحية إدارة الأدوار والمنح. إعادة استخدامها للمال
-- تدمج سلطتين مختلفتين في مفتاح واحد وتمنع فصل المهام: من يدير أدوار الفريق
-- ليس بالضرورة من يوافق على استرداد.
--
-- ## من يملكها الآن
--
-- `owner` و`system_admin` فقط. الدورين يتخطّيان النطاق أصلًا في
-- `lib/adminUsers.ts:can()`، فالمنح هنا تصريح لا تغيير سلوك — لكنه يجعل
-- الصلاحية ظاهرة في شاشة الأدوار وقابلة للمنح لدور مالي مستقبلًا دون ترحيل
-- جديد. لا يُمنح لأي دور محتوى: النشر والمراجعة لا يستلزمان لمس المال.
INSERT OR IGNORE INTO permissions (id, action, description_ar)
VALUES ('manage_billing', 'Manage Billing', 'إدارة الفوترة والاستردادات ومنح الباقات');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES ('owner', 'manage_billing'), ('system_admin', 'manage_billing');
