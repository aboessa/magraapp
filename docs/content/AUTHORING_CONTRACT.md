# Majarra content authoring contract — slate expansion pass

Read this fully before writing anything. It is derived from the existing Majarra content
system, not invented: every rule below matches how `docs/content/planets/**` already works
and what the D1 schema accepts.

## 1. What you produce

For each series assigned to you:

1. `docs/content/planets/<NN-planet>/<series-slug>/ep-<NN>-<slug>.md` — one file per episode,
   in the exact format of §4.
2. `docs/content/planets/<NN-planet>/series-bible-<short>.md` — one series bible, §5.
3. Append your series to `docs/content/planets/<NN-planet>/README.md` using the same table
   format already present in that file.
4. `docs/content/planets/<NN-planet>/_manifest-<series-slug>.json` — machine-readable, §6.
   This is what gets loaded into the database, so it must be exact.

Write Arabic content in Modern Standard Arabic suitable for the target age. Use the same
tone as the existing scripts: short sentences, concrete nouns, no idioms, no talking down.

## 2. Hard constraints — violating any of these makes the work unusable

**Database CHECK constraints.** Only these values exist:

| field | allowed values |
|---|---|
| `reading_level` | `pre_reader` · `emerging` · `independent` |
| `interaction_mode` | `tap` · `guided` · `mixed` · `independent` |
| `supervision_level` | `none` · `recommended` · `required` |
| `difficulty` | `easy` · `medium` · `hard` |
| `type` (series) | `continuous` · `anthology` · `knowledge` · `presenter` · `standalone` |
| `production_level` | `motion_story` · `limited_2d` · `full_2d` · `live` · `stylized_3d` |
| `price_tier` | `free` · `family` · `family_plus` |
| `status` | always `draft` for everything you write |
| `track_id` | `preschool` (3–5) · `kids` (6–8) · `junior` (9–12) |

Do **not** use `fluent`, `interactive`, `passive` or `optional`. Existing scripts use those
and they are a known defect being corrected; do not copy it.

**Age bands must not straddle tracks.** `age_min`/`age_max` must sit inside one band:
3–5, 6–8 or 9–12. `4-5` and `7-8` are fine; `5-6` and `8-9` are not.

**Duration targets by track.** preschool 150–210s · kids 240–330s · junior 360–480s.
`science-in-a-minute` style short-form is 120s but only for an existing presenter series.

**One learning objective per episode.** Not two. The objective code format is
`<domain>.<topic>.<specific>` in lowercase ASCII, e.g. `lang.phonics.first_sound`,
`math.compare.more_less`, `sci.method.evidence_claim`, `skill.ct.loop`,
`world.observe.classify_sounds`, `val.apology.repair_four_steps`, `hist.civ.trade_geography`.
Domains in use: `lang` `math` `sci` `world` `val` `skill` `hist`. Reuse an existing code when
the objective is genuinely the same; only invent a code for a genuinely new objective.
An objective must be observable and measurable. "يحب القراءة" is not an objective.

**Safety.** Any episode that asks a child to touch, move, build, taste, heat, cut or go
outside must carry `safety_notes` naming the specific prohibited action, in the style of the
existing scripts: what is safe, then explicit prohibitions. If an activity cannot be made
safe for the age, change the activity.

**No religious content.** Do not write Quran text, hadith, rulings, prophetic biography or
worship instruction. That is the `islamic` planet and it is out of scope for you. If a value
or manners topic edges toward it, keep it to universal ethics with no religious sourcing.

**No invented facts.** For history and science, only state what is uncontroversially
established and age-appropriate. Do not invent dates, names, quantities, discoveries or
attributions. If a fact is needed but you are not certain of it, restructure the episode so
it is not needed, or write `<FACT CHECK REQUIRED: …>` inline and note it in the manifest's
`open_questions`.

**No media claims.** You are writing editorial content only. Never state that video, audio,
narration, artwork, a poster or a thumbnail exists. Every episode's manifest must list its
required media in `production_required`.

## 3. Editorial design rules taken from the existing series bibles

- **Knowledge series carry no recurring character** — this is deliberate and documented in
  `series-bible-discover-body.md` ("why a `knowledge` series has no character"). Do not add a
  mascot to a `knowledge` series.
- **`presenter` series have exactly one presenter** who addresses the child directly.
- **`continuous` series are character-driven** and need a character bible.
- **`anthology` series** are self-contained per episode with a shared frame, not a cast.
- **Meaning before symbol.** Teach the concept, then the notation. `count-with-me` ep 3
  introduces the numeral only after two episodes of counting.
