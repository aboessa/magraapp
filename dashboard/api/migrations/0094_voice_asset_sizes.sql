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
-- ## الشكل
--
-- ‏`UPDATE ... WHERE (size_bytes IS NULL OR size_bytes = 0)` — فالإعادة لا-عملية،
-- ولا تُصفِّر حجمًا صحيحًا ضبطه شيءٌ آخر لاحقًا. ولا `INSERT`: الصفوف من `0088`،
-- وهذا الترحيل يُكمل حقلًا لا يُنشئ محتوًى.

UPDATE content_assets SET size_bytes = 172844 WHERE id = 'asset-games-block-code-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 190124 WHERE id = 'asset-games-block-code-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 618284 WHERE id = 'asset-games-block-code-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 159404 WHERE id = 'asset-games-block-code-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 313004 WHERE id = 'asset-games-block-code-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE id = 'asset-games-block-code-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 103724 WHERE id = 'asset-games-block-code-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 209324 WHERE id = 'asset-games-block-code-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE id = 'asset-games-block-code-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 69164 WHERE id = 'asset-games-block-code-vo-block-move' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 107564 WHERE id = 'asset-games-block-code-vo-block-turn-left' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 99884 WHERE id = 'asset-games-block-code-vo-block-turn-right' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 61484 WHERE id = 'asset-games-block-code-vo-block-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 147884 WHERE id = 'asset-games-block-code-vo-block-if-path' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 59564 WHERE id = 'asset-games-block-code-vo-block-collect' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 76844 WHERE id = 'asset-games-block-code-vo-block-function' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE id = 'asset-games-block-code-vo-collision' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 245804 WHERE id = 'asset-games-block-code-vo-star-optimal' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE id = 'asset-games-count-quantity-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 255404 WHERE id = 'asset-games-count-quantity-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 416684 WHERE id = 'asset-games-count-quantity-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE id = 'asset-games-count-quantity-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 274604 WHERE id = 'asset-games-count-quantity-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 217004 WHERE id = 'asset-games-count-quantity-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 76844 WHERE id = 'asset-games-count-quantity-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE id = 'asset-games-count-quantity-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 213164 WHERE id = 'asset-games-count-quantity-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 193964 WHERE id = 'asset-games-count-quantity-vo-recount' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 453164 WHERE id = 'asset-games-count-quantity-vo-explain-answer' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 78764 WHERE id = 'asset-games-count-quantity-vo-count-1' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 80684 WHERE id = 'asset-games-count-quantity-vo-count-2' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 82604 WHERE id = 'asset-games-count-quantity-vo-count-3' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 63404 WHERE id = 'asset-games-count-quantity-vo-count-4' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 78764 WHERE id = 'asset-games-count-quantity-vo-count-5' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 73004 WHERE id = 'asset-games-count-quantity-vo-count-6' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 101804 WHERE id = 'asset-games-count-quantity-vo-count-7' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 76844 WHERE id = 'asset-games-count-quantity-vo-count-8' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 67244 WHERE id = 'asset-games-count-quantity-vo-count-9' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 71084 WHERE id = 'asset-games-count-quantity-vo-count-10' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 96044 WHERE id = 'asset-games-count-quantity-vo-count-11' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 138284 WHERE id = 'asset-games-count-quantity-vo-count-12' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 107564 WHERE id = 'asset-games-count-quantity-vo-count-13' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE id = 'asset-games-count-quantity-vo-count-14' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 117164 WHERE id = 'asset-games-count-quantity-vo-count-15' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 96044 WHERE id = 'asset-games-count-quantity-vo-count-16' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 111404 WHERE id = 'asset-games-count-quantity-vo-count-17' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 130604 WHERE id = 'asset-games-count-quantity-vo-count-18' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 101804 WHERE id = 'asset-games-count-quantity-vo-count-19' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 86444 WHERE id = 'asset-games-count-quantity-vo-count-20' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 182444 WHERE id = 'asset-games-logic-pattern-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 172844 WHERE id = 'asset-games-logic-pattern-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 309164 WHERE id = 'asset-games-logic-pattern-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 205484 WHERE id = 'asset-games-logic-pattern-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 149804 WHERE id = 'asset-games-logic-pattern-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 111404 WHERE id = 'asset-games-logic-pattern-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 145964 WHERE id = 'asset-games-logic-pattern-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 142124 WHERE id = 'asset-games-logic-pattern-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 97964 WHERE id = 'asset-games-logic-pattern-vo-hint-1' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 176684 WHERE id = 'asset-games-logic-pattern-vo-hint-2' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 245804 WHERE id = 'asset-games-logic-pattern-vo-explain-rule' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE id = 'asset-games-match-pairs-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE id = 'asset-games-match-pairs-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 397484 WHERE id = 'asset-games-match-pairs-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 186284 WHERE id = 'asset-games-match-pairs-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 240044 WHERE id = 'asset-games-match-pairs-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 261164 WHERE id = 'asset-games-match-pairs-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE id = 'asset-games-match-pairs-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 228524 WHERE id = 'asset-games-match-pairs-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 130604 WHERE id = 'asset-games-match-pairs-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE id = 'asset-games-memory-flip-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 195884 WHERE id = 'asset-games-memory-flip-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 353324 WHERE id = 'asset-games-memory-flip-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 192044 WHERE id = 'asset-games-memory-flip-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE id = 'asset-games-memory-flip-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 147884 WHERE id = 'asset-games-memory-flip-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 140204 WHERE id = 'asset-games-rhythm-tap-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 163244 WHERE id = 'asset-games-rhythm-tap-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 324524 WHERE id = 'asset-games-rhythm-tap-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 101804 WHERE id = 'asset-games-rhythm-tap-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 182444 WHERE id = 'asset-games-rhythm-tap-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 107564 WHERE id = 'asset-games-rhythm-tap-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 224684 WHERE id = 'asset-games-sequence-order-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 236204 WHERE id = 'asset-games-sequence-order-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 391724 WHERE id = 'asset-games-sequence-order-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 220844 WHERE id = 'asset-games-sequence-order-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 193964 WHERE id = 'asset-games-sequence-order-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 117164 WHERE id = 'asset-games-sequence-order-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 140204 WHERE id = 'asset-games-sequence-order-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 163244 WHERE id = 'asset-games-sequence-order-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE id = 'asset-games-sequence-order-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 197804 WHERE id = 'asset-games-sim-lab-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 228524 WHERE id = 'asset-games-sim-lab-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 574124 WHERE id = 'asset-games-sim-lab-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 167084 WHERE id = 'asset-games-sim-lab-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE id = 'asset-games-sim-lab-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 186284 WHERE id = 'asset-games-sim-lab-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE id = 'asset-games-sim-lab-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 184364 WHERE id = 'asset-games-sim-lab-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 247724 WHERE id = 'asset-games-sim-lab-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 249644 WHERE id = 'asset-games-sim-lab-vo-stage-predict' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 280364 WHERE id = 'asset-games-sim-lab-vo-stage-experiment' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 207404 WHERE id = 'asset-games-sim-lab-vo-stage-explain' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 142124 WHERE id = 'asset-games-sim-lab-vo-trial-recorded' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 211244 WHERE id = 'asset-games-sim-lab-vo-need-more-trials' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 218924 WHERE id = 'asset-games-sim-lab-vo-explain-final' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 232364 WHERE id = 'asset-games-sort-bins-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 165164 WHERE id = 'asset-games-sort-bins-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 435884 WHERE id = 'asset-games-sort-bins-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 222764 WHERE id = 'asset-games-sort-bins-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 230444 WHERE id = 'asset-games-sort-bins-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 113324 WHERE id = 'asset-games-sort-bins-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 134444 WHERE id = 'asset-games-sort-bins-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 149804 WHERE id = 'asset-games-sort-bins-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 153644 WHERE id = 'asset-games-sort-bins-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 144044 WHERE id = 'asset-games-sort-bins-vo-explain-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE id = 'asset-games-timeline-map-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 241964 WHERE id = 'asset-games-timeline-map-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 539564 WHERE id = 'asset-games-timeline-map-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 167084 WHERE id = 'asset-games-timeline-map-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 205484 WHERE id = 'asset-games-timeline-map-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 99884 WHERE id = 'asset-games-timeline-map-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 92204 WHERE id = 'asset-games-timeline-map-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 172844 WHERE id = 'asset-games-timeline-map-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 132524 WHERE id = 'asset-games-timeline-map-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 142124 WHERE id = 'asset-games-timeline-map-vo-hint-older' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 155564 WHERE id = 'asset-games-timeline-map-vo-hint-newer' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 130604 WHERE id = 'asset-games-timeline-map-vo-hint-direction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 157484 WHERE id = 'asset-games-timeline-map-vo-explain-event' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 117164 WHERE id = 'asset-games-trace-color-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 313004 WHERE id = 'asset-games-trace-color-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 351404 WHERE id = 'asset-games-trace-color-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 128684 WHERE id = 'asset-games-trace-color-vo-stroke-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 211244 WHERE id = 'asset-games-trace-color-vo-coloring-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 136364 WHERE id = 'asset-games-trace-color-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 199724 WHERE id = 'asset-games-trace-color-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 236204 WHERE id = 'asset-games-trace-color-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 115244 WHERE id = 'asset-games-trace-color-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 220844 WHERE id = 'asset-games-trace-color-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 161324 WHERE id = 'asset-games-trace-color-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 151724 WHERE id = 'asset-games-word-build-vo-intro' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 170924 WHERE id = 'asset-games-word-build-vo-instruction' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 393644 WHERE id = 'asset-games-word-build-vo-instruction-repeat' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 145964 WHERE id = 'asset-games-word-build-vo-level-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 222764 WHERE id = 'asset-games-word-build-vo-game-complete' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 124844 WHERE id = 'asset-games-word-build-vo-exit-confirm' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 159404 WHERE id = 'asset-games-word-build-vo-correct' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 161324 WHERE id = 'asset-games-word-build-vo-retry' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 153644 WHERE id = 'asset-games-word-build-vo-hint' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 99884 WHERE id = 'asset-games-word-build-vo-word' AND (size_bytes IS NULL OR size_bytes = 0);
UPDATE content_assets SET size_bytes = 180524 WHERE id = 'asset-games-word-build-vo-word-syllables' AND (size_bytes IS NULL OR size_bytes = 0);
