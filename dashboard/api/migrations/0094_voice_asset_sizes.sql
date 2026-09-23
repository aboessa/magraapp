-- ‏0094 — حجم أصول صوت الألعاب الـ150 بالبايت.
--
-- ## العطل
--
-- ‏`0088` أدرج 150 أصلًا صوتيًّا بـ`r2_key` و`bucket` صحيحين و**بلا `size_bytes`**،
-- و`0089` يربطها ولا يضبط الحجم أيضًا. فالمقيس على الإنتاج: 150 صفًّا حجمها صفر
-- أو `NULL` مع ملفات حقيقية في R2 — تحقّقتُ بتنزيل
-- `private/audio/games/block-code/ar/vo-block-collect-ar.wav` فجاء **59,564 بايت**.
--
-- وأثر ذلك ليس تجميليًّا: `size_bytes` هو ما يبني عليه ترخيص العمل بلا اتصال
-- (`0083_offline_licensing.sql`) ميزانيةَ التنزيل، وما تعرضه تقارير التخزين في
-- اللوحة. وصفرٌ هنا يُقرأ «ملفٌ بلا حجم» فيمرّ أي سقف.
--
-- ## المصدر، ولماذا هو موثوق
--
-- الأحجام مقروءة من **نفس ملفات WAV التي رُفعت**، في `assets/audio/games/` عند
-- جذر المستودع. والتطابق مُتحقَّق منه: الملف المحلي أعلاه **59,564 بايت** أيضًا،
-- أي مطابقٌ لما في R2 بايتًا ببايت.
--
-- و`assets/` مُتجاهَل في git (مصادر إنتاج، 32 م.ب)، فلا يُعاد توليد هذا الملف في
-- بناءٍ نظيف — ولذلك الأرقام **مكتوبة فيه** لا مقروءة عند التطبيق.
--
-- ## المفتاح `r2_key` لا `id` — وهذا مقيس
--
-- نسخةٌ أولى من هذا الترحيل فُتِحت بـ`WHERE id = …` بمعرّفات `0088`، فأصابت **44
-- صفًّا من 150** على الإنتاج. والسبب أن نفس الملفات مُسجَّلة هناك باصطلاحَي معرّف:
-- 44 بـ`asset-games-*` و106 بـ`asset-vo-*` — **150 صفًّا و150 مفتاحًا مختلفًا**،
-- أي لا تكرار ولا اصطلاح واحد.
--
-- فالمفتاح الثابت بين البيئات هو **الملف** لا المعرّف.
--
-- ## الشكل
--
-- ‏`UPDATE ... WHERE (size_bytes IS NULL OR size_bytes = 0)` — فالإعادة لا-عملية،
-- ولا تُصفِّر حجمًا صحيحًا ضبطه شيءٌ آخر لاحقًا. ولا `INSERT`: الصفوف موجودة،
-- وهذا الترحيل يُكمل حقلًا لا يُنشئ محتوًى.
--
-- ## تحفّظ على `0088` كُشف أثناء هذا العمل
--
-- ‏`0088` يُدرج الـ150 كلّها بمعرّفات `asset-games-*`. والإنتاج يحمل 106 منها
-- بمعرّفات `asset-vo-*` بالفعل، فتطبيق `0088` هناك يُنشئ **106 صفوف مكرّرة** لنفس
-- الـ`r2_key`. ويجب حسم ذلك قبل تطبيق الترحيلات المعلَّقة على الإنتاج.