- **One new idea per episode.** Vocabulary is introduced in context and not quizzed.
- **Silence is content.** Preschool scripts use explicit `صمت 4 ثوان` beats for the child to
  act. Include them.
- **Visual prohibitions matter.** The body series bans white skeletons and skulls because
  they read as death to a child. Think about what your subject's equivalent is and write a
  "قاعدة بصرية حاكمة" (governing visual rule) table where one is needed.
- **Failure is never framed as the child's deficiency.** Rework, retry, understand.

## 4. Episode file format

Match this exactly. The metadata card is parsed mechanically.

```markdown
# <سلسلة> — الحلقة <N>: <العنوان>

## بطاقة الحلقة

| الحقل | القيمة |
|---|---|
| `series_id` | `<series-slug>` |
| `episode_number` | <N> |
| `title_ar` | <العنوان> |
| `title_en` | <English title> |
| `description_ar` | <سطر واحد يشرح الحلقة> |
| `duration_seconds` | <N> |
| `age_min` / `age_max` | <N> / <N> |
| `reading_level` | `<value>` |
| `interaction_mode` | `<value>` |
| `supervision_level` | `<value>` |
| `difficulty` | `<value>` |
| `is_free` | <0 or 1> |
| `learning_objective_id` | `<code>` |
| `linked_game_id` | `<pack id or ->` |
| `prerequisites` | `["<slug>"]` or `[]` |
| `status` | `draft` |
| `safety_notes` | <النص أو -> |

## السؤال الذي تجيب عنه

> **«<سؤال الطفل بصيغته>»**

## الهدف التعليمي

**هدف واحد:** <الهدف بصيغة قابلة للملاحظة>

المعيار: <معيار قابل للقياس، مثل: يصنّف 6 عناصر في 3 من 4 محاولات>

## المفردات الجديدة

| الكلمة | الشرح المُقدَّم |
|---|---|
| <كلمة> | <شرح بكلمات يعرفها> |

```json
["<كلمة>", "<كلمة>"]
```

## السكربت الكامل

### المشهد 1 — <اسم المشهد> · 0:00–0:15

**اللقطة:** <وصف بصري>

| الوقت | الصوت | النص حرفيًا |
|---|---|---|
| 0:00 | موسيقى | <...> |
| 0:06 | راوٍ | «<النص المنطوق حرفيًا>» |

<repeat scenes until the full duration is covered>

## أسئلة الفهم

```json
[
  {
    "id": "q1",
    "type": "<match_pairs|sort_bins|count_quantity|sequence_order|logic_pattern|choice>",
    "prompt_key": "<series>.ep<N>.q1",
    "prompt_text": "<السؤال>",
    "items": [],
    "correct": []
  }
]
```

## معيار الإتقان

```
<المعيار الكامل: ماذا يفعل الطفل، بأي نسبة نجاح، بأي مساعدة>
```

## دليل ولي الأمر

> **ماذا تعلّم طفلك؟**
> <...>
>
> **الخط الأحمر**
> <ما يجب ألا يفعله الطفل>
>
> **كيف تساعده؟**
> <...>

## النشاط العائلي

> **<العنوان> — <N> دقيقة**
>
> 1. <خطوة>
> 2. <خطوة>
>
> **تنويع للطفل الأكبر:** <...>

## الأصول المطلوبة

| المعرف | النوع | الوصف |
|---|---|---|
| `asset-<series>-ep<N>-video` | فيديو | ماستر الحلقة |
| `asset-<series>-ep<N>-thumb` | صورة | مصغّرة 16:9 |
| `asset-<series>-ep<N>-captions` | ترجمة | VTT |
| `asset-<...>` | صورة | <وصف> |

## ملاحظات الإنتاج

- <ملاحظة تحريرية/إنتاجية>
```

## 5. Series bible format

Sections: الفكرة في جملة · الجمهور والمسار · لماذا هذا النوع · الأسلوب البصري ·
القواعد البصرية الحاكمة (prohibitions) · بنية الحلقة الثابتة · قواعد الحوار · الصوت ·
الشخصيات (only for `continuous`/`presenter`) · الأصول المشتركة · معايير قبول الحلقة.

For a `continuous` or `presenter` series, each character needs: name, role
(`hero`/`side`/`presenter`/`narrator`), age, personality, strengths, a real weakness,
speech style, behavioural rules, relationships, recurring educational function, and a visual
brief. State plainly that no artwork or voice casting exists yet.

