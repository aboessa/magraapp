-- 0060 — corrective per-page dwell_ms recomputation.
--
-- WHY: 0059 allocated dwell from a placeholder narration assumption
-- (5.5s/page). Re-measuring narration against the calibrated rate from the only
-- story with real audio (act-s1 / bird-home: 166 Arabic letters over 47.2s =
-- 3.52 letters/s, docs/content/narration-rate-calibration.json) showed real
-- narration ranges from 47s to 185s per story, so 9 of the 10 affected stories
-- landed outside their editorial target (report: `node tools/dwell_model.mjs report`).
--
-- MODEL (unchanged, see docs/content/planets/05-qisas/00-story-page-model.md):
--   duration_ms = actual narration asset duration ONLY (never stretched, never
--                 padded with silence in the WAV).
--   dwell_ms    = authored illustration viewing time AFTER narration completes.
--   estimatedExperienceMs (derived, never stored) =
--       SUM(duration_ms) + SUM(dwell_ms of pages 1..n-1) + (n-1) * 280ms
--   The reader does not auto-advance off the last page, so the last page's
--   dwell is authored viewing time and is excluded from the auto-turn estimate.
--
-- HOW: every value below is computed per page from that page's own narration
-- length and its position on the story arc (peak in the second third, stillness
-- at the end) by dashboard/api/tools/dwell_model.mjs. No blanket value is used:
-- pages inside one story differ, and stories with long narration correctly
-- receive shorter dwell.
--
-- Rows are addressed by stable page id, so re-ordering pages cannot mis-target.
-- Additive and idempotent: only dwell_ms is written, duration_ms is untouched.

PRAGMA foreign_keys = ON;

-- ant-journey — رحلة النملة — 12 pages — narration 129.8s (estimated) — target 245-275s — estimate 260.0s — PASS
UPDATE story_pages SET dwell_ms = 9500 WHERE id = 'page-ant-journey-001'; -- p1 narration 12.2s
UPDATE story_pages SET dwell_ms = 10100 WHERE id = 'page-ant-journey-002'; -- p2 narration 9.4s
UPDATE story_pages SET dwell_ms = 10100 WHERE id = 'page-ant-journey-003'; -- p3 narration 12.5s
UPDATE story_pages SET dwell_ms = 11200 WHERE id = 'page-ant-journey-004'; -- p4 narration 9.9s
UPDATE story_pages SET dwell_ms = 11300 WHERE id = 'page-ant-journey-005'; -- p5 narration 14.2s
UPDATE story_pages SET dwell_ms = 12600 WHERE id = 'page-ant-journey-006'; -- p6 narration 11.4s
UPDATE story_pages SET dwell_ms = 13000 WHERE id = 'page-ant-journey-007'; -- p7 narration 11.9s
UPDATE story_pages SET dwell_ms = 13000 WHERE id = 'page-ant-journey-008'; -- p8 narration 12.2s
UPDATE story_pages SET dwell_ms = 12500 WHERE id = 'page-ant-journey-009'; -- p9 narration 12.5s
UPDATE story_pages SET dwell_ms = 12200 WHERE id = 'page-ant-journey-010'; -- p10 narration 9.7s
UPDATE story_pages SET dwell_ms = 11600 WHERE id = 'page-ant-journey-011'; -- p11 narration 8.2s
UPDATE story_pages SET dwell_ms = 11600 WHERE id = 'page-ant-journey-012'; -- p12 narration 5.7s (last page — no auto-turn)

-- bird-home — بيت الطائر — 8 pages — narration 47.2s (MEASURED from audio) — target 150-170s — estimate 160.0s — PASS
UPDATE story_pages SET dwell_ms = 13200 WHERE id = 'page-bird-home-001'; -- p1 narration 5.5s
UPDATE story_pages SET dwell_ms = 13800 WHERE id = 'page-bird-home-002'; -- p2 narration 4.0s
UPDATE story_pages SET dwell_ms = 15200 WHERE id = 'page-bird-home-003'; -- p3 narration 6.0s
UPDATE story_pages SET dwell_ms = 17000 WHERE id = 'page-bird-home-004'; -- p4 narration 7.2s
UPDATE story_pages SET dwell_ms = 18100 WHERE id = 'page-bird-home-005'; -- p5 narration 6.6s
UPDATE story_pages SET dwell_ms = 17600 WHERE id = 'page-bird-home-006'; -- p6 narration 5.7s
UPDATE story_pages SET dwell_ms = 15900 WHERE id = 'page-bird-home-007'; -- p7 narration 6.6s
UPDATE story_pages SET dwell_ms = 15900 WHERE id = 'page-bird-home-008'; -- p8 narration 5.7s (last page — no auto-turn)

