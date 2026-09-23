# Robo Codes — Episode 3: Repeat With Me (English Edition)

## Localization Card

| Field | Value |
|---|---|
| `locale` | `en` |
| `translated_from` | `ar` |
| `source_path` | `docs/content/planets/06-maharat/robo-codes/ep-03-repeat-with-me.md` |
| `is_machine_translated` | false |
| `status` | `review_lang` |
| `review_state` | `pending` |
| `language_reviewer_id` | `` |
| `edition_type` | `localized_draft` |

## Episode Card

| Field | Value |
|---|---|
| `series_id` | `robo-codes` |
| `episode_number` | 3 |
| `title_en` | Repeat With Me |
| `description_en` | Fewer commands, and the steps stay the same |
| `duration_seconds` | 360 *(6:00)* |
| `age_min` / `age_max` | 9 / 12 |
| `reading_level` | `independent` |
| `interaction_mode` | `independent` |
| `supervision_level` | `optional` |
| `difficulty` | `hard` |
| `is_free` | 0 |
| `learning_objective_id` | `skill.ct.loop` |
| `linked_game_id` | `bc-loops` · Level 3 |
| `status` | `draft` |
| `linked_planets` | 🔗 `arqam` |
| `safety_notes` | Not applicable |

## The Mission

A 6×6 grid with two obstacles. The goal needs **six steps in a single line**, and along the way two items are collected. The new blocks: `repeat` · `collect`.

## The Concept

**Repetition:** one command that says "do this a number of times."

## Learning Objective

**One goal:** the child understands that `repeat` **reduces the number of commands and does not reduce the number of steps**.

Criterion: converts six identical commands into a `repeat` with the correct count, and explains that the steps did not change, in 3 of 4 tries.

## Terms Introduced

| Term | Symbol | Definition in the episode |
|---|---|---|
| **repeat · loop** | `repeat` | a command that re-runs what is inside it a set number of times |
| **collect** | `collect` | a command that picks up the item beneath Robo |

## Carried Over

**command · sequence · logic error · debugging · the four-word sequence.**

---

## 🔴 The misconception this episode prevents

| The misconception | What it produces | How the episode prevents it |
|---|---|---|
| 🔴 "`repeat` means faster" | expects Robo to jump or speed up | **the visible count**: six steps at the same duration |
| "`repeat` is one command doing one step" | miscounts and does not arrive | the steps are highlighted and numbered during execution |
| "a bigger number is better" | writes `repeat 10` at random | 🔴 the first failure **from an over-count** |

> 🔴 **"Repetition is not acceleration" is the axis of the episode.**
>
> The child sees six commands become one, and concludes that the work became less. **The work itself did not change**: Robo takes six steps at the same speed and the same duration.
>
> What changed is **what you wrote**, not what it did. This is the child's first encounter with the idea that **a program is a description, and execution is work** — two different things.
>
> That is why **the count is shown visibly and numbered** in scene 4: 1 · 2 · 3 · 4 · 5 · 6. Seeing prevents the wrong conclusion, and a statement alone is not enough.

## 🔴 The first failure: an over-count, not an under-count

| ❌ rejected failure | ✅ the failure used |
|---|---|
| forgot `repeat` entirely | 🔴 wrote `repeat 7` when 6 was needed |
| wrote a random large number | 🔴 **off by one** |
| the error is in the block type | the error is in the **number** alone |

🔴 **The off-by-one error** is the most common repetition error, for beginners and experts alike. Introducing it here **in a single shot** makes it familiar before it becomes an obstacle.

---

## Full Script

### Scene 1 — Opening and Mission (part 1/6) · 0:00–0:10

**Shot:** 6×6 grid. Robo bottom-left facing east. A long straight path, two items on the path, two obstacles far from it.

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | Music: 🔴 5-second signature |
| 0.9s | narrator | Narrator: "The path is long and straight today." |
| 1.9s | sfx | SFX: six tiles highlight in succession |
| 2.4s | narrator | Narrator: "Six tiles to the goal." |
| 3.4s | narrator | Narrator: "You could write move forward six times." |
| 4.6s | sfx | SFX: six identical blocks appear in the panel |
| 5.1s | narrator | Narrator: "And it will arrive. This is a correct solution." |
| 6.1s | — | pause |
| 6.5s | narrator | Narrator: "But there is a way with fewer commands." |
| 7.5s | sfx | SFX: two items on the path glow once |
| 8s | narrator | Narrator: "And on the path there are two items, which you will collect." |
| 9.2s | narrator | Narrator: "So you also have a new command: collect." |

