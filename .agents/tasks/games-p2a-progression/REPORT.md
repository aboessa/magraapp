# P2-A Progression Final Report

## النتيجة

اكتملت P2-A واعتمدت المراجعة النهائية في `review.json` بالحكم `APPROVED` ومن دون findings. توسعت **سبع ألعاب فقط** من Wave1–3 إلى ثلاثة مستويات متصلة وذات تدرج فعلي، وبقيت الألعاب الإحدى عشرة الأخرى محجوبة بدل إضافة مستويات شكلية. لم تُطبّق أي migration، ولم يحدث نشر أو تعديل production/status أو إنتاج وسائط/شخصيات أو بناء/رفع APK.

## ما تغيّر بالضبط

- أضيف مقترحا الترحيل المحروسان `0106_games_p2a_preschool_kids_progression.sql` و`0107_games_p2a_junior_progression.sql`، مع تحديث جراحي لقائمة وعدد الترحيلات في `dashboard/api/migrations/LEDGER.md`.
- يحدث المقترحان `content_pack` و`updated_at` فقط للألعاب السبعة المحددة. لا يغيران `status` أو العمر أو الهدف التعليمي أو localizations.
- كل pack يستخدم schema v1 الحالي وثلاثة مستويات متصلة و`levels_to_finish=3`، مع تحويل أشكال logic/block القديمة إلى العقود الحالية داخل البيانات فقط.
- تُحل معرفات الصوت المتغيرة بين البيئات من صفوف `content_assets` الجاهزة بواسطة `r2_key` الثابت؛ كل تحديث fail-closed ولا يحدث شيئًا إذا غاب صوت مطلوب.
- وُسّع `dashboard/api/test/enginePacks.test.mjs` لاستخراج packs المقترحة والتحقق منها عبر `ENGINE_SCHEMAS` و`validateGamePack`، ولتشغيل حلول block المرجعية عبر `runBlockProgram`، وفحص IDs والمستويات والحراس وعدم كتابة status.
- وُسّعت اختبارات Flutter في `game_screen_test.dart` و`wave_one_engines_test.dart` و`wave_two_engines_test.dart` لإثبات الانتقال 1→2→3 وقراءة المحتوى من pack، وقيود preschool، وRTL، ونص 2x، وreduced motion، وبدائل D-pad/tap، وثبات دلالات التسجيل.
- لم يُضف محتوى إلى production Dart، ولم تُضف صور أو أصوات أو شخصيات أو poses جديدة.

## الألعاب السبع الموسعة

1. `game-wave1-memory-animals`: 2 ثم 3 ثم 4 أزواج (cat/bird/fish/rabbit)، مع 1400ms ثابتة للفئة 3–5، ومن دون مؤقت أو نقاط أو عقوبة مرئية أو `vo.retry`.
2. `game-wave1-count-place`: ثلاث مسائل في كل مستوى، بمدى عد 1–3 ثم 2–4 ثم 3–5، مع recount والتمثيل الرقمي/النصي وعدم الاعتماد على الصوت وحده.
3. `game-wave1-logic-kids`: قواعد AB ثم AAB ثم matrix 2×2؛ الاختلاف بالشكل لا باللون وحده، وثلاثة خيارات وفجوة واحدة في كل مستوى.
4. `game-wave2-count-drag`: تكوين كميات 2–4 ثم 4–6، ثم مقارنة مجموعات تغطي أكثر/أقل/متساوي، مع بديل tap→tap.
5. `game-wave2-memory-2`: 2 ثم 3 ثم 4 أزواج (lion/owl/turtle/cat)، ومهل 1400 ثم 1200 ثم 1100ms، بلا مؤقت أو عقوبات ظاهرة.
6. `game-wave1-block-code`: تسلسل مستقيم، ثم انعطاف، ثم التفاف حول عائق باستخدام repeat؛ الشبكة تبقى غير معكوسة داخل RTL والحلول المرجعية قابلة للتنفيذ.
7. `game-wave3-block-advanced`: repeat ثم collect ثم if_path؛ كل حل مرجعي يصل إلى الهدف ويجمع المطلوب ويلتزم بالبلوكات والحدود المسموحة. لم يُضف `function` أو أي رسم جديد لروبو.

## الألعاب الإحدى عشرة المحجوبة

