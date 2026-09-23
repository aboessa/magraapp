# Robo Codes — Episode 4: If and Else (English Edition)

## Localization Card

| Field | Value |
|---|---|
| `locale` | `en` |
| `translated_from` | `ar` |
| `source_path` | `docs/content/planets/06-maharat/robo-codes/ep-04-if-else.md` |
| `is_machine_translated` | false |
| `status` | `review_lang` |
| `review_state` | `pending` |
| `language_reviewer_id` | `` |
| `edition_type` | `localized_draft` |

## Episode Card

| Field | Value |
|---|---|
| `series_id` | `robo-codes` |
| `episode_number` | 4 |
| `title_en` | If and Else |
| `description_en` | A question asked once, and two paths coming out of it |
| `duration_seconds` | 390 *(6:30)* |
| `age_min` / `age_max` | 9 / 12 |
| `reading_level` | `independent` |
| `interaction_mode` | `independent` |
| `supervision_level` | `optional` |
| `difficulty` | `hard` |
| `is_free` | 0 |
| `learning_objective_id` | `skill.ct.condition` |
| `linked_game_id` | `bc-conditions` · Level 4 |
| `status` | `draft` |
| `linked_planets` | 🔗 `oloom` |
| `safety_notes` | Not applicable |

## The Mission

A 6×6 grid with three obstacles. The path in front of Robo **may be open and may not be**, depending on its position. The new block: `if_path`.

## The Concept

**The condition:** a question checked **in a single moment**, with two answers leading to two paths.

## Learning Objective

**One goal:** the child understands that the condition **is checked the moment it is reached**, and does not wait for the state to change.

Criterion: predicts Robo's path in both states of the condition, and explains that Robo does not wait, in 3 of 4 tries.

## Terms Introduced

| Term | Symbol | Definition in the episode |
|---|---|---|
| **condition** | `if` | a question whose answer is yes or no |
| **the other case** | — | what Robo does if the answer is no |

## Carried Over

**command · sequence · repetition · logic error · debugging · the four-word sequence.**

---

## 🔴 This is the most conceptually dangerous episode on the planet

| The misconception | Its form for the child | What it produces |
|---|---|---|
| 🔴 **"if" means "wait until"** | "Robo stands until the path opens" | expects a behavior that never happens |
| "the condition is checked always" | "Robo watches the path all the time" | confuses the condition with continuous monitoring |
| "the condition has one answer" | writes `if` without thinking about "no" | a program that stops for no clear reason |

> 🔴 **"If means wait until" is the first misconception in teaching conditions, and this whole episode is built to prevent it.**
>
> The reason is linguistic: "if the path is open" in Arabic *(and in English)* carries a temporal possibility. And the child hears it as a promise: **whenever it opens, move forward**.
>
> The truth is that the condition is **instantaneous**: the question is asked upon reaching the block, the path is taken, **and that is the end of it**. If the path was blocked at that moment, whether it opened afterward or not, it makes no difference.
>
> **And the way the episode prevents it is not a statement but a demonstration:** both states are run on the same screen, and a state is shown where the path stays blocked **and Robo does not wait for it**.

## 🔴 The planet's seventh rule: no condition without the other case

| ❌ rejected demonstration | ✅ the demonstration used |
|---|---|
| running only the successful case | 🔴 **running both cases** |
| "if it is open, move forward" then done | "and if it is not? **it turns**" |
| leaving "no" without a defined behavior | 🔴 every condition has **two drawn behaviors** |

> 🔴 **A condition without the other case is not a condition but a wish.** A child who learns `if` only from the successful case writes programs that stop and does not know why.
>
> And the rule is applied even at the visual level: **the two paths are drawn together** on the grid before running.

---

## Full Script

### Scene 1 — Opening and Mission (part 1/6) · 0:00–0:10