---

### Scene 2 — Opening and Mission (part 2/6) · 0:10–0:20

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "You could write move forward six times." |
| 3.3s | Luna | says: "And it will arrive. This is a correct solution." |

---

### Scene 3 — Opening and Mission (part 3/6) · 0:20–0:30

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "But there is a way with fewer commands." |
| 3.3s | Luna | says: "And on the path there are two items, which you will collect." |

---

### Scene 4 — Opening and Mission (part 4/6) · 0:30–0:40

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "So you also have a new command: collect." |

---

### Scene 5 — Opening and Mission (part 5/6) · 0:40–0:50

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 6 — Opening and Mission (part 6/6) · 0:50–1:00

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 7 — The Term (part 1/6) · 1:00–1:10

**Shot:** `asset-rc-term-frame`. On the right six `move` blocks, on the left a `repeat` block with one `move` inside it and the number 6.

| Time | Audio | Verbatim text |
|---|---|---|
| 4.8s | narrator | Narrator: "This is a new command called repetition." |
| 5.3s | sfx | SFX: the block appears, marked with the symbol repeat |
| 5.6s | narrator | Narrator: "And in programming it is written: repeat." |
| 6s | — | pause |
| 6.2s | narrator | Narrator: "You put a command inside it, and write the number of times." |
| 6.8s | sfx | SFX: 🔴 the six blocks fold into one block |
| 7.1s | narrator | Narrator: "Repeat: move forward, six times." |
| 7.7s | — | pause |
| 7.9s | narrator | Narrator: "The commands became fewer." |
| 8.2s | narrator | Narrator: "And the steps are still six." |
| 8.7s | narrator | Narrator: "Repetition does not make Robo faster." |
| 9.2s | narrator | Narrator: "It makes your program shorter." |

---

### Scene 8 — The Term (part 2/6) · 1:10–1:20

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "You put a command inside it, and write the number of times." |
| 3.3s | Luna | says: "Repeat: move forward, six times." |

---

### Scene 9 — The Term (part 3/6) · 1:20–1:30

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The commands became fewer." |
| 3.3s | Luna | says: "And the steps are still six." |

---

### Scene 10 — The Term (part 4/6) · 1:30–1:40

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Repetition does not make Robo faster." |
| 3.3s | Luna | says: "It makes your program shorter." |

---

### Scene 11 — The Term (part 5/6) · 1:40–1:50

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 12 — The Term (part 6/6) · 1:50–2:00

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 13 — 🔴 Stop and Predict (part 1/2) · 2:00–2:10

**Shot:** `asset-rc-predict-frame`. The program: `repeat: move × 7`. The goal is after six tiles.

| Time | Audio | Verbatim text |
|---|---|---|
| 8.1s | sfx | SFX: 🔴 the music stops completely |
| 8.3s | narrator | Narrator: "This program says: repeat move, seven times." |
| 8.8s | narrator | Narrator: "And the goal is after six tiles. What will happen?" |
| 9.2s | — | 🔴 total silence, 6 seconds |

---

### Scene 14 — 🔴 Stop and Predict (part 2/2) · 2:10–2:20

**Shot:** Continuation — seamless. (Part 2/2)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And the goal is after six tiles. What will happen?" |

---

### Scene 15 — The Run (part 1/8) · 2:20–2:30

**Shot:** Step-by-step execution, a visible counter showing the loop number: 1 · 2 · 3 …