-- garden-secret — سرّ الحدائق — 12 pages — narration 129.0s (estimated) — target 255-280s — estimate 267.6s — PASS
UPDATE story_pages SET dwell_ms = 10000 WHERE id = 'page-garden-secret-001'; -- p1 narration 12.8s
UPDATE story_pages SET dwell_ms = 10700 WHERE id = 'page-garden-secret-002'; -- p2 narration 9.9s
UPDATE story_pages SET dwell_ms = 10900 WHERE id = 'page-garden-secret-003'; -- p3 narration 11.4s
UPDATE story_pages SET dwell_ms = 12000 WHERE id = 'page-garden-secret-004'; -- p4 narration 9.1s
UPDATE story_pages SET dwell_ms = 13000 WHERE id = 'page-garden-secret-005'; -- p5 narration 8.5s
UPDATE story_pages SET dwell_ms = 13800 WHERE id = 'page-garden-secret-006'; -- p6 narration 9.4s
UPDATE story_pages SET dwell_ms = 13800 WHERE id = 'page-garden-secret-007'; -- p7 narration 11.6s
UPDATE story_pages SET dwell_ms = 13800 WHERE id = 'page-garden-secret-008'; -- p8 narration 11.9s
UPDATE story_pages SET dwell_ms = 13100 WHERE id = 'page-garden-secret-009'; -- p9 narration 13.1s
UPDATE story_pages SET dwell_ms = 12600 WHERE id = 'page-garden-secret-010'; -- p10 narration 11.6s
UPDATE story_pages SET dwell_ms = 11800 WHERE id = 'page-garden-secret-011'; -- p11 narration 11.4s
UPDATE story_pages SET dwell_ms = 11800 WHERE id = 'page-garden-secret-012'; -- p12 narration 8.2s (last page — no auto-turn)

-- goodnight-toys — تصبح على خير يا ألعابي — 8 pages — narration 51.4s (estimated) — target 160-170s — estimate 165.1s — PASS
UPDATE story_pages SET dwell_ms = 13800 WHERE id = 'page-goodnight-toys-001'; -- p1 narration 5.1s
UPDATE story_pages SET dwell_ms = 13700 WHERE id = 'page-goodnight-toys-002'; -- p2 narration 7.1s
UPDATE story_pages SET dwell_ms = 15000 WHERE id = 'page-goodnight-toys-003'; -- p3 narration 7.1s
UPDATE story_pages SET dwell_ms = 17600 WHERE id = 'page-goodnight-toys-004'; -- p4 narration 5.4s
UPDATE story_pages SET dwell_ms = 18100 WHERE id = 'page-goodnight-toys-005'; -- p5 narration 6.8s
UPDATE story_pages SET dwell_ms = 18100 WHERE id = 'page-goodnight-toys-006'; -- p6 narration 5.7s
UPDATE story_pages SET dwell_ms = 15400 WHERE id = 'page-goodnight-toys-007'; -- p7 narration 8.0s
UPDATE story_pages SET dwell_ms = 15400 WHERE id = 'page-goodnight-toys-008'; -- p8 narration 6.3s (last page — no auto-turn)

-- lost-star — نجمة تائهة — 12 pages — narration 184.7s (estimated) — target 245-275s — estimate 259.9s — PASS
-- NOTE: narration here is the longest in the series, so dwell is deliberately
-- short (5.6–7.6s). Flagged for editorial review: either accept the shorter
-- pause or shorten the page text.
UPDATE story_pages SET dwell_ms = 5600 WHERE id = 'page-lost-star-001'; -- p1 narration 14.8s
UPDATE story_pages SET dwell_ms = 5700 WHERE id = 'page-lost-star-002'; -- p2 narration 15.1s
UPDATE story_pages SET dwell_ms = 5900 WHERE id = 'page-lost-star-003'; -- p3 narration 14.5s
UPDATE story_pages SET dwell_ms = 6100 WHERE id = 'page-lost-star-004'; -- p4 narration 17.0s
UPDATE story_pages SET dwell_ms = 6600 WHERE id = 'page-lost-star-005'; -- p5 narration 16.5s
UPDATE story_pages SET dwell_ms = 7000 WHERE id = 'page-lost-star-006'; -- p6 narration 17.0s
UPDATE story_pages SET dwell_ms = 7300 WHERE id = 'page-lost-star-007'; -- p7 narration 17.0s
UPDATE story_pages SET dwell_ms = 7600 WHERE id = 'page-lost-star-008'; -- p8 narration 14.2s
UPDATE story_pages SET dwell_ms = 7300 WHERE id = 'page-lost-star-009'; -- p9 narration 14.8s
UPDATE story_pages SET dwell_ms = 6800 WHERE id = 'page-lost-star-010'; -- p10 narration 15.3s
UPDATE story_pages SET dwell_ms = 6300 WHERE id = 'page-lost-star-011'; -- p11 narration 16.2s
UPDATE story_pages SET dwell_ms = 6300 WHERE id = 'page-lost-star-012'; -- p12 narration 12.2s (last page — no auto-turn)