**Shot:** 6×6 grid from above. Robo bottom-left. Three obstacles distributed, one of them in the middle of the straight path.

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | Music: 🔴 5-second signature |
| 0.8s | narrator | Narrator: "Today there are three obstacles, and one path is not enough." |
| 2.2s | sfx | SFX: the three obstacles are highlighted with a shape frame |
| 2.7s | narrator | Narrator: "In some positions the path in front of Robo is open." |
| 4s | narrator | Narrator: "And in others it is blocked." |
| 4.9s | — | pause |
| 5.2s | narrator | Narrator: "And you do not know beforehand in which position it will be." |
| 6.4s | sfx | SFX: a new block appears in the panel |
| 6.9s | narrator | Narrator: "So you need a command that asks: is the path open?" |
| 8.2s | narrator | Narrator: "This command is called: a condition." |
| 9.2s | narrator | Narrator: "And in programming it is written: if." |

---

### Scene 2 — Opening and Mission (part 2/6) · 0:10–0:20

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And in others it is blocked." |
| 3.3s | Luna | says: "And you do not know beforehand in which position it will be." |

---

### Scene 3 — Opening and Mission (part 3/6) · 0:20–0:30

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "So you need a command that asks: is the path open?" |
| 3.3s | Luna | says: "This command is called: a condition." |

---

### Scene 4 — Opening and Mission (part 4/6) · 0:30–0:40

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And in programming it is written: if." |

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

### Scene 7 — The Term and the Two Paths (part 1/7) · 1:00–1:10

**Shot:** `asset-rc-term-frame`. The condition block, and from it two drawn branches: a "yes" branch and a "no" branch.

| Time | Audio | Verbatim text |
|---|---|---|
| 4.5s | narrator | Narrator: "A condition is a question whose answer is yes or no." |
| 5s | sfx | SFX: the two branches appear from the block |
| 5.2s | narrator | Narrator: "If the path is open: move forward." |
| 5.7s | sfx | SFX: the first branch is highlighted |
| 5.9s | narrator | Narrator: "And if it is not open: turn right." |
| 6.5s | sfx | SFX: the second branch is highlighted |
| 6.8s | — | pause |
| 6.9s | narrator | Narrator: "Every condition has two answers. And every answer has a path." |
| 7.5s | — | pause 3s |
| 7.7s | narrator | Narrator: "And a very important item." |
| 8.1s | narrator | Narrator: "Robo asks once, the moment it reaches the condition." |
| 8.8s | narrator | Narrator: "It does not wait for the path to open." |
| 9.2s | narrator | Narrator: "It asks, takes its path, and moves on." |

---

### Scene 8 — The Term and the Two Paths (part 2/7) · 1:10–1:20

**Shot:** Continuation — seamless. (Part 2/7)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And if it is not open: turn right." |
| 3.3s | Luna | says: "Every condition has two answers. And every answer has a path." |

---

### Scene 9 — The Term and the Two Paths (part 3/7) · 1:20–1:30

**Shot:** Continuation — seamless. (Part 3/7)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And a very important item." |
| 3.3s | Luna | says: "Robo asks once, the moment it reaches the condition." |

---

### Scene 10 — The Term and the Two Paths (part 4/7) · 1:30–1:40

**Shot:** Continuation — seamless. (Part 4/7)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "It does not wait for the path to open." |
| 3.3s | Luna | says: "It asks, takes its path, and moves on." |

---

### Scene 11 — The Term and the Two Paths (part 5/7) · 1:40–1:50

**Shot:** Continuation — seamless. (Part 5/7)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 12 — The Term and the Two Paths (part 6/7) · 1:50–2:00

**Shot:** Continuation — seamless. (Part 6/7)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 13 — The Term and the Two Paths (part 7/7) · 2:00–2:10

**Shot:** Continuation — seamless. (Part 7/7)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 14 — 🔴 Stop and Predict (part 1/2) · 2:10–2:20

**Shot:** `asset-rc-predict-frame`. The program is shown, and the path in front of Robo is blocked by a clear obstacle.