## 6. Manifest format

```json
{
  "planet_id": "<abjad|arqam|oloom|qiyam|qisas|maharat|tarikh|alam>",
  "category_id": "<category-language|category-numbers|category-science|category-values|category-stories|category-skills|category-history|category-world>",
  "series": {
    "slug": "<slug>", "title_ar": "...", "title_en": "...", "type": "...",
    "age_min": 0, "age_max": 0, "track": "...", "reading_level": "...",
    "interaction_mode": "...", "supervision_level": "...", "difficulty": "...",
    "production_level": "...", "price_tier": "family", "is_free": 0,
    "description_ar": "...", "learning_goals": ["..."], "languages": ["ar"],
    "purpose": "one paragraph: why this series exists and what gap it closes",
    "safety_notes": "... or null"
  },
  "season": { "season_number": 1, "title_ar": "الموسم الأول", "watch_order": "sequential" },
  "objectives": [
    { "code": "...", "title_ar": "...", "criteria_ar": "...", "skill": "<counting|addition|coding|observation|writing|reading|memory|honesty|null>", "age_min": 0, "age_max": 0 }
  ],
  "episodes": [
    {
      "episode_number": 1, "slug": "<file slug>", "title_ar": "...", "title_en": "...",
      "description_ar": "...", "duration_seconds": 0, "age_min": 0, "age_max": 0,
      "reading_level": "...", "interaction_mode": "...", "supervision_level": "...",
      "difficulty": "...", "is_free": 0, "objective_code": "...",
      "new_words": ["..."], "prerequisites": [], "skills": ["..."],
      "mastery_criteria": "...", "parent_guide_ar": "...", "family_activity_ar": "...",
      "safety_notes": "... or null", "questions": [ ... ],
      "script_file": "ep-01-....md",
      "production_required": ["video_master", "thumbnail_16x9", "voiceover_ar", "captions_ar", "..."],
      "production_notes": "..."
    }
  ],
  "characters": [
    { "name_ar": "...", "role": "hero|side|presenter|narrator", "age": 0,
      "description_ar": "...", "traits": ["..."], "speech_style": "...",
      "behavioural_rules": ["..."], "relationships": "...", "educational_role": "...",
      "visual_brief": "...", "artwork_status": "none — production required" }
  ],
  "games": [
    { "pack_id": "...", "title_ar": "...", "engine": "<match_pairs|trace_color|sort_bins|memory_flip|count_quantity|sequence_order|word_build|rhythm_tap|logic_pattern|block_code|sim_lab|timeline_map>",
      "age_min": 0, "age_max": 0, "objective_code": "...", "linked_episode": 1,
      "core_mechanic": "...", "gameplay_loop": "...", "levels": [ { "level": 1, "goal": "...", "items": 0, "distractors": 0 } ],
      "difficulty_progression": "...", "instructions_ar": "...",
      "success_rule": "...", "failure_rule": "...", "scoring": "...",
      "educational_feedback": "...", "content_pack": { } }
  ],
  "books": [
    { "slug": "...", "title_ar": "...", "type": "picture_book|interactive|audio_story|comic",
      "age_min": 0, "age_max": 0, "reading_level": "...", "description_ar": "...",
      "objective_code": "...", "pages": [ { "page": 1, "role": "...", "text_ar": "...", "illustration_brief": "..." } ],
      "activities": ["..."], "illustration_requirements": "..." }
  ],
  "projects": [
    { "slug": "...", "title_ar": "...", "age_min": 0, "age_max": 0,
      "objective_code": "...", "supervision_level": "...", "description_ar": "...",
      "materials": ["..."], "preparation": "...", "steps": ["1. ...", "2. ..."],
      "safety_notes": "...", "expected_result": "...", "explanation_ar": "...",
      "parent_involvement": "...", "related_episode": 1 }
  ],
  "open_questions": ["anything you could not resolve without a human decision"],
  "fact_checks_required": ["any claim that needs verification"]
}
```

## 7. Definition of done for your assignment

- Every episode has a complete metadata card, a full scene-by-scene script covering the whole
  declared duration, comprehension questions, mastery criteria, parent guide, family activity,
  required-assets table and production notes.
- Every episode maps to exactly one measurable objective, and every objective you introduce
  appears in `objectives`.
- One series bible per series. One game pack per episode unless the series is deliberately
  game-free (say so if it is).
- At least one book and one project/activity per series where the subject supports it.
- The manifest parses as JSON and every enum value is legal per §2.
- Nothing claims that media exists.