UPDATE content_assets SET size_bytes = 172844 WHERE r2_key = 'private/audio/games/block-code/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 190124 WHERE r2_key = 'private/audio/games/block-code/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 618284 WHERE r2_key = 'private/audio/games/block-code/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 159404 WHERE r2_key = 'private/audio/games/block-code/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 313004 WHERE r2_key = 'private/audio/games/block-code/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE r2_key = 'private/audio/games/block-code/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 103724 WHERE r2_key = 'private/audio/games/block-code/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 209324 WHERE r2_key = 'private/audio/games/block-code/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE r2_key = 'private/audio/games/block-code/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 69164 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-move-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 107564 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-turn-left-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 99884 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-turn-right-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 61484 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 147884 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-if-path-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 59564 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-collect-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 76844 WHERE r2_key = 'private/audio/games/block-code/ar/vo-block-function-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE r2_key = 'private/audio/games/block-code/ar/vo-collision-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 245804 WHERE r2_key = 'private/audio/games/block-code/ar/vo-star-optimal-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 255404 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 416684 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 274604 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 217004 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 76844 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 213164 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 193964 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-recount-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 453164 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-explain-answer-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 78764 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-1-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 80684 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-2-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 82604 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-3-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 63404 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-4-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 78764 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-5-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 73004 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-6-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 101804 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-7-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 76844 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-8-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 67244 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-9-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 71084 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-10-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 96044 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-11-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 138284 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-12-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 107564 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-13-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-14-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 117164 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-15-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 96044 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-16-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 111404 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-17-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 130604 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-18-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 101804 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-19-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 86444 WHERE r2_key = 'private/audio/games/count-quantity/ar/vo-count-20-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 182444 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 172844 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 309164 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 205484 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 149804 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 111404 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 145964 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 142124 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 97964 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-hint-1-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 176684 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-hint-2-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 245804 WHERE r2_key = 'private/audio/games/logic-pattern/ar/vo-explain-rule-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 397484 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 186284 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 240044 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 261164 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 228524 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 130604 WHERE r2_key = 'private/audio/games/match-pairs/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE r2_key = 'private/audio/games/memory-flip/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 195884 WHERE r2_key = 'private/audio/games/memory-flip/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 353324 WHERE r2_key = 'private/audio/games/memory-flip/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE r2_key = 'private/audio/games/memory-flip/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE r2_key = 'private/audio/games/memory-flip/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 147884 WHERE r2_key = 'private/audio/games/memory-flip/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 140204 WHERE r2_key = 'private/audio/games/rhythm-tap/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 163244 WHERE r2_key = 'private/audio/games/rhythm-tap/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 324524 WHERE r2_key = 'private/audio/games/rhythm-tap/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 101804 WHERE r2_key = 'private/audio/games/rhythm-tap/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 182444 WHERE r2_key = 'private/audio/games/rhythm-tap/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 107564 WHERE r2_key = 'private/audio/games/rhythm-tap/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 224684 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 236204 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 391724 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 220844 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 193964 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 117164 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 140204 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 163244 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE r2_key = 'private/audio/games/sequence-order/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 197804 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 228524 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 574124 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 167084 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 186284 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 247724 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 249644 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-stage-predict-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 280364 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-stage-experiment-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 207404 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-stage-explain-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 142124 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-trial-recorded-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 211244 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-need-more-trials-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 218924 WHERE r2_key = 'private/audio/games/sim-lab/ar/vo-explain-final-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 232364 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 435884 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 222764 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 230444 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 113324 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 134444 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 149804 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 153644 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 144044 WHERE r2_key = 'private/audio/games/sort-bins/ar/vo-explain-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 241964 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 539564 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 167084 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 205484 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 99884 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 92204 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 172844 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 132524 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 142124 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-hint-older-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 155564 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-hint-newer-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 130604 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-hint-direction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 157484 WHERE r2_key = 'private/audio/games/timeline-map/ar/vo-explain-event-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 117164 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 313004 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 351404 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 128684 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-stroke-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 211244 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-coloring-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 136364 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 236204 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 115244 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 220844 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 161324 WHERE r2_key = 'private/audio/games/trace-color/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 151724 WHERE r2_key = 'private/audio/games/word-build/ar/vo-intro-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 170924 WHERE r2_key = 'private/audio/games/word-build/ar/vo-instruction-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 393644 WHERE r2_key = 'private/audio/games/word-build/ar/vo-instruction-repeat-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 145964 WHERE r2_key = 'private/audio/games/word-build/ar/vo-level-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 222764 WHERE r2_key = 'private/audio/games/word-build/ar/vo-game-complete-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE r2_key = 'private/audio/games/word-build/ar/vo-exit-confirm-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 159404 WHERE r2_key = 'private/audio/games/word-build/ar/vo-correct-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 161324 WHERE r2_key = 'private/audio/games/word-build/ar/vo-retry-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 153644 WHERE r2_key = 'private/audio/games/word-build/ar/vo-hint-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 99884 WHERE r2_key = 'private/audio/games/word-build/ar/vo-word-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 180524 WHERE r2_key = 'private/audio/games/word-build/ar/vo-word-syllables-ar.wav' AND (size_bytes IS NULL OR size_bytes = 0);