| Time | Audio | Verbatim text |
|---|---|---|
| 8.1s | sfx | SFX: 🔴 the music stops completely |
| 8.2s | narrator | Narrator: "The path in front of Robo is blocked now." |
| 8.6s | narrator | Narrator: "And the condition says: if it is open, move forward." |
| 9s | narrator | Narrator: "What will it do?" |
| 9.2s | — | 🔴 total silence, 6 seconds |

---

### Scene 15 — 🔴 Stop and Predict (part 2/2) · 2:20–2:30

**Shot:** Continuation — seamless. (Part 2/2)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "What will it do?" |

---

### Scene 16 — The Run (part 1/9) · 2:30–2:40

**Shot:** The grid, the program, and the two paths drawn with dashed lines before running.

| Time | Audio | Verbatim text |
|---|---|---|
| 5.9s | sfx | SFX: the light is pulsing blue · cursor on the condition block |
| 6s | narrator | Narrator: "Robo reached the condition. Now it asks." |
| 6.3s | sfx | SFX: 🔴 a shape question mark appears for one instant |
| 6.4s | narrator | Narrator: "Is the path open? No. The obstacle is in front of it." |
| 6.7s | sfx | SFX: says "no" |
| 6.9s | narrator | Narrator: "So it took the other path: turn right." |
| 7.2s | — | pause |
| 7.3s | narrator | Narrator: "And it did not stand and wait. It asked once, and moved on." |
| 7.6s | — | pause 3s |
| 7.7s | sfx | SFX: Robo advances on the new path then stops · the light is yellow · a shape marker |
| 7.9s | narrator | Narrator: "Then it advanced, and stopped. It did not reach the goal." |
| 8.3s | — | pause |
| 8.3s | narrator | Narrator: "The condition worked as written." |
| 8.6s | narrator | Narrator: "But the other path was not written completely." |
| 8.9s | narrator | Narrator: "We wrote the turn, and forgot what comes after it." |
| 9.2s | — | pause |

---

### Scene 17 — The Run (part 2/9) · 2:40–2:50