-- moon-sleeps — القمر ينام — 8 pages — narration 47.7s (estimated) — target 150-160s — estimate 155.1s — PASS
UPDATE story_pages SET dwell_ms = 12900 WHERE id = 'page-moon-sleeps-001'; -- p1 narration 5.1s
UPDATE story_pages SET dwell_ms = 13200 WHERE id = 'page-moon-sleeps-002'; -- p2 narration 5.7s
UPDATE story_pages SET dwell_ms = 14400 WHERE id = 'page-moon-sleeps-003'; -- p3 narration 6.0s
UPDATE story_pages SET dwell_ms = 16000 WHERE id = 'page-moon-sleeps-004'; -- p4 narration 6.3s
UPDATE story_pages SET dwell_ms = 17300 WHERE id = 'page-moon-sleeps-005'; -- p5 narration 5.7s
UPDATE story_pages SET dwell_ms = 17000 WHERE id = 'page-moon-sleeps-006'; -- p6 narration 5.4s
UPDATE story_pages SET dwell_ms = 14600 WHERE id = 'page-moon-sleeps-007'; -- p7 narration 7.1s
UPDATE story_pages SET dwell_ms = 14600 WHERE id = 'page-moon-sleeps-008'; -- p8 narration 6.5s (last page — no auto-turn)

-- new-friend — صديق جديد — 12 pages — narration 128.4s (estimated) — target 240-265s — estimate 252.5s — PASS
UPDATE story_pages SET dwell_ms = 9000 WHERE id = 'page-new-friend-001'; -- p1 narration 12.2s
UPDATE story_pages SET dwell_ms = 9600 WHERE id = 'page-new-friend-002'; -- p2 narration 9.9s
UPDATE story_pages SET dwell_ms = 9900 WHERE id = 'page-new-friend-003'; -- p3 narration 10.5s
UPDATE story_pages SET dwell_ms = 10400 WHERE id = 'page-new-friend-004'; -- p4 narration 11.4s
UPDATE story_pages SET dwell_ms = 11800 WHERE id = 'page-new-friend-005'; -- p5 narration 8.0s
UPDATE story_pages SET dwell_ms = 11700 WHERE id = 'page-new-friend-006'; -- p6 narration 12.5s
UPDATE story_pages SET dwell_ms = 12400 WHERE id = 'page-new-friend-007'; -- p7 narration 11.6s
UPDATE story_pages SET dwell_ms = 12500 WHERE id = 'page-new-friend-008'; -- p8 narration 11.4s
UPDATE story_pages SET dwell_ms = 11800 WHERE id = 'page-new-friend-009'; -- p9 narration 13.1s
UPDATE story_pages SET dwell_ms = 11600 WHERE id = 'page-new-friend-010'; -- p10 narration 10.2s
UPDATE story_pages SET dwell_ms = 10300 WHERE id = 'page-new-friend-011'; -- p11 narration 12.8s
UPDATE story_pages SET dwell_ms = 10300 WHERE id = 'page-new-friend-012'; -- p12 narration 4.8s (last page — no auto-turn)