1. `game-wave1-picture-match`: يحتاج مراجعة objective وأصوات أسماء دلالية للعناصر؛ أصوات التعليمات العامة ليست labels صحيحة.
2. `game-wave1-color-sort`: يحتاج مجموعة object-only تميز الفئات بالنقش/الرمز مع اللون، وأصوات labels، ومراجعة objective.
3. `game-wave1-sequence-kids`: يحتاج 3–5 لوحات object-only ذات تسلسل واضح مع captions/audio ومراجعة تعليمية.
4. `game-wave1-word-kids`: يحتاج صور كلمات إضافية وتسجيلات نطق الكلمة/شكل الحرف ومراجعة لغوية معتمدة.
5. `game-wave2-match-2`: يحتاج أصوات labels دلالية ومراجعة objective؛ الصور الحالية وحدها لا تكفي pack صالحًا.
6. `game-wave2-rhythm`: يحتاج track مرخصًا مثبتًا وحقوقًا معتمدة ومزامنة ±20ms، مع إثبات دعم تشغيل track في runtime.
7. `game-wave1-sim-lab`: يحتاج ظاهرة ومتغيرًا مقاسًا وعلاقة علمية صحيحة و`scientific_review` معتمدًا وobjective مناسبًا.
8. `game-wave2-sort-junior`: يحتاج object-only set أنضج لتصنيفات junior مختلفة، وأصوات labels، ومراجعة تربوية.
9. `game-wave2-timeline`: يحتاج حدثًا ثالثًا أو أكثر بصور object-only، وسنوات/شرحًا موثقًا، و`historical_review` معتمدًا.
10. `game-wave3-sim-saturating`: يحتاج نموذج تشبع قابلًا للدفاع عنه ووحدات وقياسًا وتفسيرًا وبيانات safety متسقة و`scientific_review` معتمدًا.
11. `game-wave3-timeline-detail`: يحتاج توثيق السنوات والإحداثيات والشرح ومراجعة تاريخية، وصور أحداث object-only مراجعة عند الحاجة.

## الترحيلات المقترحة — لم تُطبّق

- `0106_games_p2a_preschool_kids_progression.sql`: مقترح packs الألعاب الخمس preschool/kids.
- `0107_games_p2a_junior_progression.sql`: مقترح packs لعبتي block junior.
- تم التحقق من ملفي SQL واختبارهما نصيًا فقط. **لم تُشغّل** أوامر `migrate:local` أو `migrate:remote`، ولم تتغير أي قاعدة D1 محلية أو بعيدة، ولم يحدث deploy.

## التحقق والنتائج

- `git diff 971a10a..HEAD`، و`git diff --check 971a10a..HEAD`، وفحوص أسماء/حالات التزامي P2-A: النطاق صحيح ولا أخطاء whitespace.
- فحص IDs داخل `0106` و`0107`: وُجدت الألعاب السبع المعتمدة فقط، ولم تظهر أي لعبة من المحجوبة.
- `node --experimental-strip-types --test test/enginePacks.test.mjs test/migrations.test.mjs`: **51 passed**.
- `npm test` بعد `npm ci` لاستعادة dependencies المطابقة للـlockfile: **1598 passed**.
- `npm run typecheck:types`: **لم يمر** بسبب 50 خطأ سابقًا وخارج diff في خمسة ملفات admin routes: `adminAiStoryStudio`, `adminCoupons`, `adminLiveEvents`, `adminNotifications`, `adminScreentime`. لم يتغير production TypeScript في P2-A ولم يظهر أي ملف P2-A ضمن الأخطاء.
- `flutter analyze lib/features/games`: **no issues**.
- `flutter test test/game_screen_test.dart test/engine_content_separation_test.dart test/wave_one_engines_test.dart test/wave_two_engines_test.dart test/drawing_asset_map_integrity_test.dart test/shared_fixtures_test.dart`: **122 passed**.
- راجعت المراجعة أيضًا baseline `971a10a` لفن الألعاب المراجع و`game_art.dart` وإعداد bundling في `pubspec` وقواعد ignore، وراجعت يدويًا ملفات المهمة والترحيلين وتعديلات LEDGER والاختبارات.

## القيود المحفوظة

- لم تُعدل الترحيلات القديمة `0054`–`0056`، ولم تُطبّق `0106` أو `0107`.
- لا status write ولا نشر ولا production operation ولا تغيير age/objective/localizations.
- لا وسائط أو شخصية أو pose أو Character Sheet جديدة؛ أعيد استخدام chrome روبو الحالي فقط. أي تطوير بصري جديد لروبو يبقى متوقفًا على Character Sheet مستقلة واعتماد صريح واختبار اتساق.
- لا اعتماد على اللون أو الصوت وحدهما؛ احتُفظ بـRTL، ونص 2x، وreduced motion، وبدائل D-pad/tap، ودلالات التسجيل الحالية، وعدم معاقبة الحل الأطول الصحيح.
- حُفظت تغييرات المستخدم وP0/P1 الموجودة ولم تُستبدل الملفات كاملة.
- لم يُبنَ أو يُرفع APK، ولم تُستخدم Google AI Studio أو مفاتيح توليد وسائط.

## بوابات إصدار غير متحققة

تبقى الآتي بوابات إصدار مفتوحة ولا تُعد “تعمل” بناءً على فحص الكود أو الاختبارات الآلية فقط:

- المسار الحي `capability token → R2 → audio playback` والتحقق من صفوف/ملفات الصوت في البيئة المستهدفة.
- التشغيل على أجهزة فعلية، بما في ذلك hardware D-pad وsafe areas والتباين الفعلي.
- الفحص اليدوي باستخدام TalkBack وVoiceOver وسائر تقنيات المساعدة.
- تطبيق الترحيلات أو النشر أو أي release smoke؛ كل ذلك خارج نطاق P2-A ولم يُنفذ.
