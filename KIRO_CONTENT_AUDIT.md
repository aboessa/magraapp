# Majarra — master content plan

**Generated:** 2026-08-08 00:30 · derived from local D1 plus the on-disk content sources.
**Language + audio dimension added and all media counts re-verified against real files:** 2026-08-08 03:51.

> Full verification evidence, the per-episode and per-page hierarchy, and the exact remaining
> production requirements are in [`KIRO_LAST_REPORT.md`](./KIRO_LAST_REPORT.md). This document is the
> canonical plan; that document is the audit that produced these numbers.

Every row is a real database row. Every status is computed, not asserted: media status comes
from `asset_links` **and a check that the object actually exists in R2 or on disk**, editorial status
from whether a script or page text actually exists, language status from whether body text exists in
that language, implementation status from whether a game is programmed, review status from
`content_reviews`.

> **Mazen & Thaaloub is not Majarra content.** It was supplied as external material for testing
> upload, R2 storage, asset linking, streaming, playback sessions and player behaviour. It is
> flagged `content_class = test_fixture` in the database and appears only in the
> [Test fixtures](#test-fixtures--platform-validation-content) section at the end. It is excluded
> from every Majarra production count in this document.

## Canonical hierarchy

```
Planet  (9, fixed taxonomy — planets.id is the slug)
  └── Section / Category  (9, one per planet, via series_categories)
        └── Series  (purpose · type · one age track · content_class)
              └── Season  (1 per series; seasons.episode_count is the planned figure)
                    └── Content item  (episode · story · book · game · activity)
                          ├── Learning objective → Skill → Age track → Difficulty → Prerequisites
                          └── Language edition  (ar · en · fr)
                                ├── written text      — does the body content exist in this language?
                                ├── audio/narration   — does an actual audio file exist?
                                └── captions          — does an actual VTT file exist?
```

The **language edition** level is the axis that was missing from earlier versions of this document.
It is the level at which Majarra is least complete, and it must not be collapsed into the item level.

## Canonical language set

The agreed initial launch set is **Arabic · English · French**. Verified state as of 2026-08-08:

| Language | Episode scripts | Story pages | Book manuscripts | Narration / VO | Captions | Verdict |
|---|---:|---:|---:|---:|---:|---|
| **Arabic** `ar` | **117 / 117** | **194 / 194** | **22 / 22** | 0 | 0 | WRITTEN, not produced |
| **English** `en` | 0 / 117 | 0 / 194 | 0 / 22 | 0 | 0 | NOT STARTED |
| **French** `fr` | 0 / 117 | 0 / 194 | 0 / 22 | 0 | 0 | NOT STARTED |

> A `series.languages` or `episodes.dubs` value of `["ar","en"]` is a **declaration, not evidence**.
> Eight archived stories declare `["ar","en"]` and hold zero pages. Language completeness in this
> document is counted only from body text that exists and audio files that exist.
>
> **Every `en` and `fr` cell in this document is currently zero.** Where a per-series table below says
> a language is supported, read it as the metadata column, not as content.

## Status model

| Code | Status | Meaning |
|---|---|---|
| **A** | Editorially complete | Full script, manuscript or content specification exists **and** has been reviewed at least once. |
| **B** | Editorial review required | Full draft exists but no human editor has read it. |
| **C** | Religious review required | Islamic material needing authoritative sourcing and a registered reviewer. |
| **D** | Media production required | Editorial content complete; video, audio or artwork still to be produced. |
| **E** | Implementation required | Game designed and specified but not programmed. |
| **F** | Blocked | A genuine external decision or source is needed. |
| **T** | Translation required | Arabic content exists; this language edition does not. Applies to **every** `en` and `fr` edition of every item. |

> Note on A vs B: status **A** requires a review, and **no review has been signed anywhere** — all 35
> `content_reviews` rows are `pending`. Read A in the per-series tables below as *"editorial artefact
> complete"*; no item in this document has a completed human review.

Media status and implementation status are reported per item alongside the editorial status,
because an item is normally in more than one of these states at once: an episode can be
editorially complete (A) and still need video (D).

---

# Majarra production content

---

## أبجد · Language  `abjad`

Section `category-language` · series 2 · content items 24 · sources `docs/content/planets/01-abjad/`

### لونا تكتشف الكلمات · `luna-discovers-words`

`continuous` · ages 3–5 · track `preschool` · `limited_2d` · `family` · status `draft`

**Purpose.** تعلم صوتي بصري للكلمات العربية مع لونا.

Season 1 · planned units 6 · registered items 11 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | الصورة والشيء | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `lang.vocab.match_word_image` |
| 2 | استمع وابحث | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `lang.vocab.match_word_image` |
| 3 | أول حرف | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.phonics.first_sound` |
| 4 | حروف اسمي | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.letters.trace_form` |
| 5 | كلمات من بيتي | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.vocab.name_objects` |
| 6 | أسمّي ما أرى | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.vocab.name_objects` |
| — | حروفي العربية | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | كلماتي الأولى | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | استمع وابحث | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.vocab.match_word_image` |
| — | تتبع الحروف | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.letters.trace_form` |
| — | طابق الصورة | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.vocab.match_word_image` |

### ابني كلمة · `abni-kalima`

`continuous` · ages 6–8 · track `kids` · `limited_2d` · `family` · status `draft` · **authored in this pass**

**Purpose.** رَيّان يعمل في ورشة الكلمات، ويبني في كل حلقة درجة واحدة على السلّم بين معرفة أصوات الحروف وقراءة ثلاث جمل بفهم وسلاسة.

Season 1 · planned units 6 · registered items 13 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | مَقطعان وكلمة | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.syllable.blend` |
| 2 | أبني كلمة بحروفي | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.word.build` |
| 3 | عائلة الكلمات | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.vocab.word_family` |
| 4 | جملة أفهمها | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.sentence.read` |
| 5 | نقطة أم سؤال؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.reading.punctuation` |
| 6 | أقرأ بلا توقّف | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `lang.reading.fluency` |
| — | ورشة الكلمات | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | إيقاع المقاطع | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.syllable.blend` |
| — | ابنِ الكلمة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.word.build` |
| — | الجملة وصورتها | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.sentence.read` |
| — | خبر أم سؤال؟ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.reading.punctuation` |
| — | رتّب المقطع | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.reading.fluency` |
| — | صناديق العائلة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `lang.vocab.word_family` |

---

## أرقام · Numbers  `arqam`

Section `category-numbers` · series 3 · content items 29 · sources `docs/content/planets/02-arqam/`

### عدّ معي · `count-with-me`

`presenter` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft`

**Purpose.** مواقف قصيرة تساعد الطفل على العد والتصنيف.

Season 1 · planned units 5 · registered items 7 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | واحد لكل واحد | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `math.count.one_to_one` |
| 2 | ثلاثة أصدقاء | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `math.count.to_five` |
| 3 | خمس نجوم | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.count.to_five` |
| 4 | أكثر أم أقل؟ | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.compare.more_less` |
| 5 | نمط بسيط | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.pattern.complete` |
| — | نعد بالصور | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | عد وضع | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.count.to_five` |

### مغامرات الأرقام · `adventures-of-numbers`

`continuous` · ages 6–8 · track `kids` · `limited_2d` · `family` · status `draft`

**Purpose.** تخوض نوما وعدّاد مغامرات في العد والأنماط والأشكال.

Season 1 · planned units 6 · registered items 9 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | عدّ النجوم | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `math.count.to_ten` |
| 2 | أكثر أم أقل؟ | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `math.compare.more_less` |
| 3 | جسر الأشكال | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `math.pattern.complete` |
| 4 | نجمع المجموعات | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `math.add.visual_sum` |
| 5 | نطرح ونوزّع | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.subtract.visual` |
| 6 | ما الرقم الناقص؟ | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.pattern.complete` |
| — | كتاب العد | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | متاهة الأرقام | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.pattern.complete` |
| — | مطابقة الأشكال | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.pattern.complete` |

### الأرقام في حياتي · `al-arqam-fi-hayati`

`knowledge` · ages 9–12 · track `junior` · `limited_2d` · `family` · status `draft` · **authored in this pass**

**Purpose.** سلسلة معرفية تجيب في كل حلقة عن سؤال واحد يواجهه الطفل حين يستخدم الأرقام خارج ورقة التمارين: جزء من ماذا؟ بأي وحدة؟ هل الجواب معقول؟ ما يقوله الرسم؟ فرق أم نسبة؟ وكيف أوزّع مقدارًا محدودًا؟

Season 1 · planned units 6 · registered items 13 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | جزء من ماذا؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.fraction.part_whole` |
| 2 | أيّ وحدة أختار؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.measure.unit_choice` |
| 3 | هل الجواب معقول؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.estimate.reasonable` |
| 4 | أقرأ العمود | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.data.read_chart` |
| 5 | فرق أم نسبة؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.ratio.compare` |
| 6 | ميزانية صغيرة | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `math.money.budget` |
| — | دفتر التحقّق | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | اقرأ الرسم | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.data.read_chart` |
| — | الكسر وكلّه | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.fraction.part_whole` |
| — | صناديق الوحدات | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.measure.unit_choice` |
| — | قدّر ثم تحقّق | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.estimate.reasonable` |
| — | موزّع الميزانية | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.money.budget` |
| — | نسب متكافئة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `math.ratio.compare` |

---

## علوم · Science  `oloom`

Section `category-science` · series 5 · content items 41 · sources `docs/content/planets/03-oloom/`

### ألاحظ وأتعجّب · `alahiz-wa-ataajjab`

`knowledge` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft` · **authored in this pass**

**Purpose.** خمس حلقات قصيرة تدعو طفل الثالثة إلى الخامسة أن يلاحظ شيئًا واحدًا بحواسه، ثم يسمّي الحاسّة التي أخبرته. بصوت راوٍ بلا شخصية، وبيد بالغ حاضرة في كل فعل.

Season 1 · planned units 5 · registered items 11 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | بأيّ حاسّة عرفت؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.observe.senses` |
| 2 | خشن أم ناعم؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.observe.rough_smooth` |
| 3 | عالٍ أم هادئ؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.observe.loud_quiet` |
| 4 | فاتر أم بارد؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.observe.warm_cool` |
| 5 | ينمو أم لا ينمو؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.observe.living_thing` |
| — | عيني وأذني ويدي | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | خشن وناعم | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.observe.rough_smooth` |
| — | عالٍ وهادئ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.observe.loud_quiet` |
| — | فاتر وبارد | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.observe.warm_cool` |
| — | من أخبرك؟ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.observe.senses` |
| — | ينمو ولا ينمو | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.observe.living_thing` |

### اكتشف جسمك · `discover-your-body`

`knowledge` · ages 6–8 · track `kids` · `stylized_3d` · `family` · status `draft`

**Purpose.** شرح آمن ومبسط لأعضاء الجسم والحواس.

Season 1 · planned units 6 · registered items 8 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | القلب | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.body.organ_function` |
| 2 | الحواس الخمس | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.body.senses` |
| 3 | كيف نتنفس؟ | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.body.breathing` |
| 4 | العظام والحركة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.body.skeleton` |
| 5 | طعامي وطاقتي | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.body.digestion` |
| 6 | نظافتي ووقايتي | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.body.hygiene` |
| — | جسمي المدهش | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | دورة الفراشة | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.observe.living_thing` |

### جرّب في البيت · `try-it-at-home`

`presenter` · ages 6–8 · track `kids` · `live` · `family` · status `draft`

**Purpose.** تجارب منزلية آمنة تقدمها سلمى بمشاركة ولي الأمر.

Season 1 · planned units 6 · registered items 6 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | الماء الذي يمشي | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.observe_predict` |
| 2 | اختبار المغناطيس | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.classify_test` |
| 3 | يطفو أم يغوص؟ | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.test_hypothesis` |
| 4 | بذرة تنمو | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.record_observe` |
| 5 | الظل والضوء | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.change_one_variable` |
| 6 | الهواء الذي لا نراه | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.evidence_claim` |

### مختبر المستقبل · `future-lab`

`knowledge` · ages 9–12 · track `junior` · `stylized_3d` · `family` · status `draft`

**Purpose.** علوم ومشروعات متعددة الخطوات للروّاد.

Season 1 · planned units 6 · registered items 8 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | المركبة الشمسية | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.energy.solar_conversion` |
| 2 | الجسر القوي | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.engineering.structure_shape` |
| 3 | الدائرة الكهربية | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.energy.series_circuit` |
| 4 | البندول | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.null_result` |
| 5 | الروبوت المتوازن | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.physics.center_of_mass` |
| 6 | تجربتي أنا | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.method.design_experiment` |
| — | دليل المركبة الشمسية | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | ابن الدائرة | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.energy.series_circuit` |

### علوم في دقيقة · `science-in-a-minute`

`presenter` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft`

**Purpose.** مفاهيم علمية مركزة بلغة واضحة ومصطلحات مشروحة.

Season 1 · planned units 6 · registered items 8 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | انكسار الضوء | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.physics.refraction` |
| 2 | ضغط الهواء | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `sci.physics.air_pressure` |
| 3 | أطوار القمر | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.space.moon_phases` |
| 4 | من أين الكهرباء؟ | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.energy.conversion` |
| 5 | دورة الماء | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.env.water_cycle` |
| 6 | لماذا ننام؟ | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `sci.health.sleep_function` |
| — | القوى من حولنا | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | دليل علمي | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `sci.method.evidence_claim` |

---

## قيم · Values  `qiyam`

Section `category-values` · series 3 · content items 27 · sources `docs/content/planets/04-qiyam/`

### قيمي الصغيرة · `qiyami-alsaghira`

`anthology` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft` · **authored in this pass**

**Purpose.** أربعة مواقف صغيرة من يوم طفل، في كل موقف لحظة تردّد قصيرة، وسؤال للمشاهد قبل أن يختار الطفل، ثم كلمة واحدة تسمّي ما حدث.

Season 1 · planned units 4 · registered items 9 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | أرجوحة واحدة | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.share.take_turns` |
| 2 | الماء على الورقة | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.truth.say_what_happened` |
| 3 | الرفّ العالي | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.help.ask_and_offer` |
| 4 | البُرعُم | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.care.gentle_hands` |
| — | يدان هادئتان | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | أطلب أو أساعد | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.help.ask_and_offer` |
| — | أيّ يد لأيّ شيء | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.care.gentle_hands` |
| — | دوري يأتي | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.share.take_turns` |
| — | ما الذي حدث؟ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.truth.say_what_happened` |

### حكاية وحكمة · `hekaya-wa-hikma`

`anthology` · ages 6–8 · track `kids` · `motion_story` · `family` · status `draft`

**Purpose.** حكايات مستقلة تربط المواقف اليومية بقيم قابلة للتطبيق.

Season 1 · planned units 6 · registered items 7 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | الحقيبة المفقودة | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `val.honesty.return_found` |
| 2 | مشاركة الألوان | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `val.sharing.with_boundaries` |
| 3 | انتظار الدور | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `val.patience.wait_turn` |
| 4 | مسؤولية النبتة | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `val.responsibility.build_system` |
| 5 | كلمة طيبة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.kindness.initiate_words` |
| 6 | أعتذر | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.apology.repair_four_steps` |
| — | مواقف من اللطف | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |

### مواقف وقرارات · `mawaqif-wa-qararat`

`anthology` · ages 9–12 · track `junior` · `limited_2d` · `family` · status `draft` · **authored in this pass**

**Purpose.** خمس معضلات، لكل طرف فيها ثمن حقيقي، ويُسأل المشاهد ماذا يفعل وما الذي يقبل أن يخسره، ثم يبقى الثمن مدفوعًا إلى النهاية.

Season 1 · planned units 5 · registered items 11 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | ستّة أجهزة | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.fairness.equal_vs_fair` |
| 2 | الرقم الذي كتبته | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.integrity.admit_mistake` |
| 3 | قبل أن أردّ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.empathy.perspective_take` |
| 4 | يوم السبت | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.responsibility.keep_commitment` |
| 5 | صورة في المجموعة | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `val.digital.respect_online` |
| — | دفتر القرارات | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | خطّة لا نيّة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.responsibility.keep_commitment` |
| — | خطوات الإصلاح | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.integrity.admit_mistake` |
| — | قل رأيه كما يقوله | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.empathy.perspective_take` |
| — | متساوٍ أو عادل | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.fairness.equal_vs_fair` |
| — | هل أقولها في وجهه | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `val.digital.respect_online` |

---

## قصص · Stories  `qisas`

Section `category-stories` · series 3 · content items 16 · sources `docs/content/planets/05-qisas/`

### حكاية هادئة · `a-calm-tale`

`anthology` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft`

**Purpose.** قصص قصيرة هادئة بكثافة بصرية وصوتية منخفضة.

Season 1 · planned units 2 · registered items 5 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | بيت الطائر | story | A · Editorially complete | illustration ×8 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 2 | تصبح على خير يا ألعابي | story | A · Editorially complete | illustration ×8 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 3 | القمر ينام | story | A · Editorially complete | illustration ×8 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 4 | أحضان الدفء | story | A · Editorially complete | illustration ×8 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| — | الطائر الصغير ينام | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |

### حكايات قبل النوم · `bedtime-stories`

`anthology` · ages 6–8 · track `kids` · `motion_story` · `family` · status `draft`

**Purpose.** قصص عربية مطمئنة قبل النوم بلا إثارة زائدة.

Season 1 · planned units 8 · registered items 6 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | رحلة النملة | story | A · Editorially complete | illustration ×12 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 2 | سرّ الحدائق | story | A · Editorially complete | illustration ×12 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 3 | صديق جديد | story | A · Editorially complete | illustration ×12 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 4 | ليلة المطر | story | A · Editorially complete | illustration ×12 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 5 | الفانوس القديم | story | A · Editorially complete | illustration ×12 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 6 | نجمة تائهة | story | A · Editorially complete | illustration ×12 required · narration required · cover required | n/a | edu pending · lang pending | `—` |

### قصص من الحياة · `qisas-min-alhayat`

`anthology` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft` · **authored in this pass**

**Purpose.** خمس قصص واقعية عن أشياء تحدث فعلًا لمن في الحادية عشرة: وعد صار ثقيلًا، وخطأ أمام الناس، وصداقة تغيّرت، ومهمّة لا يريدها أحد، وحقيقة تُقال بثمن. تُروى بلا درس في آخرها.

Season 1 · planned units 5 · registered items 5 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 0 | أطول منّي | story | B · Editorial review required | illustration ×20 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 0 | الجمعة الموعودة | story | B · Editorial review required | illustration ×18 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 0 | المفتاح الذي بقي | story | B · Editorial review required | illustration ×16 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 0 | الورقة الزائدة | story | B · Editorial review required | illustration ×18 required · narration required · cover required | n/a | edu pending · lang pending | `—` |
| 0 | تسعة أمتار | story | B · Editorial review required | illustration ×18 required · narration required · cover required | n/a | edu pending · lang pending | `—` |

---

## مهارات · Skills  `maharat`

Section `category-skills` · series 3 · content items 32 · sources `docs/content/planets/06-maharat/`

### يدي تصنع · `yadi-tasnaa`

`presenter` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft` · **authored in this pass**

**Purpose.** مقدّم واحد هادئ يمدّ يديه أمام الطفل، ويصنع شيئًا صغيرًا ببطء، ثم يصمت ليصنعه الطفل بيديه: قبضة بإصبعين، وطلب من فعلين، وجمع بخصيصة واحدة، وإعادة كل شيء إلى بيته، وبناء يحكي عنه.

Season 1 · planned units 5 · registered items 11 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | إصبعان يكفيان | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.motor.pincer_grip` |
| 2 | أوّلًا ثمّ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.sequence.two_steps` |
| 3 | كل شيء مع مثله | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.order.sort_one_attribute` |
| 4 | لكل شيء بيت | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.self.tidy_routine` |
| 5 | صنعتُ وأحكي | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.create.build_and_describe` |
| — | يدي الصغيرة | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | أوّلًا ثمّ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.sequence.two_steps` |
| — | خشب وقماش | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.order.sort_one_attribute` |
| — | كيف بنيتُ البرج | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.create.build_and_describe` |
| — | لكل شيء بيت | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.self.tidy_routine` |
| — | من المشبك إلى السلّة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.motor.pincer_grip` |

### أفكّر خطوة خطوة · `ufakkir-khutwa-khutwa`

`knowledge` · ages 6–8 · track `kids` · `limited_2d` · `family` · status `draft` · **authored in this pass**

**Purpose.** ستّ حلقات تعلّم الطفل أن يقرأ خطوات ويرتّبها ويجد الخطوة الخطأ فيها ويفرد العمل خطوات ويكتب خطّته قبل أن يفعل — بورق وحركة وأشياء من البيت، بلا جهاز وبلا أي رمز برمجي.

Season 1 · planned units 6 · registered items 13 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | الأمر كما هو | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.follow_instructions` |
| 2 | بدّلْ خطوتين | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.order_matters` |
| 3 | أين الخطوة الخطأ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.find_the_error` |
| 4 | افردها خطوات | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.break_into_steps` |
| 5 | مرّة أخرى، ثم أخرى | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.repeat_pattern` |
| 6 | الخطّة أوّلًا | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.plan_before_doing` |
| — | يوم تبادلت الخطوات | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | الخطوة الخطأ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.find_the_error` |
| — | ترتيب ونتيجة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.order_matters` |
| — | خطّة ثم مقارنة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.plan_before_doing` |
| — | كما هو مكتوب | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.follow_instructions` |
| — | ما يعود كما هو | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.repeat_pattern` |
| — | من العمل، وليس منه | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.break_into_steps` |

### روبو يبرمج · `robo-codes`

`continuous` · ages 9–12 · track `junior` · `limited_2d` · `family` · status `draft`

**Purpose.** تحديات برمجة ومنطق يقودها روبو تدريجيًا.

Season 1 · planned units 6 · registered items 8 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | مسار التسلسل | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.sequence` |
| 2 | صحح المسار | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.debug` |
| 3 | كرّر معي | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.loop` |
| 4 | إذا وإلا | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.condition` |
| 5 | وظيفة واحدة تكفي | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.function` |
| 6 | مشروعي الأول | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `skill.ct.compose` |
| — | منطق البرمجة | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | تسلسل الأوامر | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `skill.ct.sequence` |

---

## تاريخ · History  `tarikh`

Section `category-history` · series 2 · content items 18 · sources `docs/content/planets/07-tarikh/`

> **The preschool track is deliberately empty.** `07-tarikh/README.md` records why: a
> four-year-old cannot distinguish "yesterday" from "a thousand years ago", so history at
> that age produces confusion rather than knowledge. What suits that age — concrete old
> objects — already exists as a qisas story. This is a decision, not a gap.

### أشياء لها حكاية · `ashyaa-laha-hikaya`

`knowledge` · ages 6–8 · track `kids` · `limited_2d` · `family` · status `draft` · **authored in this pass**

**Purpose.** خمس حلقات، وفي كل حلقة شيء واحد عادي أقدم من كل من يعرفه الطفل: جرّة ماء، ومصباح زيت، وقلم قصب، وقطعة قماش، وحجر رحى. ننظر إلى الشيء، ونسأل: ماذا يخبرنا؟ وماذا لا يخبرنا؟ بلا تاريخ واحد، وبلا اسم حضارة، وبلا خريطة.

Season 1 · planned units 5 · registered items 11 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | جرّة الماء | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.object.older_than_me` |
| 2 | مصباح الزيت | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.object.made_by_hand` |
| 3 | قلم القصب | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.evidence.object_tells` |
| 4 | قطعة القماش | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.craft.skill_passed_on` |
| 5 | حجر الرحى | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.change.then_and_now` |
| — | ماذا يخبرنا الشيء؟ | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | خطوات النسج | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `hist.craft.skill_passed_on` |
| — | قبل جدّي، أو في زماني | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `hist.object.older_than_me` |
| — | قديمًا والآن | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `hist.change.then_and_now` |
| — | ماذا يخبرنا؟ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `hist.evidence.object_tells` |
| — | يد أو آلة | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `hist.object.made_by_hand` |

### رحلة الحضارات · `journey-of-civilizations`

`knowledge` · ages 9–12 · track `junior` · `stylized_3d` · `family` · status `draft`

**Purpose.** رحلات معرفية موثوقة إلى حضارات ومحطات تاريخية.

Season 1 · planned units 5 · registered items 7 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | هندسة المياه | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `hist.civ.water_engineering` |
| 2 | المرصد | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `hist.civ.observation` |
| 3 | بيت الحكمة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.civ.translation` |
| 4 | طرق التجارة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.civ.trade_geography` |
| 5 | الورق والكتابة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `hist.civ.writing_medium` |
| — | ابتكارات الحضارات | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | خط الحضارات | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `hist.civ.trade_geography` |

---

## العالم حولنا · Our World  `alam`

Section `category-world` · series 3 · content items 29 · sources `docs/content/planets/08-alam/`

### ألوان حولنا · `colors-around-us`

`knowledge` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft`

**Purpose.** اكتشاف الألوان في البيئة المحيطة بأنشطة لمسية بسيطة.

Season 1 · planned units 5 · registered items 7 · poster ✓ · banner ✓

> This series deliberately carries **no comprehension question and no failable mastery
> criterion** — `series-bible-colors-around-us.md` states that this age is not tested and
> that measurement comes from the game pack instead. Their absence is by design.

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | ابحث عن الأصفر | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `world.color.identify_yellow` |
| 2 | صنّف لونين | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `world.color.sort_two` |
| 3 | دائرة ومربع | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.shape.circle_square` |
| 4 | كبير وصغير | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.size.compare` |
| 5 | نمط الألوان | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.pattern.ab_repeat` |
| — | ألواني | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | صنف الألوان | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.color.sort_two` |

### مغامرات المستكشفين · `explorers-adventures`

`continuous` · ages 6–8 · track `kids` · `limited_2d` · `family` · status `draft`

**Purpose.** مغامرات زينة وياسين لاكتشاف العالم وحل المشكلات.

Season 1 · planned units 6 · registered items 9 · poster ✓ · banner ✓

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | دلائل الصور | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `world.reason.combine_clues` |
| 2 | جسر العمل الجماعي | episode | A · Editorially complete | video required · thumbnail ✓ · voiceover required · captions required | n/a | edu pending · lang pending | `world.collab.divide_and_order` |
| 3 | خريطة الحيّ | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.space.map_landmarks` |
| 4 | أصوات الطبيعة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.observe.classify_sounds` |
| 5 | لغز الحديقة | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.reason.correlation_not_cause` |
| 6 | رحلة الماء | episode | A · Editorially complete | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.observe.water_moves` |
| — | نلاحظ الطبيعة | book | A · Editorially complete | illustration required · layout required · cover ✓ | n/a | edu pending · lang pending | `—` |
| — | ذاكرة الحيوانات | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.reason.combine_clues` |
| — | مسار الدلائل | game | A · Editorially complete | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.reason.combine_clues` |

### عالمي أكبر · `aalami-akbar`

`knowledge` · ages 9–12 · track `junior` · `limited_2d` · `family` · status `draft` · **authored in this pass**

**Purpose.** ستّ حلقات تُوسّع خريطة الطفل من بيته إلى عالمه: يقرأ مسافة واتجاهًا، ويفسّر اختلاف الجوّ، ويتبع ماءه وخدمة مدينته وقميصه، ثم يختار فعلًا واحدًا ويقيس أثره. بصوت راوٍ بلا شخصية، وفي عالم مُختلَق معلَن.

Season 1 · planned units 6 · registered items 13 · poster required · banner required

| # | Item | Type | Editorial | Media | Implementation | Review | Objective |
|---:|---|---|---|---|---|---|---|
| 1 | كم؟ وفي أيّ اتجاه؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.map.scale_direction` |
| 2 | لماذا يختلف الجوّ؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.climate.why_differs` |
| 3 | من أين يأتي الماء وإلى أين يذهب؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.water.shared_resource` |
| 4 | خدمة واحدة، نظام كامل | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.city.services_system` |
| 5 | من أين جاء قميصي؟ | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.trade.where_things_come_from` |
| 6 | فعل واحد، وأثر يُقاس | episode | B · Editorial review required | video required · thumbnail required · voiceover required · captions required | n/a | edu pending · lang pending | `world.responsibility.local_action` |
| — | أطلس زَنْبَقان — دفتر قارئ | book | B · Editorial review required | illustration required · layout required · cover required | n/a | edu pending · lang pending | `—` |
| — | الشمس والماء | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.climate.why_differs` |
| — | رحلة الماء | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.water.shared_resource` |
| — | فعلي وأثره | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.responsibility.local_action` |
| — | مدخل أم مخرَج؟ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.city.services_system` |
| — | مسافة واتجاه | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.map.scale_direction` |
| — | من أين جاء؟ | game | B · Editorial review required | game art required · voice prompts required | E · Implementation required | edu pending · lang pending | `world.trade.where_things_come_from` |

---

## الإيمان والآداب · Faith & Manners  `islamic`

Section `category-faith` · series 14 · content items 0 · sources `docs/content/planets/09-islamic/`

> **The whole planet is Status C by design.** `09-islamic/series-shells.md` is explicitly
> structure and not content: every unit title in the source is `<pending_sharia_review>`, and
> the document records that even choosing which surah or dhikr appears is itself a religious
> decision. No unit text has been authored and none should be until a registered reviewer
> scopes and approves the sourcing. **RELIGIOUS SOURCE/REVIEW REQUIRED.**
>
> Structure *was* registered, which that same document recommends: the four declared but
> unregistered series, and the split of the merged preschool series into its three planned
> parts. Registering structure needs no approval; omitting it hides the plan from reporting.

### نور قلبي · `noor-qalbi`

`knowledge` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft`

**Purpose.** وحدات قرآن صوتية وبصرية بمعنى واحد مناسب للبراعـم، ولا تنشر قبل الاعتماد الشرعي.

Season 1 · planned units 4 · registered items 0 · poster ✓ · banner required

_No content items registered. 4 units are planned._

### أذكاري الأولى · `preschool-adhkar-first`

`anthology` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** بطاقة صوتية — audio_card. بلا قياس. 6 وحدة مخطَّطة. لا يوجد نصّ — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 6 · registered items 0 · poster required · banner required

_No content items registered. 6 units are planned._

### آدابي الجميلة · `preschool-manners-beautiful`

`anthology` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** وحدة قصصية — story_unit. سؤال واحد. 4 وحدة مخطَّطة. لا يوجد نصّ — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 4 · registered items 0 · poster required · banner required

_No content items registered. 4 units are planned._

### أتهيأ لصلاتي · `preschool-prepare-for-prayer`

`anthology` · ages 3–5 · track `preschool` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** وحدة بصرية — illustrated_unit. بلا قياس. 2 وحدة مخطَّطة. لا يوجد نصّ — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 2 · registered items 0 · poster required · banner required

_No content items registered. 2 units are planned._

### أذكاري اليومية · `daily-adhkar-kids`

`anthology` · ages 6–8 · track `kids` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** هيكل سلسلة مخطَّطة من 8 وحدة. لا يوجد نصّ. العناوين والمحتوى موقوفة على المراجعة الشرعية — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 8 · registered items 0 · poster required · banner required

_No content items registered. 8 units are planned._

### صلاتي خطوة بخطوة · `prayer-step-by-step`

`knowledge` · ages 6–8 · track `kids` · `limited_2d` · `family` · status `draft`

**Purpose.** وحدات بصرية متدرجة لأصول الصلاة المتفق عليها.

Season 1 · planned units 4 · registered items 0 · poster ✓ · banner required

_No content items registered. 4 units are planned._

### من هدي النبي · `prophetic-guidance-kids`

`anthology` · ages 6–8 · track `kids` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** هيكل سلسلة مخطَّطة من 4 وحدة. لا يوجد نصّ. العناوين والمحتوى موقوفة على المراجعة الشرعية — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 4 · registered items 0 · poster required · banner required

_No content items registered. 4 units are planned._

### قصص الأنبياء للصغار · `prophets-stories-kids`

`anthology` · ages 6–8 · track `kids` · `motion_story` · `family` · status `draft`

**Purpose.** سرد موثق بالمكان والأشياء وآثار الأحداث من دون تجسيد الأنبياء أو الغيب.

Season 1 · planned units 4 · registered items 0 · poster ✓ · banner required

_No content items registered. 4 units are planned._

### كنوز القرآن · `quran-treasures`

`knowledge` · ages 6–8 · track `kids` · `motion_story` · `family` · status `draft`

**Purpose.** معانٍ ميسرة موثقة وأنشطة فهم قصيرة، مع نص رسمي ومراجعة مستقلة.

Season 1 · planned units 6 · registered items 0 · poster ✓ · banner required

_No content items registered. 6 units are planned._

### هويتي وأخلاقي · `identity-ethics-junior`

`anthology` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** هيكل سلسلة مخطَّطة من 4 وحدة. لا يوجد نصّ. العناوين والمحتوى موقوفة على المراجعة الشرعية — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 4 · registered items 0 · poster required · banner required

_No content items registered. 4 units are planned._

### في رحاب القرآن · `quran-understanding-junior`

`knowledge` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft`

**Purpose.** سياق ومفردات ومعانٍ ميسرة موثقة للقراءة المستقلة.

Season 1 · planned units 6 · registered items 0 · poster ✓ · banner required

_No content items registered. 6 units are planned._

### مواسم الخير · `seasons-of-goodness`

`anthology` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft` · **structure registered in this pass**

**Purpose.** هيكل سلسلة مخطَّطة من 4 وحدة. لا يوجد نصّ. العناوين والمحتوى موقوفة على المراجعة الشرعية — RELIGIOUS SOURCE/REVIEW REQUIRED.

Season 1 · planned units 4 · registered items 0 · poster required · banner required

_No content items registered. 4 units are planned._

### رحلة في السيرة · `seerah-journey-junior`

`knowledge` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft`

**Purpose.** محطات محققة من السيرة تعرض الأماكن والآثار من دون تجسيد مقدس.

Season 1 · planned units 5 · registered items 0 · poster ✓ · banner required

_No content items registered. 5 units are planned._

### عبادتي بعلم · `worship-with-knowledge`

`knowledge` · ages 9–12 · track `junior` · `motion_story` · `family` · status `draft`

**Purpose.** أصول العبادة المتفق عليها بلغة واضحة ومصدر موثق.

Season 1 · planned units 5 · registered items 0 · poster ✓ · banner required

_No content items registered. 5 units are planned._

---

## Activities and projects

`projects` gained `series_id`, `episode_id` and `estimated_minutes` in migration 0018, so every
activity is now attached to the content it belongs to. Before that it could not be.

| Activity | Ages | Series | Supervision | Steps | Minutes | Editorial | Production required |
|---|---|---|---|---:|---:|---|---|
| مكان الانتظار | 3–5 | qiyami-alsaghira | `required` | 6 | — | B · Editorial review required | cover · step photos |
| علامة على الشريط | 3–5 | alahiz-wa-ataajjab | `required` | 8 | — | B · Editorial review required | cover · step photos |
| من أخبرك؟ | 3–5 | alahiz-wa-ataajjab | `recommended` | 7 | — | B · Editorial review required | cover · step photos |
| سلّة الناعم وسلّة الخشن | 3–5 | alahiz-wa-ataajjab | `required` | 8 | — | B · Editorial review required | cover · step photos |
| صيد الأصوات الهادئة | 3–5 | alahiz-wa-ataajjab | `recommended` | 7 | — | B · Editorial review required | cover · step photos |
| وعاءان وإصبع | 3–5 | alahiz-wa-ataajjab | `required` | 8 | — | B · Editorial review required | cover · step photos |
| أربعة بيوت | 3–5 | yadi-tasnaa | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| سلّة المشابك | 3–5 | yadi-tasnaa | `required` | 8 | — | B · Editorial review required | cover · step photos |
| نشاط اللطف العائلي | 6–8 | hekaya-wa-hikma | `recommended` | 12 | 20 | B · Editorial review required | step photos |
| ملاحظة الطبيعة | 6–8 | explorers-adventures | `required` | 12 | 25 | B · Editorial review required | step photos |
| تجربة آمنة | 6–8 | try-it-at-home | `required` | 12 | 20 | B · Editorial review required | step photos |
| أقدم شيء في بيتنا | 6–8 | ashyaa-laha-hikaya | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| علّمني خطوة واحدة | 6–8 | ashyaa-laha-hikaya | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| بطاقات الأوامر الورقية | 6–8 | ufakkir-khutwa-khutwa | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| خطّتي وما حدث | 6–8 | ufakkir-khutwa-khutwa | `recommended` | 9 | — | B · Editorial review required | cover · step photos |
| شريط الكلمة الورقي | 6–8 | abni-kalima | `required` | 7 | — | B · Editorial review required | cover · step photos |
| دفتر المقطع | 7–8 | abni-kalima | `recommended` | 7 | — | B · Editorial review required | cover · step photos |
| قصة متفرعة | 9–12 | robo-codes | `none` | 14 | 40 | B · Editorial review required | step photos |
| خط زمني للعائلة | 9–12 | journey-of-civilizations | `recommended` | 15 | 50 | B · Editorial review required | step photos |
| جسر ورقي | 9–12 | future-lab | `recommended` | 16 | 45 | B · Editorial review required | step photos |
| فرن شمسي | 9–12 | future-lab | `required` | 16 | 60 | B · Editorial review required | step photos |
| خريطة الغرفة | 9–12 | aalami-akbar | `none` | 7 | — | B · Editorial review required | cover · step photos |
| أسبوع قياس | 9–12 | aalami-akbar | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| وعاءان في الشمس | 9–12 | aalami-akbar | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| مفكرة القياس | 9–12 | al-arqam-fi-hayati | `recommended` | 6 | — | B · Editorial review required | cover · step photos |
| الصفحة التاسعة عشرة | 9–12 | qisas-min-alhayat | `none` | 8 | — | B · Editorial review required | cover · step photos |
| ورقة المعيار البيتية | 9–12 | mawaqif-wa-qararat | `recommended` | 8 | — | B · Editorial review required | cover · step photos |
| بازار الوحدات | 10–12 | al-arqam-fi-hayati | `recommended` | 8 | — | B · Editorial review required | cover · step photos |

---

## Editorial completeness — Majarra production content only

### Arabic (the source language)

| Layer | Complete | Total | Ratio |
|---|---:|---:|---:|
| Episodes with a full scene-by-scene script | 117 | 117 | 100% |
| Stories with complete page-by-page text | 15 | 15 | 100% |
| Story pages with body text | 194 | 194 | 100% |
| Books with a complete manuscript | 22 | 22 | 100% |
| Book pages with `text_ar` | 275 | 275 | 100% |
| Games with a complete design specification | 62 | 62 | 100% |
| Activities with a complete specification | 28 | 28 | 100% |

### English

| Layer | Complete | Total | Ratio |
|---|---:|---:|---:|
| Episodes with a full script | 0 | 117 | 0% |
| Episodes with even a title | 48 | 117 | 41% |
| Stories with page-by-page text | 0 | 15 | 0% |
| Story pages with body text | 0 | 194 | 0% |
| Books with a manuscript | 0 | 22 | 0% |
| Game content packs | 0 | 62 | 0% |
| Activity specifications | 0 | 28 | 0% |

### French

| Layer | Complete | Total | Ratio |
|---|---:|---:|---:|
| Episodes with a full script | 0 | 117 | 0% |
| Episodes with even a title | **0** | 117 | 0% |
| Stories with page-by-page text | 0 | 15 | 0% |
| Story pages with body text | 0 | 194 | 0% |
| Books with a manuscript | 0 | 22 | 0% |
| Game content packs | 0 | 62 | 0% |
| Activity specifications | 0 | 28 | 0% |

### Content that cannot be translated and must be re-authored per language

| Series / pack | Reason | Episodes |
|---|---|---:|
| `abni-kalima` | built on Arabic syllable structure; marked `language_specific` in source | 6 |
| `luna-discovers-words` | Arabic first-sound awareness and the child's own name letters | 6 |
| `word_build` pack `game-wb-abk-ep2` | assembles words from Arabic syllable tiles | 1 pack |

So per non-Arabic language: **105 translations + 12 original episodes**, not 117 translations.

## Audio production — real files only

No audio asset of any kind exists. Verified four ways: `content_assets WHERE kind='audio'` → 0 rows;
`asset_links` has no narration/voiceover role; `story_page_localizations.narration_asset_id` → 0 of 194;
extension scan of all 424 R2 object keys → 0 audio objects, 0 VTT objects.

| Content type | Units | `ar` audio | `en` audio | `fr` audio |
|---|---:|---:|---:|---:|
| Episode voiceovers | 117 | 0 | 0 | 0 |
| Story narration (one file per page) | 194 | 0 | 0 | 0 |
| Book audio | 22 | 0 | 0 | 0 |
| Game voice prompts | 62 | 0 | 0 | 0 |
| Islamic recitation + narration | 66 | 0 | 0 | 0 |
| Caption / VTT tracks | 117 | 0 | 0 | 0 |
| **Total audio files required** | — | **1,708 across all languages** | | |
| **Total audio files produced** | — | **0** | | |

> The only audio files in the repository are `audio/خرجت نهي.wav`, `audio/noha english.wav` and
> `audio/noha france.wav`, copied into the marketing site as `landing/audio/story-nature-page4-{ar,en,fr}.wav`.
> They carry one invented sample sentence that is not a page of any of the 15 stories. They are a
> landing-page language demo and are excluded from every count.
>
> Islamic recitation additionally **cannot use generated voice** — the planet's own constraint table
> forbids it without exception and requires a licensed, reviewed human recording.

## Media and implementation — what is actually produced

Counts below use the strict test: **the file exists as an object in R2 or on disk.** An asset row with
`status='ready'` but no reachable object is counted as not produced.

| Requirement | Outstanding | Note |
|---|---:|---|
| episode video master | 117 | no Majarra episode has a stream asset |
| episode HLS renditions | 234 | 1080 + 480 per episode |
| episode thumbnail 16:9 | 90 | 27 real key images exist; 4 further rows are `planned` with no file |
| episode voiceover `ar` | 117 | no audio asset of any kind exists |
| episode voiceover `en` | 117 | — |
| episode voiceover `fr` | 117 | — |
| episode captions (`ar`+`en`+`fr`) | 351 | no subtitle asset of any kind exists; `captions_ar_url` is a mandatory publish field |
| series poster | 10 | of the 24 non-Islamic Majarra series, 14 have a real poster file |
| series banner | 11 | 13 real banner files exist; `try-it-at-home` banner is `planned` with no file |
| series trailer | 24 | none exists |
| planet cover | 4 | planets with an icon but no cover |
| story cover | 15 | the 8 existing cover files belong to 8 **archived** superseded stories |
| story page illustration | 194 | `story_pages.image_asset_id` is NULL on all 194 |
| story narration audio (`ar`+`en`+`fr`) | 582 | one file per page per language |
| book cover | 9 | 13 of 22 have a real cover file |
| book interior illustration | 275 | one per authored page brief |
| book layout / typeset master | 22 | none exists |
| book audio (`ar`+`en`+`fr`) | 66 | 2 books are typed `audio_story` and cannot function without it |
| game engine implementation | 11 of 12 | only `memory_flip` has code, and it uses emoji placeholders |
| game content packs wired to an engine | 62 | all 62 packs carry `implementation_status: design only - not implemented` |
| game cover art | 48 | 14 of 62 have a real cover file |
| game in-game art | 62 | none exists |
| game voice prompts (`ar`+`en`+`fr`) | 186 | none exists |
| character reference art | 4 | 7 of 11 characters have a reference sheet file |
| character expression / pose sets | 11 | none exists |
| character voice casting | 11 | no casting recorded for any character |
| activity cover art | 21 | 7 of 28 have a real cover file |
| activity printable assets | 6 | 6 activities reference a printable |
| neutral base map `asset-jc-basemap-neutral` | 1 | **blocks all 10 Tarikh episodes and 6 Tarikh game packs** |
| Robo directional asset set | 4 | **blocks the `block_code` engine and all 6 Robo Codes episodes** |
| Zaina & Yasin asset set | 1 | **blocks all 6 Explorers' Adventures episodes** |
| shared SFX / music beds | ~40 | referenced by every script |

## Review gates outstanding

**No review has been signed anywhere. All 35 rows are `pending`.**

| Reviewer role | Pending | Scope |
|---|---:|---|
| `edu` | 10 | 10 series only — 14 of the 24 Majarra series have **no edu row at all** |
| `lang` | 10 | same 10 series — 14 have **no lang row at all** |
| `sharia` | 15 | islamic |

Series with **no review row of any kind** (not merely unreviewed — not queued):
`luna-discovers-words` · `adventures-of-numbers` · `count-with-me` · `discover-your-body` ·
`try-it-at-home` · `future-lab` · `science-in-a-minute` · `hekaya-wa-hikma` · `robo-codes` ·
`journey-of-civilizations` · `colors-around-us` · `explorers-adventures` · `bedtime-stories` ·
`a-calm-tale`

Specialist reviews required and **not contracted**: educational · Arabic language · historical
(10 Tarikh episodes each carry an open fact-check table) · sleep/child-development (10 bedtime
stories require `مراجعة نوم` by their own acceptance criteria) · audio · sharia · independent
Arabic/Quranic proofreader · native English editor · native French editor. **0 of 9 contracted.**

## Content items by status

| Status | Items |
|---|---:|
| B · Editorial review required | 138 |
| A · Editorial artefact complete | 106 |
| C · Religious review required | 66 |
| E · Implementation required | 62 |
| **T · Translation required (`en`)** | **all 244 Majarra items** |
| **T · Translation required (`fr`)** | **all 244 Majarra items** |

## Canonical totals

| Layer | Count |
|---|---:|
| planets | 9 |
| sections (categories) | 9 |
| Majarra series (active, incl. Islamic shells) | 38 |
| — of which non-Islamic with written content | 24 |
| — of which Islamic shells with zero text | 14 |
| Majarra seasons | 38 |
| Majarra episodes | 117 |
| — with a full Arabic script | 117 |
| — with a full English script | 0 |
| — with a full French script | 0 |
| Majarra stories | 15 |
| Majarra story pages | 194 |
| — Arabic page text | 194 |
| — English page text | 0 |
| — French page text | 0 |
| Majarra books | 22 |
| Majarra book pages | 275 |
| — Arabic / English / French manuscripts | 22 / 0 / 0 |
| Majarra comics | **0** |
| Majarra games | 62 |
| — specifications complete | 62 |
| — implemented in software | **0** |
| game engines registered | 17 (12 canonical + 5 legacy) |
| — implemented in Flutter | **1** |
| Majarra activities | 28 |
| Majarra characters | 11 |
| learning objectives | 121 |
| objective age-track rows | 123 |
| Islamic planned units | 66 |
| — with written religious content | **0** |
| content reviews pending | 35 |
| content reviews signed | **0** |
| **audio assets of any language** | **0** |
| **caption / VTT assets** | **0** |
| **episode video masters (Majarra)** | **0** |
| image assets with a real file in R2 | 229 |
| TEST FIXTURE series | 1 |
| TEST FIXTURE episodes | 14 |
| archived (superseded) series | 1 |
| archived stories | 8 |
| archived episodes | 2 |

### Discrepancy to resolve

`docs/content/planets/09-islamic/README.md` and `series-shells.md` both headline **57** planned Islamic
units, but the per-series tables in the same file sum to **66** (preschool 16 + kids 26 + junior 24),
and D1 `seasons.episode_count` also gives **66**. This document uses **66**. Either correct the
`docs/` headline or document which 9 units were removed from the plan.

Open questions recorded by the authoring passes: **106**. Fact checks recorded: **62**. Both are stored per series in the `_manifest-*.json` sources.

---

# Test fixtures / platform validation content

Not Majarra content. Not counted in any production figure above. Kept because the videos are
the only real media in the system and are needed to exercise upload, R2 storage, asset linking,
streaming, playback sessions, player behaviour and private-media CDN handling.

Flagged in the database as `series.content_class = 'test_fixture'` (migration 0018), so it can
be excluded from production reporting and from a public release with a single predicate rather
than a naming convention.

## مازن وثعلوب · `mazen-wa-thaaloub`

`continuous` · ages 9–12 · planet `abjad` · status `published` · **`content_class = test_fixture`**

**Origin.** External material supplied for platform testing only. Arabic orthography lessons.
Not a Majarra original, not editorially produced by Majarra, and not to be presented as
Majarra Original.

**Deliberately NOT completed:** no scripts, no learning objectives, no parent guides, no
comprehension questions, no thumbnails, no poster, no banner. No production resource should be
spent on it.

| # | Item | Type | Video | Purpose |
|---:|---|---|---|---|
| 1 | الهمزة المتوسطة المكسورة | episode | real video ✓ | platform test fixture |
| 2 | الحركة والسكون | episode | real video ✓ | platform test fixture |
| 3 | الهمزة المتوسطة على الواو | episode | real video ✓ | platform test fixture |
| 4 | الهمزة وال التعريف | episode | real video ✓ | platform test fixture |
| 5 | إهمال نقطتي التاء المربوطة | episode | real video ✓ | platform test fixture |
| 6 | جعل التاء المربوطة تاءً مفتوحة | episode | real video ✓ | platform test fixture |
| 7 | جعل التنوين نوانًا | episode | real video ✓ | platform test fixture |
| 8 | كتابة الهمزة على ألف في آخر الكلمة | episode | real video ✓ | platform test fixture |
| 9 | كتابة الهمزة على ألف في وسط الكلمة | episode | real video ✓ | platform test fixture |
| 10 | كتابة الهمزة على واو في آخر الكلمة | episode | real video ✓ | platform test fixture |
| 11 | نسيان سنتي الصاد والضاد | episode | real video ✓ | platform test fixture |
| 12 | نقطتا الألف المقصورة اللينة | episode | real video ✓ | platform test fixture |
| 13 | نقطتي الياء المتطرفة | episode | real video ✓ | platform test fixture |
| 14 | نقطتي الهاء المتطرفة | episode | real video ✓ | platform test fixture |