-- old-lantern — الفانوس القديم — 12 pages — narration 176.7s (estimated) — target 265-280s — estimate 272.6s — PASS
-- NOTE: long narration, so dwell is 6.8–9.7s — below the 10–18s bedtime
-- guideline. Flagged for editorial review.
UPDATE story_pages SET dwell_ms = 6800 WHERE id = 'page-old-lantern-001'; -- p1 narration 17.0s
UPDATE story_pages SET dwell_ms = 7100 WHERE id = 'page-old-lantern-002'; -- p2 narration 16.2s
UPDATE story_pages SET dwell_ms = 7500 WHERE id = 'page-old-lantern-003'; -- p3 narration 15.3s
UPDATE story_pages SET dwell_ms = 8000 WHERE id = 'page-old-lantern-004'; -- p4 narration 14.5s
UPDATE story_pages SET dwell_ms = 8900 WHERE id = 'page-old-lantern-005'; -- p5 narration 12.2s
UPDATE story_pages SET dwell_ms = 9200 WHERE id = 'page-old-lantern-006'; -- p6 narration 14.8s
UPDATE story_pages SET dwell_ms = 9300 WHERE id = 'page-old-lantern-007'; -- p7 narration 17.0s
UPDATE story_pages SET dwell_ms = 9700 WHERE id = 'page-old-lantern-008'; -- p8 narration 14.2s
UPDATE story_pages SET dwell_ms = 9300 WHERE id = 'page-old-lantern-009'; -- p9 narration 14.5s
UPDATE story_pages SET dwell_ms = 8500 WHERE id = 'page-old-lantern-010'; -- p10 narration 16.8s
UPDATE story_pages SET dwell_ms = 8500 WHERE id = 'page-old-lantern-011'; -- p11 narration 10.5s
UPDATE story_pages SET dwell_ms = 8500 WHERE id = 'page-old-lantern-012'; -- p12 narration 13.6s (last page — no auto-turn)

-- rainy-night — ليلة المطر — 12 pages — narration 134.1s (estimated) — target 240-255s — estimate 247.6s — PASS
UPDATE story_pages SET dwell_ms = 8300 WHERE id = 'page-rainy-night-001'; -- p1 narration 11.9s
UPDATE story_pages SET dwell_ms = 8800 WHERE id = 'page-rainy-night-002'; -- p2 narration 9.9s
UPDATE story_pages SET dwell_ms = 8900 WHERE id = 'page-rainy-night-003'; -- p3 narration 11.9s
UPDATE story_pages SET dwell_ms = 9700 WHERE id = 'page-rainy-night-004'; -- p4 narration 10.2s
UPDATE story_pages SET dwell_ms = 10400 WHERE id = 'page-rainy-night-005'; -- p5 narration 10.5s
UPDATE story_pages SET dwell_ms = 11100 WHERE id = 'page-rainy-night-006'; -- p6 narration 10.8s
UPDATE story_pages SET dwell_ms = 11200 WHERE id = 'page-rainy-night-007'; -- p7 narration 12.5s
UPDATE story_pages SET dwell_ms = 11300 WHERE id = 'page-rainy-night-008'; -- p8 narration 12.5s
UPDATE story_pages SET dwell_ms = 10700 WHERE id = 'page-rainy-night-009'; -- p9 narration 13.4s
UPDATE story_pages SET dwell_ms = 10100 WHERE id = 'page-rainy-night-010'; -- p10 narration 13.1s
UPDATE story_pages SET dwell_ms = 9900 WHERE id = 'page-rainy-night-011'; -- p11 narration 9.7s
UPDATE story_pages SET dwell_ms = 9900 WHERE id = 'page-rainy-night-012'; -- p12 narration 7.7s (last page — no auto-turn)

-- warm-hugs — أحضان الدفء — 8 pages — narration 47.7s (estimated) — target 155-170s — estimate 162.5s — PASS
UPDATE story_pages SET dwell_ms = 14200 WHERE id = 'page-warm-hugs-001'; -- p1 narration 4.3s
UPDATE story_pages SET dwell_ms = 13700 WHERE id = 'page-warm-hugs-002'; -- p2 narration 6.8s
UPDATE story_pages SET dwell_ms = 15600 WHERE id = 'page-warm-hugs-003'; -- p3 narration 5.7s
UPDATE story_pages SET dwell_ms = 17100 WHERE id = 'page-warm-hugs-004'; -- p4 narration 6.3s
UPDATE story_pages SET dwell_ms = 18400 WHERE id = 'page-warm-hugs-005'; -- p5 narration 6.0s
UPDATE story_pages SET dwell_ms = 18100 WHERE id = 'page-warm-hugs-006'; -- p6 narration 5.7s
UPDATE story_pages SET dwell_ms = 15700 WHERE id = 'page-warm-hugs-007'; -- p7 narration 6.8s
UPDATE story_pages SET dwell_ms = 15700 WHERE id = 'page-warm-hugs-008'; -- p8 narration 6.3s (last page — no auto-turn)
