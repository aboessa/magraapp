# Robo Codes — Episode 2: Fix the Path (English Edition)

## Localization Card

| Field | Value |
|---|---|
| `locale` | `en` |
| `translated_from` | `ar` |
| `source_path` | `docs/content/planets/06-maharat/robo-codes/ep-02-debug-path.md` |
| `is_machine_translated` | false |
| `status` | `review_lang` |
| `review_state` | `pending` |
| `language_reviewer_id` | `` |
| `edition_type` | `localized_draft` |

## Episode Card

| Field | Value |
|---|---|
| `series_id` | `robo-codes` |
| `episode_number` | 2 |
| `title_en` | Fix the Path |
| `description_en` | A turn in the wrong place, and how to find the error without guessing |
| `duration_seconds` | 360 *(6:00)* |
| `age_min` / `age_max` | 9 / 12 |
| `reading_level` | `independent` |
| `interaction_mode` | `independent` |
| `supervision_level` | `optional` |
| `difficulty` | `hard` |
| `is_free` | 0 |
| `learning_objective_id` | `skill.ct.debug` |
| `linked_game_id` | `bc-first-steps` · Level 2 |
| `status` | `draft` |
| `linked_planets` | 🔗 `qiyam` |
| `safety_notes` | Not applicable |

## The Mission

A 5×5 grid with **one obstacle**. The goal needs a move, then a turn, then a move. Blocks: `move` · `turn_left` · `turn_right`.

## The Concept

**The logic error and debugging:** a correct command in the **wrong place**.

## Learning Objective

**One goal:** the child distinguishes between a **wrong command** and a **command in the wrong place**, and uses the four-word sequence to find the second.

Criterion: identifies the **first** command that went off course in a given program, and fixes it **with a single edit**, in 3 of 4 tries.

## Terms Introduced

| Term | Definition in the episode |
|---|---|
| **logic error** | a command that exists and is correct, but is in the wrong place |
| **debugging** | reading your program to find the first place it went off course |

## Carried Over From Episode 1

**command · sequence · the four-word sequence** — recalled verbatim in scene 5.

---

## 🔴 The Signature Decision: one edit at a time

| ❌ rejected behavior | ✅ the taught behavior |
|---|---|
| Edit three commands then run | 🔴 **one edit then run** |
| Delete the program and start over | 🔴 Fix the **first deviation** alone |
| Try every possibility | Read and trace |
| "I'll change something and see" | "I'll fix this, then see" |

> 🔴 **A multi-edit hides the cause.** If the child changes three commands and it works, they do not know which was the mistake — and cannot avoid it.
>
> **And this mirrors the lesson of** [plant responsibility](../../04-qiyam/hekaya-wa-hikma/ep-04-plant-responsibility.md) **on the Values planet:** there it is "build a system that reminds you" not "I'll try to remember," and here it is "read your command" not "I'll keep trying until it works." **Both replace random intention with a method.**

## 🔴 The distinction the episode builds

| Type | Example | Present in this episode? |
|---|---|---|
| a **missing** command | forgot `turn_left` entirely | ❌ not this episode's topic |
| a **wrong** command | used `turn_right` instead of `turn_left` | ⚠️ mentioned for contrast only |
| 🔴 a command **in the wrong place** | `turn_left` is correct, but **before its time** | ✅ **this episode's topic** |

**The third type is the logic error**, the hardest of the three because every line looks sound.

## 🔴 "Robo's right is not your right"

A mandatory item, introduced here because this is the first episode with a turn.

| State | Robo's right |
|---|---|
| facing east | bottom of the screen |
| facing south | left of the screen |
| facing west | top of the screen |
| facing north | right of the screen |

> 🔴 **This is the most dangerous directional confusion in the series.** The child reads "turn right" and looks to the **right of the screen**, not to Robo's right.
>
> The episode **shows both states visually** in scene 2, not just states it. And the rule is reviewed in **every language**, because some languages describe direction relative to the viewer by default.

---

## Full Script

### Scene 1 — Opening and Mission (part 1/6) · 0:00–0:10

