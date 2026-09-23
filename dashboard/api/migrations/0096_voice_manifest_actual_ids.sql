-- ‏0096 — يُصلح مراجع `voice_manifest` التي صارت تشير إلى أصول غير موجودة.
--
-- ## العطل، وكيف وقع
--
-- ‏`0088` يُدرج 150 أصلًا صوتيًّا بمعرّفات `asset-games-*`، و`0089` يكتب
-- `games.content_pack.voice_manifest` مشيرًا إلى تلك المعرّفات. والزوج صحيح معًا
-- على قاعدةٍ تُبنى من الصفر.
--
-- لكن الإنتاج كان يحمل **نفس 150 ملفًا** مُسجَّلة سابقًا بمعرّفات `asset-vo-*`
-- (106 منها) — و`content_assets` فيه قيود تفرُّد على `r2_key`/`expected_path`
-- (ثلاثة `sqlite_autoindex`). فإدراجات `0088` بـ`INSERT OR IGNORE` **تُخطَّت
-- بصمت** عند تطبيقه على الإنتاج في 2026-09-23، ثم كتب `0089` مراجعَ إلى معرّفات
-- لم تُنشأ.
--
-- والمقيس بعد التطبيق: `asset-games-block-code-vo-intro` و
-- `asset-games-sim-lab-vo-intro` **غير موجودين**، أي أن حلّ صوت اللعبة يُرجع
-- لا شيء — **ألعابٌ تُشغَّل بلا سرد**.
--
-- وهذا عطلٌ أحدثه تطبيق `0089` على بيئةٍ لم تكن كالتي بُني عليها. و`OR IGNORE`
-- هو ما جعله صامتًا: منع الفشل ومنع معه الخبر.
--
-- ## الإصلاح: المرجع يتبع الملف
--
-- لكل معرّف يذكره `0088`، يُقرأ `r2_key` منه، ويُبحث عن المعرّف الذي يحمله
-- الإنتاج **لنفس المفتاح**، ثم يُستبدل المرجع في `content_pack`. فالملف هو
-- الثابت، والمعرّف اصطلاح — وهو نفس الدرس الذي فرض على `0094` أن يكون مفتاحه
-- `r2_key`.
--
-- والاستبدال على النصّ **بين علامتَي اقتباس** (`"id"`) لا على النصّ الحرّ: معرّفٌ
-- قد يكون بادئةً لآخر (`…-vo-block-move` و`…-vo-block-move-fast`)، والاقتباس
-- يمنع استبدالًا جزئيًّا.
--
-- والحرس `instr(content_pack, '"id"') > 0` لا `LIKE`: نسخةٌ أولى استعملت
-- `LIKE '%"id"%'` فرفضها D1 بـ`LIKE or GLOB pattern too complex`. و`instr`
-- اختبارُ احتواءٍ دقيق بلا محارف بدل ولا هروب — وهو المطلوب فعلًا. ويجعل كل بيانٍ
-- لا-عملية إن لم يوجد المرجع، فالإعادة آمنة ولا تلمس `updated_at` بلا سبب.
--
-- ## القبول
--
-- الفحص الذي يُثبت الإصلاح: **كل معرّف يُذكر في أي `voice_manifest` موجود في
-- `content_assets`**. وهو استعلامٌ مكتوب في `LEDGER.md` ليُعاد تشغيله.

UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-intro"', '"asset-vo-block-code-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-instruction"', '"asset-vo-block-code-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-instruction-repeat"', '"asset-vo-block-code-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-level-complete"', '"asset-vo-block-code-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-game-complete"', '"asset-vo-block-code-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-exit-confirm"', '"asset-vo-block-code-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-correct"', '"asset-vo-block-code-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-retry"', '"asset-vo-block-code-vo-retry-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-retry"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-hint"', '"asset-vo-block-code-vo-hint-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-hint"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-block-move"', '"asset-vo-block-code-vo-block-move-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-block-move"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-block-turn-left"', '"asset-vo-block-code-vo-block-turn-left-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-block-turn-left"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-block-turn-right"', '"asset-vo-block-code-vo-block-turn-right-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-block-turn-right"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-block-collect"', '"asset-vo-block-code-vo-block-collect-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-block-collect"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-block-function"', '"asset-vo-block-code-vo-block-function-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-block-function"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-collision"', '"asset-vo-block-code-vo-collision-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-collision"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-block-code-vo-star-optimal"', '"asset-vo-block-code-vo-star-optimal-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-block-code-vo-star-optimal"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-intro"', '"asset-vo-count-quantity-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-instruction"', '"asset-vo-count-quantity-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-instruction-repeat"', '"asset-vo-count-quantity-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-level-complete"', '"asset-vo-count-quantity-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-game-complete"', '"asset-vo-count-quantity-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-exit-confirm"', '"asset-vo-count-quantity-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-correct"', '"asset-vo-count-quantity-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-retry"', '"asset-vo-count-quantity-vo-retry-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-retry"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-hint"', '"asset-vo-count-quantity-vo-hint-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-hint"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-recount"', '"asset-vo-count-quantity-vo-recount-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-recount"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-explain-answer"', '"asset-vo-count-quantity-vo-explain-answer-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-explain-answer"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-1"', '"asset-vo-count-quantity-vo-count-1-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-1"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-2"', '"asset-vo-count-quantity-vo-count-2-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-2"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-3"', '"asset-vo-count-quantity-vo-count-3-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-3"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-4"', '"asset-vo-count-quantity-vo-count-4-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-4"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-5"', '"asset-vo-count-quantity-vo-count-5-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-5"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-6"', '"asset-vo-count-quantity-vo-count-6-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-6"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-7"', '"asset-vo-count-quantity-vo-count-7-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-7"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-8"', '"asset-vo-count-quantity-vo-count-8-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-8"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-9"', '"asset-vo-count-quantity-vo-count-9-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-9"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-10"', '"asset-vo-count-quantity-vo-count-10-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-10"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-11"', '"asset-vo-count-quantity-vo-count-11-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-11"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-12"', '"asset-vo-count-quantity-vo-count-12-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-12"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-13"', '"asset-vo-count-quantity-vo-count-13-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-13"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-14"', '"asset-vo-count-quantity-vo-count-14-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-14"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-15"', '"asset-vo-count-quantity-vo-count-15-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-15"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-16"', '"asset-vo-count-quantity-vo-count-16-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-16"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-17"', '"asset-vo-count-quantity-vo-count-17-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-17"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-18"', '"asset-vo-count-quantity-vo-count-18-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-18"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-19"', '"asset-vo-count-quantity-vo-count-19-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-19"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-count-quantity-vo-count-20"', '"asset-vo-count-quantity-vo-count-20-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-count-quantity-vo-count-20"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-intro"', '"asset-vo-logic-pattern-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-instruction"', '"asset-vo-logic-pattern-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-instruction-repeat"', '"asset-vo-logic-pattern-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-level-complete"', '"asset-vo-logic-pattern-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-game-complete"', '"asset-vo-logic-pattern-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-exit-confirm"', '"asset-vo-logic-pattern-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-logic-pattern-vo-correct"', '"asset-vo-logic-pattern-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-logic-pattern-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-intro"', '"asset-vo-match-pairs-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-instruction"', '"asset-vo-match-pairs-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-instruction-repeat"', '"asset-vo-match-pairs-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-level-complete"', '"asset-vo-match-pairs-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-game-complete"', '"asset-vo-match-pairs-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-exit-confirm"', '"asset-vo-match-pairs-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-correct"', '"asset-vo-match-pairs-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-retry"', '"asset-vo-match-pairs-vo-retry-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-retry"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-match-pairs-vo-hint"', '"asset-vo-match-pairs-vo-hint-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-match-pairs-vo-hint"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-memory-flip-vo-intro"', '"asset-vo-memory-flip-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-memory-flip-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-memory-flip-vo-instruction"', '"asset-vo-memory-flip-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-memory-flip-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-memory-flip-vo-instruction-repeat"', '"asset-vo-memory-flip-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-memory-flip-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-memory-flip-vo-level-complete"', '"asset-vo-memory-flip-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-memory-flip-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-memory-flip-vo-game-complete"', '"asset-vo-memory-flip-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-memory-flip-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-memory-flip-vo-exit-confirm"', '"asset-vo-memory-flip-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-memory-flip-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-rhythm-tap-vo-intro"', '"asset-vo-rhythm-tap-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-rhythm-tap-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-rhythm-tap-vo-instruction"', '"asset-vo-rhythm-tap-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-rhythm-tap-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-rhythm-tap-vo-instruction-repeat"', '"asset-vo-rhythm-tap-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-rhythm-tap-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-rhythm-tap-vo-level-complete"', '"asset-vo-rhythm-tap-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-rhythm-tap-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-rhythm-tap-vo-game-complete"', '"asset-vo-rhythm-tap-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-rhythm-tap-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-rhythm-tap-vo-exit-confirm"', '"asset-vo-rhythm-tap-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-rhythm-tap-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sequence-order-vo-intro"', '"asset-vo-sequence-order-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sequence-order-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sequence-order-vo-level-complete"', '"asset-vo-sequence-order-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sequence-order-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sequence-order-vo-exit-confirm"', '"asset-vo-sequence-order-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sequence-order-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sequence-order-vo-correct"', '"asset-vo-sequence-order-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sequence-order-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sequence-order-vo-retry"', '"asset-vo-sequence-order-vo-retry-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sequence-order-vo-retry"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sequence-order-vo-hint"', '"asset-vo-sequence-order-vo-hint-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sequence-order-vo-hint"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-intro"', '"asset-vo-sim-lab-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-instruction"', '"asset-vo-sim-lab-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-instruction-repeat"', '"asset-vo-sim-lab-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-level-complete"', '"asset-vo-sim-lab-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-game-complete"', '"asset-vo-sim-lab-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-exit-confirm"', '"asset-vo-sim-lab-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-correct"', '"asset-vo-sim-lab-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-retry"', '"asset-vo-sim-lab-vo-retry-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-retry"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-trial-recorded"', '"asset-vo-sim-lab-vo-trial-recorded-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-trial-recorded"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-need-more-trials"', '"asset-vo-sim-lab-vo-need-more-trials-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-need-more-trials"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sim-lab-vo-explain-final"', '"asset-vo-sim-lab-vo-explain-final-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sim-lab-vo-explain-final"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-intro"', '"asset-vo-sort-bins-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-instruction"', '"asset-vo-sort-bins-vo-instruction-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-instruction"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-instruction-repeat"', '"asset-vo-sort-bins-vo-instruction-repeat-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-instruction-repeat"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-level-complete"', '"asset-vo-sort-bins-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-game-complete"', '"asset-vo-sort-bins-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-exit-confirm"', '"asset-vo-sort-bins-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-correct"', '"asset-vo-sort-bins-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-sort-bins-vo-retry"', '"asset-vo-sort-bins-vo-retry-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-sort-bins-vo-retry"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-timeline-map-vo-level-complete"', '"asset-vo-timeline-map-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-timeline-map-vo-level-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-timeline-map-vo-game-complete"', '"asset-vo-timeline-map-vo-game-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-timeline-map-vo-game-complete"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-timeline-map-vo-exit-confirm"', '"asset-vo-timeline-map-vo-exit-confirm-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-timeline-map-vo-exit-confirm"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-timeline-map-vo-correct"', '"asset-vo-timeline-map-vo-correct-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-timeline-map-vo-correct"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-trace-color-vo-intro"', '"asset-vo-trace-color-vo-intro-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-trace-color-vo-intro"') > 0;
UPDATE games SET content_pack = REPLACE(content_pack, '"asset-games-trace-color-vo-level-complete"', '"asset-vo-trace-color-vo-level-complete-ar"'), updated_at = datetime('now')
 WHERE instr(content_pack, '"asset-games-trace-color-vo-level-complete"') > 0;