| Time | Audio | Verbatim text |
|---|---|---|
| 6s | sfx | SFX: the light is pulsing blue · the counter shows: 1 |
| 6.1s | narrator | Narrator: "The first cycle: a step." |
| 6.4s | sfx | SFX: counter 2 · a step |
| 6.5s | narrator | Narrator: "The second: a step. And the third, and the fourth." |
| 6.9s | sfx | SFX: counter 3 then 4 · two steps at the same duration |
| 7.1s | narrator | Narrator: "Notice: every step takes the same time." |
| 7.4s | sfx | SFX: counter 5 then 6 · Robo on the goal |
| 7.6s | narrator | Narrator: "The fifth, and the sixth. Robo is on the goal." |
| 7.9s | — | pause |
| 8s | sfx | SFX: 🔴 counter 7 · Robo advances one extra tile · the light is yellow · a shape marker |
| 8.2s | narrator | Narrator: "But the repeat said seven. So it advanced one extra time." |
| 8.6s | narrator | Narrator: "And it overshot the goal." |
| 8.8s | — | pause 3s |
| 8.9s | narrator | Narrator: "The block is correct. And the command inside it is correct." |
| 9.2s | narrator | Narrator: "The number alone is the mistake." |

---

### Scene 16 — The Run (part 2/8) · 2:30–2:40