**Shot:** 5×5 grid from above. Robo bottom-left facing east. One obstacle. The goal is roughly upper-right.

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | Music: 🔴 5-second signature |
| 0.9s | narrator | Narrator: "The grid is bigger today, and it has an obstacle." |
| 2.2s | sfx | SFX: the obstacle is highlighted with a shape frame |
| 2.7s | narrator | Narrator: "Robo does not pass through the obstacle. It stops at it." |
| 4.1s | narrator | Narrator: "And the goal is not in a straight line." |
| 5.4s | — | pause |
| 5.8s | narrator | Narrator: "So you need two new commands: turn left, and turn right." |
| 7.4s | sfx | SFX: two new blocks appear in the panel |
| 7.9s | narrator | Narrator: "And a turn does not move Robo one tile." |
| 9.2s | narrator | Narrator: "It only changes the direction it faces." |

---

### Scene 2 — Opening and Mission (part 2/6) · 0:10–0:20

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Robo does not pass through the obstacle. It stops at it." |

---

### Scene 3 — Opening and Mission (part 3/6) · 0:20–0:30

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And the goal is not in a straight line." |

---

### Scene 4 — Opening and Mission (part 4/6) · 0:30–0:40

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "So you need two new commands: turn left, and turn right." |

---

### Scene 5 — Opening and Mission (part 5/6) · 0:40–0:50

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And a turn does not move Robo one tile." |

---

### Scene 6 — Opening and Mission (part 6/6) · 0:50–1:00

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "It only changes the direction it faces." |

---

### Scene 7 — The Term and Direction (part 1/6) · 1:00–1:10

**Shot:** `asset-rc-term-frame`. Robo in the center in four direction states, with an arrow for its right in each.

| Time | Audio | Verbatim text |
|---|---|---|
| 4.9s | narrator | Narrator: "Before we begin, an important item." |
| 5.4s | sfx | SFX: 🔴 Robo faces east · its right-arrow points to the bottom of the screen |
| 5.6s | narrator | Narrator: "Robo's right is not the screen's right." |
| 6.1s | narrator | Narrator: "It is Robo's own right." |
| 6.5s | sfx | SFX: Robo faces south · the arrow points to the left of the screen |
| 6.8s | narrator | Narrator: "So if it faces down, its right is to the left." |
| 7.6s | — | pause 3s |
| 7.8s | narrator | Narrator: "Imagine you are standing in its place, and you know your right." |
| 8.5s | sfx | SFX: the frame turns into a displayed program |
| 8.7s | narrator | Narrator: "Now, this is a program someone wrote." |
| 9.2s | narrator | Narrator: "Move, turn left, move, move." |

---

### Scene 8 — The Term and Direction (part 2/6) · 1:10–1:20

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "It is Robo's own right." |
| 3.3s | Luna | says: "So if it faces down, its right is to the left." |

---

### Scene 9 — The Term and Direction (part 3/6) · 1:20–1:30

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Imagine you are standing in its place, and you know your right." |
| 3.3s | Luna | says: "Now, this is a program someone wrote." |

---

### Scene 10 — The Term and Direction (part 4/6) · 1:30–1:40

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Move, turn left, move, move." |

---

### Scene 11 — The Term and Direction (part 5/6) · 1:40–1:50

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 12 — The Term and Direction (part 6/6) · 1:50–2:00

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 13 — 🔴 Stop and Predict (part 1/2) · 2:00–2:10

**Shot:** `asset-rc-predict-frame`. The four-command program is shown, the grid beside it, and the obstacle visible.

| Time | Audio | Verbatim text |
|---|---|---|
| 8s | sfx | SFX: 🔴 the music stops completely |
| 8.1s | narrator | Narrator: "Four commands, and an obstacle on the path." |
| 8.5s | narrator | Narrator: "Which command will stop it?" |
| 8.8s | — | 🔴 total silence, 6 seconds |
| 9.2s | sfx | SFX: the frame disappears |

---

### Scene 14 — 🔴 Stop and Predict (part 2/2) · 2:10–2:20

**Shot:** Continuation — seamless. (Part 2/2)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Which command will stop it?" |