**Shot:** Continuation — seamless. (Part 2/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Is the path open? No. The obstacle is in front of it." |

---

### Scene 18 — The Run (part 3/9) · 2:50–3:00

**Shot:** Continuation — seamless. (Part 3/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "No" |

---

### Scene 19 — The Run (part 4/9) · 3:00–3:10

**Shot:** Continuation — seamless. (Part 4/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "So it took the other path: turn right." |

---

### Scene 20 — The Run (part 5/9) · 3:10–3:20

**Shot:** Continuation — seamless. (Part 5/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And it did not stand and wait. It asked once, and moved on." |

---

### Scene 21 — The Run (part 6/9) · 3:20–3:30

**Shot:** Continuation — seamless. (Part 6/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Then it advanced, and stopped. It did not reach the goal." |

---

### Scene 22 — The Run (part 7/9) · 3:30–3:40

**Shot:** Continuation — seamless. (Part 7/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The condition worked as written." |

---

### Scene 23 — The Run (part 8/9) · 3:40–3:50

**Shot:** Continuation — seamless. (Part 8/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "But the other path was not written completely." |

---

### Scene 24 — The Run (part 9/9) · 3:50–4:00

**Shot:** Continuation — seamless. (Part 9/9)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "We wrote the turn, and forgot what comes after it." |

---

### Scene 25 — Debugging (part 1/6) · 4:00–4:10

**Shot:** Split. The program with its two branches, and the two paths on the grid.

| Time | Audio | Verbatim text |
|---|---|---|
| 7.5s | narrator | Narrator: "Read, trace, locate, and fix." |
| 7.7s | sfx | SFX: says "yes" |
| 7.8s | narrator | Narrator: "The yes branch: move forward to the goal. Complete." |
| 8s | sfx | SFX: says "no" |
| 8.1s | narrator | Narrator: "And the no branch: turn. Then nothing." |
| 8.3s | — | pause |
| 8.4s | narrator | Narrator: "Here is the first deviation. The second branch is incomplete." |
| 8.6s | sfx | SFX: says "no" |
| 8.8s | narrator | Narrator: "We added a repeat inside the no branch. One edit." |
| 9.1s | sfx | SFX: re-run · Robo takes the second path · the light is green |
| 9.2s | narrator | Narrator: "It arrived. And both branches are now complete." |

---

### Scene 26 — Debugging (part 2/6) · 4:10–4:20

**Shot:** Continuation — seamless. (Part 2/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "The yes branch: move forward to the goal. Complete." |
| 3.3s | Luna | says: "No" |

---

### Scene 27 — Debugging (part 3/6) · 4:20–4:30

**Shot:** Continuation — seamless. (Part 3/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And the no branch: turn. Then nothing." |
| 3.3s | Luna | says: "Here is the first deviation. The second branch is incomplete." |

---

### Scene 28 — Debugging (part 4/6) · 4:30–4:40

**Shot:** Continuation — seamless. (Part 4/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "We added a repeat inside the no branch. One edit." |
| 3.3s | Luna | says: "It arrived. And both branches are now complete." |

---

### Scene 29 — Debugging (part 5/6) · 4:40–4:50

**Shot:** Continuation — seamless. (Part 5/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 30 — Debugging (part 6/6) · 4:50–5:00

**Shot:** Continuation — seamless. (Part 6/6)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 31 — Generalization (part 1/5) · 5:00–5:10

**Shot:** One symbolic shot: a door, in two states — open and closed — and two arrows.

| Time | Audio | Verbatim text |
|---|---|---|
| 8s | narrator | Narrator: "You use a condition every day without naming it." |
| 8.3s | sfx | SFX: symbol: an open door · an arrow to enter |
| 8.3s | narrator | Narrator: "If the door is open, you enter." |
| 8.5s | sfx | SFX: 🔴 a closed door · an arrow to knock |
| 8.6s | narrator | Narrator: "And if it is closed, you knock." |
| 8.8s | — | pause |
| 8.8s | narrator | Narrator: "And you do not stand in front of it doing nothing." |
| 9s | narrator | Narrator: "Because you know what to do in both cases." |
| 9.2s | narrator | Narrator: "This is the condition." |

---

### Scene 32 — Generalization (part 2/5) · 5:10–5:20

**Shot:** Continuation — seamless. (Part 2/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And if it is closed, you knock." |
| 3.3s | Luna | says: "And you do not stand in front of it doing nothing." |

---

### Scene 33 — Generalization (part 3/5) · 5:20–5:30

**Shot:** Continuation — seamless. (Part 3/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Because you know what to do in both cases." |
| 3.3s | Luna | says: "This is the condition." |

---

### Scene 34 — Generalization (part 4/5) · 5:30–5:40

**Shot:** Continuation — seamless. (Part 4/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 35 — Generalization (part 5/5) · 5:40–5:50

**Shot:** Continuation — seamless. (Part 5/5)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

### Scene 36 — Challenge and Closing (part 1/4) · 5:50–6:00

**Shot:** `asset-rc-challenge-frame`. A 6×6 grid, the obstacle position unknown until running.

| Time | Audio | Verbatim text |
|---|---|---|
| 8.4s | narrator | Narrator: "In today's challenge, the obstacle's position changes." |
| 8.6s | narrator | Narrator: "So you cannot write one fixed path." |
| 8.8s | — | pause |
| 8.8s | narrator | Narrator: "Use a condition, and write both branches together." |
| 9s | narrator | Narrator: "And before you run, ask yourself one question." |
| 9.2s | narrator | Narrator: "And if the answer is no, what does Robo do?" |

---

### Scene 37 — Challenge and Closing (part 2/4) · 6:00–6:10

**Shot:** Continuation — seamless. (Part 2/4)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "Use a condition, and write both branches together." |
| 3.3s | Luna | says: "And before you run, ask yourself one question." |

---

### Scene 38 — Challenge and Closing (part 3/4) · 6:10–6:20

**Shot:** Continuation — seamless. (Part 3/4)

| Time | Audio | Verbatim text |
|---|---|---|
| 0.8s | Luna | says: "And if the answer is no, what does Robo do?" |

---

### Scene 39 — Challenge and Closing (part 4/4) · 6:20–6:30

**Shot:** Continuation — seamless. (Part 4/4)

| Time | Audio | Verbatim text |
|---|---|---|
| 0s | music | calm melody |

---

## Storyboard — 7 shots

| # | Shot | Technique | Description | Duration |
|---|---|---|---|---:|
| 1 | Mission | top-down | three obstacles · the condition block · the symbol `if` | 60s |
| 2 | Term and the two paths | branching frame | 🔴 **two drawn branches** + the "asks once" item | 70s |
| 3 | **Stop and Predict** | 🔴 still frame | blocked path + condition + **silence** | 20s |
| 4 | The run | top-down + panel | 🔴 **the two paths drawn** · instantaneous check · incomplete branch | 90s |
| 5 | Debugging | split | comparing the branches · adding inside the "no" branch | 60s |
| 6 | Generalization | symbolic frame | open and closed door · two arrows | 50s |
| 7 | Challenge | frame | an obstacle with a changing position | 40s |

### Visual rules

| # | Rule |
|---|---|
| 1 | **drawn together** with dashed lines before running |
| 2 | a shape question mark for **one instant** ≤ 400ms then it disappears |
| 3 | **any implication of waiting**: a continuous pulse · turning in place · a timer · a clock |
| 4 | 🔴 visible with the **same prominence** as the "yes" branch — not a secondary branch |
| 5 | a branching icon + text from the translation · 🔴 no baked-in text |
| 6 | a clear shape + frame |
| 7 | 🔴 **no red** · the yellow comes with a shape marker |
| 8 | 🔴 symbolic · no realistic door or knocking hand |
| 9 | 🔴 shown **once** in scene 1 |

---

## Voiceover Recording Script

```
1.  Today there are three obstacles, and one path is not enough.
2.  In some positions the path in front of Robo is open.
3.  And in others it is blocked.
    [pause]
4.  And you do not know beforehand in which position it will be.
5.  So you need a command that asks: is the path open?
6.  This command is called: a condition.
7.  And in programming it is written: if.
8.  A condition is a question whose answer is yes or no.
9.  If the path is open: move forward.
10. And if it is not open: turn right.
    [pause]
11. Every condition has two answers. And every answer has a path.
    [pause 3s]
12. And a very important item.
13. Robo asks once, the moment it reaches the condition.
14. It does not wait for the path to open.
15. It asks, takes its path, and moves on.
16. The path in front of Robo is blocked now.
17. And the condition says: if it is open, move forward.
18. What will it do?
    [total silence, 6 seconds]
19. Robo reached the condition. Now it asks.
20. Is the path open? No. The obstacle is in front of it.
21. So it took the other path: turn right.
    [pause]
22. And it did not stand and wait. It asked once, and moved on.
    [pause 3s]
23. Then it advanced, and stopped. It did not reach the goal.
    [pause]
24. The condition worked as written.
25. But the other path was not written completely.
26. We wrote the turn, and forgot what comes after it.
    [pause]
27. Read, trace, locate, and fix.
28. The yes branch: move forward to the goal. Complete.
29. And the no branch: turn. Then nothing.
    [pause]
30. Here is the first deviation. The second branch is incomplete.
31. We added a repeat inside the no branch. One edit.
32. It arrived. And both branches are now complete.
33. You use a condition every day without naming it.
34. If the door is open, you enter.
35. And if it is closed, you knock.
    [pause]
36. And you do not stand in front of it doing nothing.
37. Because you know what to do in both cases.
38. This is the condition.
39. In today's challenge, the obstacle's position changes.
40. So you cannot write one fixed path.
    [pause]
41. Use a condition, and write both branches together.
42. And before you run, ask yourself one question.
43. And if the answer is no, what does Robo do?
```

**43 lines · each line ≤ 14 words.**

### Pronunciation notes

| # | Note |
|---|---|
| 1 | 🔴 ~130 wpm · calm and confident |
| 2 | "beforehand" clearly — it establishes the need |
| 3 | `if` pronounced in English **once** |
| 4 | 🔴 "and if it is not" **at the same size and tone** as line 9 — not a secondary branch |
| 5 | a pause between the two halves |
| 6 | 🔴 "once" with emphasis · and "the moment it reaches" slowly |
| 7 | 🔴 "does not wait" — **the clearest two words in the episode** |
| 8 | 🔴 three verbs in a **fast, successive** rhythm — the rhythm carries the meaning of instantaneity |
| 9 | tone of **reading a result**, not surprise |
| 10 | 🔴 said **after** seeing the turn — the confirmation comes after the evidence |
| 11 | a pause between them · "as written" with emphasis |
| 12 | the four-word sequence at the same rhythm as episodes 1–3 |
| 13 | "one edit" with emphasis |
| 14 | 🔴 "doing nothing" with emphasis — negating the waiting in an everyday context |
| 15 | 🔴 **the slowest line** · an 800ms pause before it · spoken as a real question |

> 🔴 **Forbidden:** any sentence saying "wait until" · any tone of suspense at line 20 · "well done" · "kids" · error sound · voicing Robo · pronouncing `if` more than once.

> 🔴 **Reinforced concept review:** lines 13, 14, 15, 22, 36 — all prevent "if = wait until." **This is the episode that most needs a computational-thinking reviewer sign-off on the planet.**

> ⚠️ **Language review:** "condition" · "branch" · "if" · "and if" · "beforehand" — and the stability of "yes branch" and "no branch."

---

## Comprehension Questions

```json
[
  {
    "id": "q1",
    "type": "image_choice",
    "prompt_audio": "asset-vo-rc-ep4-q1-en",
    "prompt_key": "rc.ep4.q1",
    "prompt_text": "The path is blocked the moment Robo reaches the condition. What does it do?",
    "options": ["asset-choice-takes-other-branch", "asset-choice-waits-for-open", "asset-choice-stops-forever"],
    "answer": "asset-choice-takes-other-branch"
  },
  {
    "id": "q2",
    "type": "image_choice",
    "prompt_audio": "asset-vo-rc-ep4-q2-en",
    "prompt_key": "rc.ep4.q2",
    "prompt_text": "What is missing in this condition?",
    "options": ["asset-choice-missing-else-branch", "asset-choice-missing-repeat", "asset-choice-wrong-question"],
    "answer": "asset-choice-missing-else-branch"
  }
]
```

> 🔴 **`waits-for-open` is the most important distractor on the entire planet.**
>
> It is the intuitive answer, and it is **the misconception the episode was built to prevent**. A child who rejects it has understood that the condition is instantaneous. And one who chooses it **needs to rewatch scene 4**, not the whole episode.
>
> ⚠️ **Technical item:** when this distractor is chosen, the hint shows **scene 4 alone**, not the full episode.
>
> The `stops-forever` distractor is **half-right**: Robo does indeed stop in the end, but **after it took the other path** — not out of waiting.

---

## Mastery Criterion

```
Rejects "waits for it to open," identifies the missing branch, and writes both branches on Level 4 — in 3 of 4 tries.
```

---

## Parent Guide

> **What is your child learning?**
> That a program can **ask a question** and act according to the answer. This is called a **condition**, written in programming as `if`.
>
> **🔴 And this is the most conceptually dangerous episode on the planet — read this part specifically**
>
> "If the path is open, move forward" is understood by most children as "**wait until the path opens**." The reason is linguistic, not intellectual: "if" carries a temporal possibility.
>
> **The truth is that the condition is instantaneous.** Robo asks **once** upon reaching the condition, takes its path, and moves on. If the path was blocked at that moment, whether it opened afterward or not, it makes no difference.
>
> That is why **we do not merely say it** in the episode: we place Robo in front of a blocked path, run it, and it is seen that **it did not stand** — it took the other path immediately.
>
> **🔴 And the question we want to stay with your child**
> The last sentence in the episode: "**And if the answer is no, what does Robo do?**"
>
> This question saves half the debugging in every conditional program they write afterward. And the program failed in the episode **for exactly this reason**: the "yes" branch was written completely, and the "no" branch incompletely.
>
> **No condition without the other case.** This is the planet's seventh rule, and it is the most practically useful thing in the episode.
>
> **If they ask: does Robo wait?**
> A suitable answer: "**No. It asks once and moves on. And if we wanted it to wait, that is another thing you learn later.**"
>
> And do not get into explaining conditional loops now. Separating "the condition" from "waiting" is enough at this age, and more only confuses.
>
> **What this means for you in practice**
> If they write a conditional program and it stops for no apparent reason, ask: "**What did you write in the 'no' case?**" — this is the most common cause at this age.
>
> **The episode is half a minute longer than the others** *(6:30)* on purpose: the condition needs two states shown, not one.

---

## Family Activity — optional

> **If and else — 10 minutes · no screen**
>
> 1. Agree on one condition: "**If the cup is on the table, put it in the sink. And if it is not, tidy the chair.**"
> 2. 🔴 **Write both cases on paper before starting.** Do not begin with an incomplete condition.
> 3. Your child leaves for a moment, and you put the cup out or take it away.
> 4. They come back, **look once**, and do what matches the state.
> 5. 🔴 **And they do not stand waiting for the state to change** — the single look is the condition.
> 6. Repeat it three times with different states, then swap roles.
>
> 🔴 **Steps 2 and 5 are the activity.** Writing both cases prevents the incomplete condition, and the single look prevents the "wait until" misconception.
>
> **And when you swap roles, ask them to write the condition themselves** — and discover together whether they forgot the "no" case.
>
> ⚠️ **No glass cups or hot liquids** · only safe, light objects.

---

## Linked Game

`bc-conditions` · engine [`block_code`](../../../../games/engines/10-block-code.md) · **Level 4**

| # | Value |
|---|---|
| grid | 6×6 |
| blocks | `move` · `turn_left` · `turn_right` · `repeat` · `collect` · `if_path` |
| optimal_blocks | 14 |
| — | 9 |
| obstacles | 3 |

🔴 **The pack unit requires writing both branches** before allowing a run on Level 4. [game packs](../game-packs.md#bc-conditions).

---

## Required Assets

| # | Type | Description |
|---|---|---|
| 1 | video | episode master |
| 2 | image | 16:9 thumbnail |
| 3 | subtitles | VTT |
| 4 | image · motion | Robo character *(shared)* |
| 5 | image | 6×6 grid · 🔴 do not mirror *(shared)* |
| 6 | image | 🔴 a **branching** condition icon without text |
| 7 | image | 🔴 **the two branches drawn with the same prominence** — mandatory asset |
| 8 | motion | 🔴 a shape question mark **≤ 400ms** then it disappears |
| 9 | image | 🔴 two paths in dashed lines on the grid |
| 10 | image | 🔴 an open and a closed door, **symbolic** · no hand |
| 11 | image | takes the other path *(the answer)* |
| 12 | image | 🔴 waits for it to open *(the most important distractor on the planet)* |
| 13 | image | stops forever *(half-right distractor)* |
| 14 | image | the "no" branch is missing *(the answer)* |
| 15 | image | a missing repeat *(distractor)* |
| 16 | image | the wrong question *(distractor)* |
| 17 | image | the four-word sequence *(shared)* |
| 18 | audio | the two questions |

> 🔴 **Rejected** — any asset containing: **any implication of waiting** *(a timer · a clock · a continuous pulse at the condition · Robo turning in place in front of the obstacle)* · a "no" branch smaller or dimmer than the "yes" branch · a check mark that stays on the screen · a red light · baked-in text on a block · a realistic door or a knocking hand.
>
> 🔴 `asset-rc-ep4-branch-diagram` and `asset-choice-waits-for-open` are **two mandatory assets** — the first embodies the seventh rule, and the second measures the most dangerous misconception on the planet.

---

## Translation Keys

```
rc.ep4.title        = If and Else
rc.ep4.description  = A question asked once, and two paths coming out of it
rc.ep4.q1           = The path is blocked the moment Robo reaches the condition. What does it do?
rc.ep4.q2           = What is missing in this condition?
rc.term.condition   = condition
rc.term.else_case   = the other case
rc.block.if_path    = if the path is open
rc.ep4.branch_yes   = yes branch
rc.ep4.branch_no    = no branch
rc.ep4.key          = Robo asks once, and does not wait for the path to open.
rc.ep4.closing      = And if the answer is no, what does Robo do?
```

### Localization Contract

| # | Rule |
|---|---|
| 1 | 🔴 `ar` **explicitly declared** as source |
| 2 | **not translated** · shown in English once |
| 3 | **reviewed in every language** — its wording must not carry the meaning of "wait until" |
| 4 | **mandatory in every language** · and it carries the negation explicitly: **does not wait** |
| 5 | mandatory · and stays a **question**, not a declarative sentence |
| 6 | two **fixed** terms across the series |
| 7 | "turn right" relative to **Robo** — [episode 2's rule](./ep-02-debug-path.md#-robos-right-is-not-your-right) |
| 8 | text is mirrored · 🔴 **the grid and the branch diagram are not** |
| 9 | reviewed locally · with no reference to others' homes |

> 🔴 **`rc.block.if_path` is the most dangerous translation key on the planet.**
>
> Some languages have two forms: one an instantaneous conditional, and another that carries waiting *(meaning "when" or "until")*. **The instantaneous conditional form is mandatory**, and any translation using the waiting form **is rejected entirely** — because it itself produces the misconception the episode was built to prevent.

---

## Acceptance Criteria

- [ ] Duration 390 seconds ±15 · 🔴 **longer than the others on purpose**.
- [ ] **43 lines** · each line ≤ 14 words.
- [ ] 🔴 **one concept**: the condition · one new block (`if_path`) · two terms.
- [ ] 🔴 **the two branches are drawn together** before running · 🔴 **and with the same prominence**.
- [ ] 🔴 the sentence **"Robo asks once, the moment it reaches the condition"** is present.
- [ ] 🔴 the sentence **"It does not wait for the path to open"** is present.
- [ ] 🔴 the sentence **"It asks, takes its path, and moves on"** with three instantaneous verbs.
- [ ] 🔴 the sentence **"And it did not stand and wait. It asked once, and moved on."** is said **after** seeing the turn.
- [ ] 🔴 **the "stop and predict" moment shows a blocked path** — it invokes the misconception.
- [ ] 🔴 **the failure from an incomplete "no" branch** — not from order or number.
- [ ] 🔴 the two sentences **"The condition worked as written" and "the other path was not written completely"** are present.
- [ ] 🔴 **the fix is a single edit** inside the "no" branch, **and uses `repeat`** from episode 3.
- [ ] 🔴 **the instantaneous check mark ≤ 400ms** then it disappears.
- [ ] 🔴 **no timer, no clock, no continuous pulse**, and no implication of waiting.
- [ ] 🔴 the generalization negates waiting in an everyday context: **"and you do not stand in front of it doing nothing"**.
- [ ] 🔴 the last line is a **question**: "and if the answer is no, what does Robo do?"
- [ ] 🔴 the `waits-for-open` distractor is **present** · and its hint shows **scene 4 alone**.
- [ ] 🔴 the symbol `if` is shown and pronounced **once**.
- [ ] 🔴 **Robo does not talk or wait** · no face · no red light.
- [ ] 🔴 **the grid and the branch diagram are not mirrored in RTL**.
- [ ] Direction is **relative to Robo**, and consistent with episode 2.
- [ ] The family activity 🔴 **writes both cases before starting** · and **a single look** not waiting · and no glass.
- [ ] 🔴 **reinforced computational-thinking review** signed off — the most necessary episode on the planet.
- [ ] 🔴 **review of the `rc.block.if_path` translation** in every language — rejecting the waiting form.
- [ ] 🔴 **RTL direction review** signed off.