**Shot:** Continuation — seamless. (Part 2/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The second: a step. And the third, and the fourth." |

---

### Scene 17 — The Run (part 3/8) · 2:40–2:50

**Shot:** Continuation — seamless. (Part 3/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Notice: every step takes the same time." |

---

### Scene 18 — The Run (part 4/8) · 2:50–3:00

**Shot:** Continuation — seamless. (Part 4/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The fifth, and the sixth. Robo is on the goal." |

---

### Scene 19 — The Run (part 5/8) · 3:00–3:10

**Shot:** Continuation — seamless. (Part 5/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "But the repeat said seven. So it advanced one extra time." |

---

### Scene 20 — The Run (part 6/8) · 3:10–3:20

**Shot:** Continuation — seamless. (Part 6/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And it overshot the goal." |

---

### Scene 21 — The Run (part 7/8) · 3:20–3:30

**Shot:** Continuation — seamless. (Part 7/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The block is correct. And the command inside it is correct." |

---

### Scene 22 — The Run (part 8/8) · 3:30–3:40

**Shot:** Continuation — seamless. (Part 8/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The number alone is the mistake." |

---

### Scene 23 — Debugging (part 1/6) · 3:40–3:50

**Shot:** Split. The program, the counter, and Robo's path numbered on the grid.

| Time | Audio | Verbatim text |
|---|---|---|
| 7.5s | narrator | Narrator: "Read, trace, locate, and fix." |
| 7.7s | sfx | SFX: the path tiles are numbered 1 to 6 |
| 7.8s | narrator | Narrator: "We count the tiles between Robo and the goal: six." |
| 8.1s | sfx | SFX: the number 7 in the block highlighted in a yellow frame with a shape marker |
| 8.2s | narrator | Narrator: "And the program says seven. The difference is one." |
| 8.5s | — | pause |
| 8.5s | narrator | Narrator: "This is a logic error too. But it is in the number." |
| 8.8s | sfx | SFX: 🔴 the number changes from 7 to 6 · one edit · re-run · green |
| 9s | narrator | Narrator: "We changed the number alone. One edit." |
| 9.2s | narrator | Narrator: "Then we added collect at each item." |

---

### Scene 24 — Debugging (part 2/6) · 3:50–4:00

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "We count the tiles between Robo and the goal: six." |

---

### Scene 25 — Debugging (part 3/6) · 4:00–4:10

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And the program says seven. The difference is one." |

---

### Scene 26 — Debugging (part 4/6) · 4:10–4:20

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "This is a logic error too. But it is in the number." |

---

### Scene 27 — Debugging (part 5/6) · 4:20–4:30

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "We changed the number alone. One edit." |

---

### Scene 28 — Debugging (part 6/6) · 4:30–4:40

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Then we added collect at each item." |

---

### Scene 29 — Generalization (part 1/5) · 4:40–4:50

**Shot:** One symbolic shot: the instruction "fold the paper three times" versus "fold · fold · fold."

| Time | Audio | Verbatim text |
|---|---|---|
| 7.9s | narrator | Narrator: "Repetition is in our everyday speech." |
| 8.1s | sfx | SFX: symbol: three identical instructions |
| 8.2s | narrator | Narrator: "You say: fold the paper, fold, fold." |
| 8.4s | sfx | SFX: 🔴 the three fold into one instruction |
| 8.5s | narrator | Narrator: "Or you say: fold the paper three times." |
| 8.7s | — | pause |
| 8.8s | narrator | Narrator: "The words are shorter. And the number of folds is three either way." |
| 9.1s | narrator | Narrator: "This is repetition." |
| 9.2s | — | pause |

---

### Scene 30 — Generalization (part 2/5) · 4:50–5:00

**Shot:** Continuation — seamless. (Part 2/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "You say: fold the paper, fold, fold." |

---

### Scene 31 — Generalization (part 3/5) · 5:00–5:10

**Shot:** Continuation — seamless. (Part 3/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Or you say: fold the paper three times." |

---

### Scene 32 — Generalization (part 4/5) · 5:10–5:20

**Shot:** Continuation — seamless. (Part 4/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The words are shorter. And the number of folds is three either way." |

---

### Scene 33 — Generalization (part 5/5) · 5:20–5:30

**Shot:** Continuation — seamless. (Part 5/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "This is repetition." |

---

### Scene 34 — Challenge and Closing (part 1/3) · 5:30–5:40

**Shot:** `asset-rc-challenge-frame`. A 6×6 grid, two straight paths at an angle, and two items.

| Time | Audio | Verbatim text |
|---|---|---|
| 8.5s | narrator | Narrator: "In today's challenge there are two straight paths, with a turn between them." |
| 8.8s | narrator | Narrator: "Use a repeat for each path, and collect the two items." |
| 9s | — | pause |
| 9s | narrator | Narrator: "And if you write the commands one by one, you will still arrive." |
| 9.2s | narrator | Narrator: "And the repeat is an extra star." |

---

### Scene 35 — Challenge and Closing (part 2/3) · 5:40–5:50

**Shot:** Continuation — seamless. (Part 2/3)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And if you write the commands one by one, you will still arrive." |
| 3.3s | Luna | says: "And the repeat is an extra star." |

---

### Scene 36 — Challenge and Closing (part 3/3) · 5:50–6:00

**Shot:** Continuation — seamless. (Part 3/3)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

## Storyboard — 7 shots

| # | Shot | Technique | Description | Duration |
|---|---|---|---|---:|
| 1 | Mission | top-down | six-tile path · two items · six blocks | 60s |
| 2 | The term | split frame | 🔴 six blocks fold into one + the symbol `repeat` | 60s |
| 3 | **Stop and Predict** | 🔴 still frame | `repeat × 7` vs. six tiles + **silence** | 20s |
| 4 | The run | top-down + **counter** | 🔴 visible count 1–7 · one extra step · yellow | 80s |
| 5 | Debugging | split | number the tiles · change the number · `collect` | 60s |
| 6 | Generalization | symbolic frame | three instructions fold into one | 50s |
| 7 | Challenge | frame | two paths with a turn between them | 30s |

### Visual rules

| # | Rule |
|---|---|
| 1 | **visible and clear** during each cycle — the most important visual element in the episode |
| 2 | **completely constant** across all cycles · a single `step_delay_ms` |
| 3 | six blocks → one block · transition ≤ 400ms |
| 4 | 🔴 shown **once** in scene 2 |
| 5 | clear shape + frame — not color alone |
| 6 | 🔴 **no red** · the yellow comes with a shape marker |
| 7 | 🔴 symbolic · a simple sheet of paper with no realistic hand |

🔴 **Visually forbidden:** any acceleration of movement inside `repeat` · any jump or instant translation · any "speed" effect or motion lines · a counter that disappears during execution.

---

## Voiceover Recording Script

```
1.  The path is long and straight today.
2.  Six tiles to the goal.
3.  You could write move forward six times.
4.  And it will arrive. This is a correct solution.
    [pause]
5.  But there is a way with fewer commands.
6.  And on the path there are two items, which you will collect.
7.  So you also have a new command: collect.
8.  This is a new command called repetition.
9.  And in programming it is written: repeat.
    [pause]
10. You put a command inside it, and write the number of times.
11. Repeat: move forward, six times.
    [pause]
12. The commands became fewer.
13. And the steps are still six.
14. Repetition does not make Robo faster.
15. It makes your program shorter.
16. This program says: repeat move, seven times.
17. And the goal is after six tiles. What will happen?
    [total silence, 6 seconds]
18. The first cycle: a step.
19. The second: a step. And the third, and the fourth.
20. Notice: every step takes the same time.
21. The fifth, and the sixth. Robo is on the goal.
    [pause]
22. But the repeat said seven. So it advanced one extra time.
23. And it overshot the goal.
    [pause 3s]
24. The block is correct. And the command inside it is correct.
25. The number alone is the mistake.
26. Read, trace, locate, and fix.
27. We count the tiles between Robo and the goal: six.
28. And the program says seven. The difference is one.
    [pause]
29. This is a logic error too. But it is in the number.
30. We changed the number alone. One edit.
31. Then we added collect at each item.
32. Repetition is in our everyday speech.
33. You say: fold the paper, fold, fold.
34. Or you say: fold the paper three times.
    [pause]
35. The words are shorter. And the number of folds is three either way.
36. This is repetition.
    [pause]
37. In today's challenge there are two straight paths, with a turn between them.
38. Use a repeat for each path, and collect the two items.
    [pause]
39. And if you write the commands one by one, you will still arrive.
40. And the repeat is an extra star.
```

**40 lines · each line ≤ 14 words.**

### Pronunciation notes

| # | Note |
|---|---|
| 1 | 🔴 ~130 wpm · calm and confident |
| 2 | 🔴 "This is a correct solution" in a tone of **report** — no concession or flattery |
| 3 | `repeat` pronounced in English **once** and clearly |
| 4 | 🔴 **the key of the episode** · emphasis on "still" |
| 5 | 🔴 "does not make Robo faster" slowly |
| 6 | a real question · then total silence |
| 7 | 🔴 **the counting rhythm perfectly even** — the voice confirms the constant duration |
| 8 | 🔴 said **during** execution, not after |
| 9 | tone of **information**, not tragedy |
| 10 | a pause between them · "alone" with emphasis |
| 11 | the four-word sequence at the same rhythm as episodes 1 and 2 |
| 12 | "one edit" with emphasis |
| 13 | 🔴 the contrast — a pause between the two halves |
| 14 | 🔴 tone of **reassurance** — the longer solution is acceptable |

> 🔴 **Forbidden:** any tone of acceleration in lines 18–21 · any implication that the long solution is weak · "well done" · "kids" · error sound · voicing Robo.

> 🔴 **Concept review:** lines 13, 14, 15, 20, 35 — all prevent the "faster" misconception.

> ⚠️ **Language review:** "repetition" · "repeat" · "collect" · "six" · "fold" · "the folds."

---

## Comprehension Questions

```json
[
  {
    "id": "q1",
    "type": "image_choice",
    "prompt_audio": "asset-vo-rc-ep3-q1-en",
    "prompt_key": "rc.ep3.q1",
    "prompt_text": "What does repetition change?",
    "options": ["asset-choice-fewer-commands", "asset-choice-faster-robo", "asset-choice-fewer-steps"],
    "answer": "asset-choice-fewer-commands"
  },
  {
    "id": "q2",
    "type": "count_quantity",
    "prompt_audio": "asset-vo-rc-ep3-q2-en",
    "prompt_key": "rc.ep3.q2",
    "prompt_text": "The goal is after five tiles. How many times do we repeat move?",
    "options": [4, 5, 6],
    "answer": 5
  }
]
```

> 🔴 **Both distractors in the first question are mandatory, and each measures a different misconception:**
>
> | Distractor | The misconception |
> |---|---|
> | `faster-robo` | "repetition is acceleration" — the most common |
> | `fewer-steps` | "repetition reduces the work itself" — the more subtly wrong |
>
> The second question **measures the off-by-one error** directly: distractors 4 and 6 are the usual deviations around the answer.

---

## Mastery Criterion

```
Chooses "fewer commands" not "faster Robo," and identifies the correct repeat count with no off-by-one — in 3 of 4 tries.
```

---

## Parent Guide

> **What is your child learning?**
> That a single command can say "do this six times." This is called **repetition**, written in programming as `repeat`.
>
> **🔴 And the most important part of the episode is not repetition, but what it does not do**
> Repetition **does not make Robo faster**, and does not reduce its number of steps. Six steps stay six, at exactly the same duration.
>
> What changed is **the program your child wrote**, not the work that was executed. This is their first encounter with the idea that **the description is one thing and the execution is another** — an idea much is built on later.
>
> That is why a **visible counter** is shown during execution: 1 · 2 · 3 · 4 · 5 · 6. Seeing prevents the wrong conclusion, and words alone do not.
>
> **🔴 The off-by-one error**
> The program failed in the episode because it said "seven times" and the goal was after six tiles. **The block is correct, the command inside it is correct, and the number alone is wrong.**
>
> This error *(off-by-one)* is the most common repetition error **for beginners and experts together**. Showing it early makes it familiar before it becomes an obstacle.
>
> **If they miscount, do not give them the number.** Say: "**Count the tiles between Robo and the goal.**" — the counting itself is the skill.
>
> **🔴 And the long solution is still correct**
> The episode says in the first minute: six identical commands is **a correct solution**. And it says in the last sentence that the repeat is **an extra star**, not a requirement.
>
> On purpose. A child who is ashamed of a working solution stops trying. And improvement comes **after** success, not before.
>
> **A question to talk about after the episode**
> "Do you know something you do every day a number of times?" — brushing your teeth, climbing the stairs. **The conversation alone is enough, with no need to turn it into a lesson.**

---

## Family Activity — optional

> **Fold three times — 10 minutes · paper only**
>
> 1. Give your child a sheet of paper and say: "fold · fold · fold" — three separate instructions.
> 2. Give a second sheet and say: "fold three times" — one instruction.
> 3. **Compare the two sheets.** The number of folds is the same.
> 4. Ask them: "**Which instruction was shorter? And which work was less?**"
> 5. The intended answer: the instruction is shorter, **and the work is the same**.
> 6. Ask them to give **you** a repetition instruction, and execute it literally.
>
> 🔴 **The fourth question is the whole activity.** It is designed to separate **the description** from **the work**.
>
> 🔴 **And do not race for speed.** Any timed race here **produces** exactly the misconception the episode prevents.
>
> ⚠️ Plain paper · no scissors · and no folding thick paper that hurts the fingers.

---

## Linked Game

`bc-loops` · engine [`block_code`](../../../../games/engines/10-block-code.md) · **Level 3**

| # | Value |
|---|---|
| grid | 6×6 |
| blocks | `move` · `turn_left` · `turn_right` · `repeat` · `collect` |
| optimal_blocks | 12 |
| — | 8 |
| obstacles | 2 |
| items | 2 |

🔴 **A solution without `repeat` is accepted and wins** — the star is only at `optimal_blocks`. [game packs](../game-packs.md#bc-loops).

---

## Required Assets

| # | Type | Description |
|---|---|---|
| 1 | video | episode master |
| 2 | image | 16:9 thumbnail |
| 3 | subtitles | VTT |
| 4 | image · motion | Robo character *(shared)* |
| 5 | image | 6×6 grid · 🔴 do not mirror |
| 6 | image | item with a **clear shape** + frame |
| 7 | image | 🔴 "repeat" icon **without text** · with a number field |
| 8 | image | 🔴 "collect" icon **without text** |
| 9 | UI | 🔴 **the visible loop counter** — mandatory asset |
| 10 | image | 🔴 three symbolic fold instructions · no realistic hand |
| 11 | motion | six blocks fold into one ≤ 400ms |
| 12 | image | fewer commands *(the answer)* |
| 13 | image | 🔴 faster Robo *(mandatory distractor)* |
| 14 | image | 🔴 fewer steps *(mandatory distractor)* |
| 15 | image | the four-word sequence *(shared)* |
| 16 | audio | the two questions |

> 🔴 **Rejected** — any asset containing: speed lines or an acceleration effect · Robo jumping or teleporting · a different step duration between cycles · a hidden counter · a red light · baked-in text on a block · scissors or a sharp tool in the paper example.
>
> 🔴 `asset-rc-ep3-loop-counter` is a **mandatory asset** — without it the "repetition is acceleration" misconception is not disproven.

---

## Translation Keys

```
rc.ep3.title        = Repeat With Me
rc.ep3.description  = Fewer commands, and the steps stay the same
rc.ep3.q1           = What does repetition change?
rc.ep3.q2           = The goal is after five tiles. How many times do we repeat move?
rc.term.repeat      = repetition
rc.block.repeat     = repeat
rc.block.collect    = collect
rc.ep3.key          = The commands became fewer. And the steps are still six.
rc.ep3.closing      = The words are shorter. And the number of folds is three either way.
rc.ep3.long_ok      = And if you write the commands one by one, you will still arrive.
```

### Localization Contract

| # | Rule |
|---|---|
| 1 | 🔴 `ar` **explicitly declared** as source |
| 2 | **not translated** — shown in English once per language |
| 3 | 🔴 a single fixed native word — no swapping between "repetition" and "loop" |
| 4 | preserves the contrast between **commands** and **steps** — the most important sentence in the episode |
| 5 | **mandatory in every language** — without it the child thinks their solution is rejected |
| 6 | shown in the language's own numerals · and the required number is **6** in every language |
| 7 | 🔴 follows the language's plural rules, not string concatenation |
| 8 | text is mirrored · 🔴 **the grid and the counter are not** |
| 9 | reviewed locally · with no sharp tool |

🔴 **If a translation of `rc.ep3.key` carries the meaning that the steps became fewer, the translation is rejected.** The contrast is the concept, and losing it produces the opposite of the episode.

---

## Acceptance Criteria

- [ ] Duration 360 seconds ±15.
- [ ] **40 lines** · each line ≤ 14 words.
- [ ] 🔴 **one concept**: repetition · two new blocks (`repeat` · `collect`) · one term.
- [ ] 🔴 the sentence **"And it will arrive. This is a correct solution."** in the first minute.
- [ ] 🔴 the two sentences **"The commands became fewer. And the steps are still six."** are present.
- [ ] 🔴 the sentence **"Repetition does not make Robo faster."** is present.
- [ ] 🔴 **a visible loop counter** in every cycle during the run.
- [ ] 🔴 **the step duration is perfectly constant** across all cycles · a single `step_delay_ms`.
- [ ] 🔴 **no acceleration effect, motion lines, or jump**.
- [ ] 🔴 the sentence **"Notice: every step takes the same time"** is spoken **during** execution.
- [ ] 🔴 **"stop and predict" with 6 seconds of silence** · and the question shows the numbers 7 and 6.
- [ ] 🔴 **the failure from an over-count by one** — not from a wrong block.
- [ ] 🔴 the two sentences **"The block is correct... The number alone is the mistake."** are present.
- [ ] 🔴 **the fix is a single edit**: changing the number alone.
- [ ] 🔴 the error is named a **logic error** — the concept widens and is not replaced.
- [ ] 🔴 the four-word sequence in the same words and rhythm as episodes 1 and 2.
- [ ] 🔴 the symbol `repeat` is shown **once** only.
- [ ] 🔴 the two challenge sentences **"you will still arrive" and "an extra star"** are present.
- [ ] 🔴 the `faster-robo` and `fewer-steps` distractors are **present**.
- [ ] The second question measures the **off-by-one** with distractors 4 and 6.
- [ ] 🔴 **Robo does not talk or praise** · no face · no red light.
- [ ] 🔴 **the grid and the counter are not mirrored in RTL**.
- [ ] Generalization is **one example**, symbolic · no sharp tool.
- [ ] The family activity 🔴 **with no timed race** · and includes the question separating description from work.
- [ ] 🔴 **concept review** signed off — including lines 13, 14, 20, and 35.
- [ ] 🔴 **RTL direction review** signed off.
- [ ] **Language review** for term stability and number forms.