---

### Scene 15 — The Run (part 1/8) · 2:20–2:30

**Shot:** Step-by-step execution, the executed block highlighted with a frame and a shape marker.

| Time | Audio | Verbatim text |
|---|---|---|
| 6.1s | sfx | SFX: the light is pulsing blue |
| 6.2s | narrator | Narrator: "First command: move. One tile." |
| 6.6s | sfx | SFX: Robo advances |
| 6.7s | narrator | Narrator: "Second: turn left." |
| 6.9s | sfx | SFX: 🔴 Robo turns in place · it does not move |
| 7.1s | narrator | Narrator: "It turned in place. Now it faces up." |
| 7.4s | narrator | Narrator: "Third: move." |
| 7.6s | sfx | SFX: Robo advances one tile |
| 7.8s | narrator | Narrator: "Fourth: move." |
| 8s | sfx | SFX: 🔴 Robo reaches the obstacle · the light is yellow · a shape marker · a gentle shake |
| 8.2s | narrator | Narrator: "It stopped. The obstacle is in front of it." |
| 8.4s | — | pause 3s |
| 8.5s | narrator | Narrator: "There is no wrong command in this program." |
| 8.9s | narrator | Narrator: "The turn is correct. And the move is correct." |
| 9.2s | narrator | Narrator: "But the turn came before its time." |

---

### Scene 16 — The Run (part 2/8) · 2:30–2:40

