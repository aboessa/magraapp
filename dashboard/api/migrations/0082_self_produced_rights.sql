-- قرار مالك (2026-08-26): الإطلاق بلا DRM — وتسجيل الملكية الذي يجعله صالحًا.
--
-- ## القرار
--
-- `DECIDE-101` حُسم: كل المحتوى المرئي من إنتاج «مجرة» نفسها، فلا جهة ترخيص
-- تفرض Multi-DRM، والإطلاق يمضي بالوضع المرحلي غير DRM الذي تسمح به الخطة
-- صراحةً (`تشفير المحتوي.md` المعيار 5: «الوضع المؤقت غير DRM … يقتصر على
-- فيديو أصلي يملكه المنتج»).
--
-- ## لماذا ترحيل بيانات لا مجرّد سطر في مستند
--
-- الشرط الذي يجعل القرار صالحًا هو أن **كل** محتوى منشور مملوك. و`content_rights`
-- كان **صفر صفًّا**: لا شيء في النظام يقول من يملك ماذا، فالقرار كان رأيًا غير
-- قابل للتحقّق منه آليًّا — ولا يمكن لأي بوابة نشر أن تفحصه.
--
-- هذا الترحيل يسجّل الملكية لكل ما هو موجود اليوم. وبعده يصير السؤال «هل هذا
-- المحتوى مملوك؟» استعلامًا لا اجتهادًا، ويصير ظهور صفّ محتوى **بلا** صفّ حقوق
-- إشارةً إلى محتوى دخل من خارج الإنتاج الداخلي — وهو بالضبط الحدث الذي يعيد
-- DRM إلى الطاولة.
--
-- ## المالك: `majarra`
--
-- معرّف ثابت لا اسم شركة مكتوب بالحرف، حتى لا يتغيّر معناه بتغيّر التسمية
-- التجارية. `territories` عالمية و`licenses` تشمل البث والتنزيل: هذا ما يعنيه
-- أن تملك عملك، لا ترخيصًا مقيَّدًا حصلت عليه.
--
-- `expiry` تبقى NULL عن قصد: حقوق المنتج على عمله لا تنتهي بتاريخ، وكتابة تاريخ
-- وهمي كانت ستجعل بوابة نشر مستقبلية ترفض محتواك عند حلوله.
--
-- ## ما لا يفعله هذا الترحيل
--
-- لا يُنشئ عقدًا ولا يغني عن مراجعة قانونية (`HUMAN-101` يبقى قائمًا لأي
-- محتوى **مرخَّص** يُضاف لاحقًا). وهو `INSERT OR IGNORE`: صفّ حقوق مكتوب يدويًّا
-- بتفصيل أدقّ لا يُكتب فوقه.

INSERT OR IGNORE INTO content_rights (
  id, entity_type, entity_id, owner, territories, licenses, expiry, contract_url
)
SELECT 'rights-series-' || id, 'series', id, 'majarra',
       '["*"]', '["streaming","offline"]', NULL, NULL
FROM series;

INSERT OR IGNORE INTO content_rights (
  id, entity_type, entity_id, owner, territories, licenses, expiry, contract_url
)
SELECT 'rights-episode-' || id, 'episode', id, 'majarra',
       '["*"]', '["streaming","offline"]', NULL, NULL
FROM episodes;

INSERT OR IGNORE INTO content_rights (
  id, entity_type, entity_id, owner, territories, licenses, expiry, contract_url
)
SELECT 'rights-book-' || id, 'book', id, 'majarra',
       '["*"]', '["streaming","offline"]', NULL, NULL
FROM books;

-- الألعاب تُسجَّل أيضًا: أصولها البصرية والصوتية محتوى مملوك كذلك، وغيابها من
-- السجلّ كان سيجعل «كل محتوى منشور له صفّ حقوق» ادّعاءً غير صحيح.
INSERT OR IGNORE INTO content_rights (
  id, entity_type, entity_id, owner, territories, licenses, expiry, contract_url
)
SELECT 'rights-game-' || id, 'game', id, 'majarra',
       '["*"]', '["streaming"]', NULL, NULL
FROM games;