**Shot:** Continuation — seamless. (Part 2/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "It turned in place. Now it faces up." |
| 3.3s | Luna | says: "Third: move." |

---

### Scene 17 — The Run (part 3/8) · 2:40–2:50

**Shot:** Continuation — seamless. (Part 3/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Fourth: move." |
| 3.3s | Luna | says: "It stopped. The obstacle is in front of it." |

---

### Scene 18 — The Run (part 4/8) · 2:50–3:00

**Shot:** Continuation — seamless. (Part 4/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "There is no wrong command in this program." |
| 3.3s | Luna | says: "The turn is correct. And the move is correct." |

---

### Scene 19 — The Run (part 5/8) · 3:00–3:10

**Shot:** Continuation — seamless. (Part 5/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "But the turn came before its time." |

---

### Scene 20 — The Run (part 6/8) · 3:10–3:20

**Shot:** Continuation — seamless. (Part 6/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 21 — The Run (part 7/8) · 3:20–3:30

**Shot:** Continuation — seamless. (Part 7/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 22 — The Run (part 8/8) · 3:30–3:40

**Shot:** Continuation — seamless. (Part 8/8)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 23 — Debugging (part 1/6) · 3:40–3:50

**Shot:** Split. The program on one side, the grid on the other, a cursor moving.

| Time | Audio | Verbatim text |
|---|---|---|
| 7.3s | narrator | Narrator: "Same method: read, trace, locate, and fix." |
| 7.6s | sfx | SFX: cursor on command 1 · Robo one tile |
| 7.7s | narrator | Narrator: "After the first: one tile. Correct." |
| 8s | sfx | SFX: cursor on command 2 · Robo turns |
| 8.1s | narrator | Narrator: "After the second: it turned before passing the obstacle." |
| 8.4s | sfx | SFX: 🔴 command 2 highlighted in a yellow frame with a shape marker |
| 8.5s | narrator | Narrator: "Here is the first deviation. And this is called a logic error." |
| 8.8s | narrator | Narrator: "And reading the program to find it is called debugging." |
| 9.1s | sfx | SFX: 🔴 one move is inserted before the turn · re-run · green |
| 9.2s | narrator | Narrator: "We added one move before it. It arrived." |

---

### Scene 24 — Debugging (part 2/6) · 3:50–4:00

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "After the first: one tile. Correct." |

---

### Scene 25 — Debugging (part 3/6) · 4:00–4:10

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "After the second: it turned before passing the obstacle." |

---

### Scene 26 — Debugging (part 4/6) · 4:10–4:20

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Here is the first deviation. And this is called a logic error." |

---

### Scene 27 — Debugging (part 5/6) · 4:20–4:30

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And reading the program to find it is called debugging." |

---

### Scene 28 — Debugging (part 6/6) · 4:30–4:40

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "We added one move before it. It arrived." |

---

### Scene 29 — Generalization (part 1/5) · 4:40–4:50

**Shot:** One shot: road directions written in symbols — "walk to the intersection, then turn."

| Time | Audio | Verbatim text |
|---|---|---|
| 7.9s | narrator | Narrator: "A logic error happens off the screen too." |
| 8.1s | sfx | SFX: symbol: a street and an intersection |
| 8.2s | narrator | Narrator: "Someone told you: walk, then turn right." |
| 8.4s | sfx | SFX: 🔴 the turn before the intersection — the wrong street |
| 8.5s | narrator | Narrator: "So you turned before the intersection, and reached a different street." |
| 8.7s | — | pause |
| 8.8s | narrator | Narrator: "The directions were not wrong. The place was wrong." |
| 9.1s | narrator | Narrator: "This is the logic error." |
| 9.2s | — | pause |

---

### Scene 30 — Generalization (part 2/5) · 4:50–5:00

**Shot:** Continuation — seamless. (Part 2/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Someone told you: walk, then turn right." |

---

### Scene 31 — Generalization (part 3/5) · 5:00–5:10

**Shot:** Continuation — seamless. (Part 3/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "So you turned before the intersection, and reached a different street." |

---

### Scene 32 — Generalization (part 4/5) · 5:10–5:20

**Shot:** Continuation — seamless. (Part 4/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The directions were not wrong. The place was wrong." |

---

### Scene 33 — Generalization (part 5/5) · 5:20–5:30

**Shot:** Continuation — seamless. (Part 5/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "This is the logic error." |

---

### Scene 34 — Challenge and Closing (part 1/3) · 5:30–5:40

**Shot:** `asset-rc-challenge-frame`. A new 5×5 grid, and a ready program with one logic error.

| Time | Audio | Verbatim text |
|---|---|---|
| 8.6s | narrator | Narrator: "Today's challenge is different. The program is written for you." |
| 8.8s | narrator | Narrator: "And it has one logic error." |
| 9s | — | pause |
| 9s | narrator | Narrator: "Read, trace, and locate the first deviation." |
| 9.2s | narrator | Narrator: "Then fix it with a single edit only." |

---

### Scene 35 — Challenge and Closing (part 2/3) · 5:40–5:50

**Shot:** Continuation — seamless. (Part 2/3)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Read, trace, and locate the first deviation." |
| 3.3s | Luna | says: "Then fix it with a single edit only." |

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
| 1 | Mission | top-down | 5×5 grid · obstacle · two new blocks | 60s |
| 2 | Term and direction | frame | 🔴 Robo in four directions + its right-arrow | 60s |
| 3 | **Stop and Predict** | 🔴 still frame | program + obstacle + **silence** | 20s |
| 4 | The run | top-down + panel | execution · turn in place · stop at obstacle | 80s |
| 5 | Debugging | split | cursor + insert one command + re-run | 60s |
| 6 | Generalization | symbolic frame | turning before the intersection | 50s |
| 7 | Challenge | frame | a ready program with an error | 30s |

### Visual rules

| # | Rule |
|---|---|
| 1 | 🔴 **Do not mirror in RTL** |
| 2 | 🔴 **clear shape** + frame — not color alone |
| 3 | 🔴 **turn in place with no translation** · ≤ 400ms |
| 4 | 🔴 appears in **four direction** states |
| 5 | white → blue → **yellow** → green · 🔴 **no red** |
| 6 | yellow frame + 🔴 **shape marker** |
| 7 | 🔴 **no face** · no expression when stopping |
| 8 | 🔴 **symbolic** · no moving vehicles or realistic street scenes |

---

## Voiceover Recording Script

```
1.  The grid is bigger today, and it has an obstacle.
2.  Robo does not pass through the obstacle. It stops at it.
3.  And the goal is not in a straight line.
    [pause]
4.  So you need two new commands: turn left, and turn right.
5.  And a turn does not move Robo one tile.
6.  It only changes the direction it faces.
7.  Before we begin, an important item.
8.  Robo's right is not the screen's right.
9.  It is Robo's own right.
10. So if it faces down, its right is to the left.
    [pause 3s]
11. Imagine you are standing in its place, and you know your right.
12. Now, this is a program someone wrote.
13. Move, turn left, move, move.
14. Four commands, and an obstacle on the path.
15. Which command will stop it?
    [total silence, 6 seconds]
16. First command: move. One tile.
17. Second: turn left.
18. It turned in place. Now it faces up.
19. Third: move.
20. Fourth: move.
21. It stopped. The obstacle is in front of it.
    [pause 3s]
22. There is no wrong command in this program.
23. The turn is correct. And the move is correct.
24. But the turn came before its time.
25. Same method: read, trace, locate, and fix.
26. After the first: one tile. Correct.
27. After the second: it turned before passing the obstacle.
28. Here is the first deviation. And this is called a logic error.
29. And reading the program to find it is called debugging.
30. We added one move before it. It arrived.
31. A logic error happens off the screen too.
32. Someone told you: walk, then turn right.
33. So you turned before the intersection, and reached a different street.
    [pause]
34. The directions were not wrong. The place was wrong.
35. This is the logic error.
    [pause]
36. Today's challenge is different. The program is written for you.
37. And it has one logic error.
    [pause]
38. Read, trace, and locate the first deviation.
39. Then fix it with a single edit only.
```

**39 lines · each line ≤ 14 words.**

### Pronunciation notes

| # | Note |
|---|---|
| 1 | 🔴 ~130 wpm · calm and confident |
| 2 | 🔴 **slowly** — correcting the step count |
| 3 | 🔴 "Robo's **own** right" with emphasis on "own" |
| 4 | slowly · the image carries the clarification |
| 5 | tone of an **invitation to embody**, not an explanation |
| 6 | 🔴 a real question · then total silence |
| 7 | 🔴 "it turned in place" clearly — no translational movement |
| 8 | 🔴 "stopped" in a tone of **information**, not failure |
| 9 | 🔴 **the key of the episode** · a pause after it |
| 10 | 🔴 "before its time" with emphasis |
| 11 | 🔴 the four-word sequence **at the same rhythm as episode 1** |
| 12 | 🔴 the two terms — each slowly with a pause after |
| 13 | "one move" with emphasis on "one" |
| 14 | 🔴 the contrast — a pause between the two halves |
| 15 | 🔴 "a single edit only" — a condition, not advice |

> 🔴 **Forbidden:** "kids" · "well done" · any tone of frustration in line 21 · any sentence saying Robo made a mistake · error sound · a hard collision sound · voicing Robo.

> 🔴 **Concept review:** lines 5, 6 *(a turn is not a step)* · 8–11 *(Robo's right)* · 22–24 *(the error is in the place)*.

> ⚠️ **Language review:** "logic error" · "debugging" · "deviation" · "walk" — and their stability across the series.

---

## Comprehension Questions

```json
[
  {
    "id": "q1",
    "type": "image_choice",
    "prompt_audio": "asset-vo-rc-ep2-q1-en",
    "prompt_key": "rc.ep2.q1",
    "prompt_text": "What kind of error is in Robo's program?",
    "options": ["asset-choice-right-order-wrong", "asset-choice-command-wrong", "asset-choice-robo-slow"],
    "answer": "asset-choice-right-order-wrong"
  },
  {
    "id": "q2",
    "type": "image_choice",
    "prompt_audio": "asset-vo-rc-ep2-q2-en",
    "prompt_key": "rc.ep2.q2",
    "prompt_text": "Robo faces down. Where is its right?",
    "options": ["asset-choice-robo-right-screen-left", "asset-choice-robo-right-screen-right", "asset-choice-robo-right-up"],
    "answer": "asset-choice-robo-right-screen-left"
  }
]
```

> 🔴 **The second question measures the directional confusion directly.** The intuitive answer `screen-right` is wrong, and choosing it reveals that the child is measuring relative to the screen.
>
> The `command-wrong` distractor in the first question is **half-right**: it seems plausible, and it is the opposite of the concept — there is no wrong command in the program.
>
> The `robo-slow` distractor **tests the character's second rule**: Robo does not slow down or get confused.

---

## Mastery Criterion

```
Identifies the first command that went off course, fixes it with a single edit, and answers correctly about Robo's right — in 3 of 4 tries.
```

---

## Parent Guide

> **What is your child learning?**
> That there is an error **that appears in no single line**. Every command in the program was correct, and the turn only came **before its time**. This is called a **logic error**, the most common and hardest programming error for a beginner.
>
> **🔴 The practical rule: one edit then run**
> If your child edits three commands at once and it works, they **do not know which was the mistake** — and will not avoid it next time. Success without knowing the cause is not learning.
>
> The challenge at the end of the episode **requires a single edit**; it does not merely suggest one.
>
> **🔴 Robo's right is not the screen's right**
> The most important confusion in the episode. If Robo faces down, its right is to the **left** of the screen. The strategy the episode teaches: "**imagine you are standing in its place.**"
>
> And if you see them get the direction wrong, do not correct it. **Ask them to stand and face the same way as Robo** and raise their right hand. The body resolves this confusion faster than any explanation.
>
> **And a turn is not a step**
> Robo turns in place and does not advance a tile. Many children count it as a step and miscount.
>
> **What mirrors this on another planet**
> In the episode [plant responsibility](../../04-qiyam/hekaya-wa-hikma/ep-04-plant-responsibility.md), the child learns that "I'll try to remember" is not a solution, but building a system is. And here they learn that "I'll keep trying until it works" is not a solution, but reading your program is.
>
> **The idea is one across both planets: replacing randomness with a method.**
>
> **If they say "it doesn't work"?**
> Ask one question: "**Which command first went off course?**" And do not look at the screen before they answer.
>
> The episode is `independent` and does not need your supervision. And if they want to explain to you how they found the error, **listen** — the explanation is the strongest proof of understanding.

---

## Family Activity — optional

> **A planted error — 10 minutes · no screen**
>
> 1. **You** write commands to move your child around the room: move · turn right · move.
> 2. 🔴 **Plant one logic error**: place the turn **before its time** by one step.
> 3. Your child executes the commands **literally** — the way Robo does.
> 4. When they stop in the wrong place, they read the commands and locate the **first** deviation.
> 5. They fix it **with a single edit**, then run again.
> 6. Swap roles: they plant the error, and you execute.
>
> 🔴 **The condition: one error only.** Two errors make tracing confusing at this age.
>
> 🔴 **And you do not tell them where the error is.** If they get stuck, guide them with a question: "Where did you end up after the second command?" — the question returns them to tracing.
>
> **The sixth round is more important than the first.** Planting the error needs deeper understanding than finding it.
>
> ⚠️ **Clear the floor of obstacles**, mark a clear space, and no running.

---

## Linked Game

`bc-first-steps` · engine [`block_code`](../../../../games/engines/10-block-code.md) · **Level 2**

| # | Value |
|---|---|
| grid | 5×5 |
| blocks | `move` · `turn_left` · `turn_right` |
| optimal_blocks | 10 |
| — | 6 |
| obstacles | 1 |

🔴 **A "step back" button is always available** — and it is what makes "a single edit" practically possible. [game packs](../game-packs.md#bc-first-steps).

---

## Required Assets

| # | Type | Description |
|---|---|---|
| 1 | video | episode master |
| 2 | image | 16:9 thumbnail |
| 3 | subtitles | VTT |
| 4 | image | 🔴 Robo directions *(shared)* |
| 5 | motion | 🔴 turn in place ≤ 400ms *(shared)* |
| 6 | image | light states · 🔴 no red *(shared)* |
| 7 | image | 5×5 grid · 🔴 do not mirror |
| 8 | image | 🔴 obstacle with a **clear shape** + frame |
| 9 | image | 🔴 two icons **without text** |
| 10 | image | 🔴 Robo in four directions + its right-arrow |
| 11 | image | 🔴 symbolic intersection · no vehicles |
| 12 | image | command in the wrong place *(the answer)* |
| 13 | image | wrong command *(half-right distractor)* |
| 14 | image | 🔴 slow Robo *(distractor — tests the character rule)* |
| 15 | image | its right = the screen's left *(the answer)* |
| 16 | image | 🔴 the screen's right *(the intuitive distractor)* |
| 17 | image | the top of the screen *(distractor)* |
| 18 | image | the four-word sequence *(shared)* |
| 19 | audio | the two questions |

> 🔴 **Rejected** — any asset containing: Robo with a face · a red light · a mirrored grid · baked-in text on a block · a turn with tile translation · a violent collision or deformation · vehicles in the street example · a red error mark.
>
> 🔴 `asset-rc-ep2-direction-chart` is a **mandatory asset** — without it the directional confusion is left without visual treatment.

---

## Translation Keys

```
rc.ep2.title        = Fix the Path
rc.ep2.description  = A turn in the wrong place, and how to find the error without guessing
rc.ep2.q1           = What kind of error is in Robo's program?
rc.ep2.q2           = Robo faces down. Where is its right?
rc.term.logic_error = logic error
rc.term.debug       = debugging
rc.block.turn_left  = turn left
rc.block.turn_right = turn right
rc.ep2.direction    = Robo's right is not the screen's right. It is Robo's own right.
rc.ep2.closing      = The directions were not wrong. The place was wrong.
```

### Localization Contract

| # | Rule |
|---|---|
| 1 | 🔴 `ar` **explicitly declared** as source |
| 2 | 🔴 fixed across the series · no synonyms |
| 3 | **reviewed in every language** — some languages describe direction relative to the viewer by default |
| 4 | from the subtitle file · 🔴 no text in the image |
| 5 | text is mirrored · 🔴 **the grid and the direction arrow are not** |
| 6 | preserves the contrast between "directions" and "place" |
| 7 | 🔴 reviewed per market · with no specific local traffic signs |

> 🔴 **If a language uses an expression meaning "turn toward the right of the image," the block is re-authored entirely** — not translated literally. Direction relative to Robo is a **correctness condition, not a style preference**.

---

## Acceptance Criteria

- [ ] Duration 360 seconds ±15.
- [ ] **39 lines** · each line ≤ 14 words.
- [ ] 🔴 **one concept**: the logic error and debugging · two new blocks · two terms.
- [ ] 🔴 **Robo's right** is shown **visually in four states**, not just stated.
- [ ] 🔴 the sentence **"A turn does not move Robo one tile"** is present.
- [ ] 🔴 **"stop and predict" with 6 seconds of silence** · and the question is "which command will stop it."
- [ ] 🔴 **the run fails first** · and the failure is from **place** not a wrong command.
- [ ] 🔴 the sentence **"There is no wrong command in this program"** is present.
- [ ] 🔴 the sentence **"But the turn came before its time"** is present.
- [ ] 🔴 **the two terms are named after seeing the concept**, not before.
- [ ] 🔴 **the fix is a single edit**: inserting one `move` — without deleting the program.
- [ ] 🔴 the four-word sequence **in the same words and rhythm as episode 1**.
- [ ] 🔴 **the challenge requires a single edit**.
- [ ] 🔴 **Robo does not talk, slow down, or get confused** · no face.
- [ ] 🔴 **no red light** · the yellow comes with a shape marker · the obstacle has a shape + frame.
- [ ] 🔴 **turn in place with no translation** ≤ 400ms.
- [ ] 🔴 **the grid and the direction arrow are not mirrored in RTL**.
- [ ] Generalization is **one example**, symbolic · no vehicles or invitation to go out.
- [ ] 🔴 the `screen-right` distractor is **present** in the second question.
- [ ] The family activity 🔴 **one planted error** · the parent **does not reveal its place** · and includes role swapping.
- [ ] 🔴 **concept review** signed off.
- [ ] 🔴 **RTL direction review** signed off — including `rc.ep2.direction` in every language.
- [ ] **Language review** for term stability.
