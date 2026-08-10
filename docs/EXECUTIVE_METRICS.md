# Executive dashboard — metric verification matrix

`GET /api/v1/admin/dashboard/executive` (`dashboard/api/src/routes/adminExecutive.ts`) serves
**11 modules and 48 metrics**. Every one of them is listed below with the source it reads, the
classification it earned, and where a click on it lands.

## What the classifications mean

**VERIFIED** — the metric was checked against the real local D1 database in this session, not
reasoned about. For each one, the equivalent SQL was run directly with
`npx wrangler d1 execute majarra-db --local --command "…"` and the number compared to the
number the live endpoint returned over HTTP; where an admin list endpoint can express the same
predicate, the list total was compared too (`drill_match: exact` in the payload, asserted by
`scripts/verify-executive-e2e.mjs`). The cross-check statements are in the appendix.

**UNAVAILABLE BY DESIGN** — the number cannot be computed from real data, so the payload emits
`value: null` with a reason in the metric's own `unavailable` field. It never emits `0`.
"There are none" and "we cannot tell" lead to opposite decisions, and a dashboard that renders
them identically is worse than one that omits the row.

**BROKEN** — the metric was wrong when this session started, in the number, the filter, the
stated period, the label, or the destination. Every one listed as BROKEN has been fixed in
`adminExecutive.ts`; the "note" column says what was wrong and what it now does. A metric is
also BROKEN when its number was right but its drill-down opened a list that did not contain
the counted set, because the follow-up question ("which ones?") then has no answer.

Counts: **23 VERIFIED · 2 UNAVAILABLE BY DESIGN · 23 BROKEN (all fixed)**.

## How a drill-down is verified

The `drill` field is an admin screen path. The `drill_api` field is the admin **list request**
that reproduces the same set, and `drill_match` says whether it is `exact` (the list returns
the same number) or `related` (the endpoint cannot express the predicate — in which case
`note` is mandatory and the compiler enforces it). `scripts/verify-executive-e2e.mjs` calls
every `drill_api` over HTTP, requires 200, and requires every `exact` metric to equal its
list. 18 of the 48 metrics are exactly reproducible today.

One residual gap, outside this file's ownership: only `/website/pages`, `/blog/posts`, `/seo`
and `/calendar` read their filters from the URL (`useUrlListState`). `/support-center`,
`/production`, `/workflows`, `/rights`, `/customers`, `/children`, `/devices-admin`,
`/failed-events`, `/audit-logs`, `/series`, `/episodes`, `/stories` and `/games-ops` ignore
query parameters, so a correct filter in `drill` still opens an unfiltered screen until each
page is wired. This is stated in the payload's own `limits`. The parameter **names** in every
`drill` are now names the corresponding list endpoint honours, so wiring a page cannot produce
a filter the API rejects.

---

## Support — `support_tickets`

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `open` | Open and in progress | `support_tickets.status IN ('open','in_progress')` | BROKEN | `/support-center?live=1` → `GET /admin/support/tickets?live=1` (related) | Drilled to `?status=open`, a **subset** of what it counted, so the list was always smaller than the number. The list endpoint filters one status or `live=1` (not settled); `live=1` is now the destination and the note states it also includes `waiting_customer`. Cross-check: 15. |
| `first_response_breached` | First-response SLA breached | `support_tickets`, first response unanswered past its deadline | BROKEN | `/support-center?live=1` → `GET /admin/support/tickets?live=1` (related) | **Reported 0 while 7 tickets were in breach.** `first_response_due_at < datetime('now')` compares an ISO stamp (`2026-08-10T18:09:01.397Z`) with SQLite's `2026-08-10 21:53:44` as text; `T` (0x54) sorts above the space (0x20), so every breach inside the current UTC day was invisible. Now uses `SQL_DEADLINE_PASSED` from `lib/supportCrm.ts` — the same predicate the ticket list uses. Cross-check: raw predicate 0, normalised predicate 7, endpoint now 7. |
| `resolution_breached` | Resolution SLA breached | `support_tickets`, unresolved past the resolution deadline, `waiting_customer` excluded | BROKEN | `/support-center?overdue=1` → `GET /admin/support/tickets?overdue=1` (exact) | Same text-comparison defect, plus `?overdue=resolution`, a value the list endpoint does not understand, so it landed unfiltered. Predicate is now identical to the list's `overdue=1`, making the number and the list provably the same set. Cross-check: 0 (no resolution deadline has passed on an unsettled ticket). |
| `escalated` | Escalated | `escalated_at IS NOT NULL` and not settled | BROKEN | `/support-center?live=1` → `GET /admin/support/tickets?live=1` (related) | Drilled to `?status=open` while counting escalations across `open` and `in_progress`; the filter did not select the counted set. Cross-check: 8. |
| `unassigned` | Unassigned | `assignee_id IS NULL` and not settled | BROKEN | `/support-center?live=1` → `GET /admin/support/tickets?live=1` (related) | Same wrong `?status=open` filter. The list's `assignee_id` filter needs a value, so "no assignee" cannot be requested — stated in `note` instead of implied by a filter that does nothing. Cross-check: 15. |
| `waiting_customer` | Waiting on customer | `status = 'waiting_customer'` | VERIFIED | `/support-center?status=waiting_customer` → same (exact) | Cross-check: 0. |

## Production — `production_requirements`

`production_requirements` is the human layer only: assignee, team, due date, blocker, note.
There is no completion column — completion is derived per item from artefacts in
`lib/productionMatrix.ts` — which constrains what this module can honestly say.

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `blocked` | Requirements with a declared blocker | `blocker` non-empty | VERIFIED | `/production` → `GET /admin/production/board?type=episode&with_publish=0` (related) | Label sharpened to say the blocker is human-declared. Now also excludes requirements on test-fixture content. Cross-check: 0. |
| `overdue` | Requirements past their due date | `due_at` in the past | BROKEN | `/production` → production board (related) | Two defects. (1) `due_at < datetime('now')` — the same raw ISO text comparison; `due_at` is written as ISO by `PUT /admin/production/:type/:id/:requirement`. (2) The label read as "late work", but this table cannot tell done from not-done, so a met requirement with a past due date counted as overdue. Relabelled to what it measures, with the limitation in `note` and in `limits`. Cross-check: 0 raw, 0 normalised (the only due date is 2026-08-17, in the future). |
| `unowned` | Without an owner | `assignee_id IS NULL AND team_id IS NULL` | VERIFIED | `/production` → production board (related) | Cross-check: 2. |
| `tracked_items` | Items with human tracking | `COUNT(DISTINCT content_id)` | BROKEN | `/production` → production board (related) | Labelled "Items tracked", which reads as items in the production pipeline — it said **1** while 117 episodes were in production. It counts items with at least one annotation row. Relabelled. Cross-check: 1 distinct `content_id`, versus 117 from the board. |

## Review and governance — `workflow_runs` · `workflow_run_stages` · `content_reviews`

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `running` | Runs in progress | `workflow_runs.status = 'running'` | VERIFIED | `/workflows` → `GET /admin/workflows/runs` (related) | The runs list takes no status filter, so the destination is wider than the count; stated in `note`. Cross-check: 0. |
| `overdue_stages` | Stages past their due date | `workflow_run_stages` past due on a running run | BROKEN | `/workflows` → `GET /admin/workflows/overdue` (related) | Same raw ISO comparison, and the predicate did not match the endpoint it opens: it omitted `workflow_runs.status = 'running'` and excluded `rejected` stages, so the number and the list answered different questions. Now mirrors `/workflows/overdue` exactly except that it normalises the stored format — that endpoint still compares raw text and therefore under-reports same-day breaches, which is why this metric is `related` and says so. Cross-check: no stage has a due date, so both are 0. |
| `changes_requested` | Changes requested | `workflow_run_stages.status = 'changes_requested'` | VERIFIED | `/workflows` → `GET /admin/workflows/runs` (related) | Counts stages; the list paginates runs. Cross-check: 0. |
| `pending_reviews` | Reviews pending | `content_reviews.status = 'pending'` | VERIFIED | `/content-reviews?status=pending` → same (exact) | Cross-check: 43; list total 43. No orphan or fixture-linked rows (`0` of each). |

## Catalogue — `series` · `episodes` · `stories` · `games` (production content only)

All six were BROKEN for one reason: they ignored `series.content_class`. Migration 0018 and
`lib/contentClass.ts` state that supplied test material "must never be counted in production
content figures", and this is the screen those figures are read on.

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `published_series` | Series published | `series.status='published' AND content_class='production'` | BROKEN | `/series?status=published` → `GET /admin/series?status=published` (related) | **Reported 2; both were test fixtures. Majarra has published 0 series.** Cross-check: all 2, production-only 0. |
| `pipeline_series` | Series in the pipeline | `status NOT IN ('published','archived')`, production only | BROKEN | `/series` → `GET /admin/series` (related) | Same missing filter; no numeric change locally (38 either way) because both fixture series are published. |
| `published_episodes` | Episodes published | `episodes.is_published=1` joined to a production series | BROKEN | `/episodes?status=published` → `GET /admin/episodes?status=published` (related) | **Reported 14; all 14 were the fixture videos.** Cross-check: all 14, production-only 0. |
| `ready_unpublished_episodes` | Ready, not published | `status='ready' AND is_published=0`, production only | BROKEN | `/episodes?status=ready` → same (related) | Same missing filter; 0 either way today. |
| `published_stories` | Stories published | `stories.status='published'`, production or unparented | BROKEN | `/stories?status=published` → same (related) | Same missing filter; 0 either way today. `stories.series_id` is nullable, so an unparented story counts as Majarra's. |
| `published_games` | Games published | `games.status='published'`, production or unparented | BROKEN | `/games-ops` → `GET /admin/games?status=published` (related) | **Reported 1; it was the fixture game.** Cross-check: all 1, production-only 0. |

The admin catalogue list endpoints have no `content_class` filter, so every drill here is a
superset by exactly the number of fixture rows. The live check prints that difference.

## Public website — `web_pages` · `web_page_sections`

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `published` | Pages published | `web_pages.status='published'` | VERIFIED | `/website/pages?status=published` → same (exact) | Cross-check: 21; list total 21. |
| `review` | In review | `status='review'` | VERIFIED | `/website/pages?status=review` → same (exact) | Cross-check: 0. |
| `scheduled` | Scheduled | `status='scheduled'` | VERIFIED | `/website/pages?status=scheduled&view=calendar` → same without `view` (exact) | Cross-check: 0. `view` is a rendering choice, so it is not sent to the API. |
| `draft` | Drafts | `status='draft'` | VERIFIED | `/website/pages?status=draft` → same (exact) | Cross-check: 23. |
| `published_empty` | Published but empty | published pages with no active section | VERIFIED | `/website/pages?status=published` → same (related) | The list has no section-count filter, but it returns `active_sections` per row, which is what identifies them. Cross-check: 0. |

## Blog — `blog_posts`

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `published` | Posts published | `status='published'` | VERIFIED | `/blog/posts?status=published` → same (exact) | Cross-check: 13; list total 13. The list endpoint caps at 100 rows, noted in the payload. |
| `scheduled` | Scheduled | `status='scheduled'` | VERIFIED | `/blog/posts?status=scheduled&view=calendar` → same without `view` (exact) | Cross-check: 0. |
| `review` | In review | `status='review'` | VERIFIED | `/blog/posts?status=review` → same (exact) | Cross-check: 0. |
| `draft` | Drafts | `status='draft'` | VERIFIED | `/blog/posts?status=draft` → same (exact) | Cross-check: 9. |
| `without_author` | Without an author | not archived and `author_id IS NULL` | VERIFIED | `/blog/posts` → `GET /admin/blog/posts` (related) | No author filter can express "none" (the page compares author names), so the destination is the full list and `note` says so rather than shipping an inert filter. Cross-check: 9, of which 0 are published — the publish gate holds. |
| `awaiting_religious_review` | Awaiting religious review | classified posts with no named reviewer or no approval date | VERIFIED | `/blog/posts` → `GET /admin/blog/posts` (related) | Cross-check: 0 (0 posts carry a `source_type`). |

## SEO — `seo_meta` · `web_pages` · `blog_posts`

A cheap subset of `GET /admin/seo/audit`. The live check compares each counter to the number
of audit issues carrying the matching id, so the dashboard and the audit cannot drift.

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `missing_title` | Missing SEO titles | published pages + posts with no `seo_title` | VERIFIED | `/seo?check=missing_title` → `GET /admin/seo/audit` (related) | Cross-check: 4 pages + 4 posts = 8; audit reports 8 `missing_title` issues. |
| `missing_description` | Missing meta descriptions | published pages + posts with no `meta_description` | BROKEN | `/seo?check=missing_description` → audit (related) | Counted pages only (**4**) but drilled into an audit filter listing pages *and* posts (**8**), so the number and the list disagreed by the number of posts. Broadened to both; key renamed from `pages_missing_description`. |
| `published_noindex` | Published noindex | published pages + posts with `robots_index = 0` | BROKEN | `/seo?check=published_noindex` → audit (related) | Same defect: counted pages only while the audit flags posts too. Broadened. Cross-check: 0 either way today. |
| `redirects` | Redirects | `COUNT(*) FROM web_redirects` | VERIFIED | `/seo` → `GET /admin/seo/redirects` (exact) | Cross-check: 9; list total 9. The endpoint caps at 200 rows, noted in the payload. |

## Customers — `family_projection` · `child_projection`

Both tables are written by the family-event queue consumer (`src/queue/familyEvents.ts`), so
they are live projections, not frozen ones. `FamilyState` remains the authority; the module
`source` says so.

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `active_families` | Active families | `family_projection.status='active'` | VERIFIED | `/customers?status=active` → same (exact) | Cross-check: 14; list total 14. |
| `paid_families` | Families on a paid plan | `status='active' AND plan <> 'free'` | BROKEN | `/customers?status=active` → same (related) | Labelled "Paying families" with **no payment provider configured** — a projection field presented as a financial fact. `plan` is `NOT NULL DEFAULT 'free'` with a three-value CHECK, so the predicate itself is sound. Relabelled, and `note` states it is a plan flag and that the list's `plan` filter takes one value while "paid" means two. Cross-check: 0 (every projected family is on `free`). |
| `suspended_families` | Suspended families | `status='suspended'` | VERIFIED | `/customers?status=suspended` → same (exact) | Cross-check: 0. |
| `active_children` | Active children | `child_projection.status='active'` | VERIFIED | `/children?status=active` → same (exact) | Cross-check: 10; list total 10. |

## Devices — `account_devices`

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `active_devices` | Active devices | none — see note | UNAVAILABLE BY DESIGN | `/devices-admin` → `GET /admin/devices` (related) | `account_devices` is a projection **no code path writes**: `scripts/verify-device-e2e.mjs` walks `src/` and proves every reference is a SELECT or a comment, and the table holds 0 rows. A count from it is not "no devices", it is unknowable from D1 — so the handler no longer queries it and emits `value: null` with the reason. Live device state per family is read from `FamilyState` in Customer 360. |
| `revoked_devices` | Revoked devices | none — see note | UNAVAILABLE BY DESIGN | `/devices-admin` → `GET /admin/devices` (related) | Same. Previously reported `0`. |

## Rights and availability — `rights_licenses` · `content_availability`

The whole module read the wrong table. `content_rights` is read by the publish gate, the
calendar and search, and **written by nothing** — no admin route inserts into it — so its
count is a permanent zero. `GET/POST /admin/rights` and the `/rights` screen work on
`rights_licenses`. The metric therefore counted one table and opened a screen listing another.

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `expired` | Expired agreements | `rights_licenses.expiry_date` before today | BROKEN | `/rights` → `GET /admin/rights` (related) | Wrong table, and `expiry < date('now')` compared a possibly-full timestamp to a bare date. Now reads `rights_licenses` with `SUBSTR(expiry_date,1,10)`. Cross-check: 0 (table empty). |
| `expiring_soon` | Expiring within 60 days | `expiry_date` within 60 days | BROKEN | `/rights` → `GET /admin/rights` (related) | Same, and the boundary day was excluded when the value carried a time component. `window: next_60_days` now states the period in the payload. Cross-check: 0. |
| `agreements` | Agreements | `COUNT(*) FROM rights_licenses` | BROKEN | `/rights` → `GET /admin/rights` (exact) | Counted `content_rights` (0, and permanently so) while the screen lists `rights_licenses`. Cross-check: 0 = list total 0 — the numbers agreed by coincidence, the sources did not. |
| `withheld` | Withheld everywhere | `content_availability.mode='unavailable'` | BROKEN | `/rights` → `GET /admin/availability` (related) | The number was right; the destination listed licences, which never contain availability policies. `drill_api` now points at `GET /admin/availability` — the endpoint whose own doc comment says it exists "for the rights workspace" — and returns exactly those rows, unfiltered by mode. The rights screen does not render them yet; that wiring is a front-end change outside this file's ownership, and it is recorded in `limits`. Cross-check: 0 (1 policy exists, mode `worldwide`). |
| `restricted` | Geo-restricted | `content_availability.mode='selected_only'` | BROKEN | `/rights` → `GET /admin/availability` (related) | Same. Cross-check: 0. |

## Platform health — `failed_family_events` · `audit_logs`

| metric key | label | source | classification | drill-down target | note |
| --- | --- | --- | --- | --- | --- |
| `unresolved_dlq` | Unresolved failed events | `failed_family_events.status='pending'` | BROKEN | `/failed-events?status=pending` → same (exact) | Two defects. (1) Both platform counters shared one `SELECT` behind one `.catch(() => null)`, so a missing failed-events table erased the audit counter too and left the module with **no metrics at all** — "we cannot tell" rendered as an empty panel beside ten full ones. Split into two reads, each declaring its own availability. (2) It filtered `resolved_at IS NULL` while the list filters `status`, so number and list could differ; now aligned on `status='pending'`. Cross-check: 0 rows in the table; list total 0. |
| `audit_last_day` | Admin actions (24h) | `audit_logs.created_at` within the bound window | VERIFIED | `/audit-logs?from=…&to=…` → same (exact) | `audit_logs.created_at` is written in SQLite's own format (`2026-08-10 21:25:31`), so the original `datetime('now','-1 day')` comparison was correct — this counter was right. Hardened: the window is computed once, bound as parameters, and handed to the drill unchanged, so the link opens the same 24 hours that were counted instead of recomputing them. Cross-check: 560; list total 560. |

---

## Appendix — cross-check statements used

Run against the local D1 with
`npx wrangler d1 execute majarra-db --local --command "…" --json`. Each returned the number in
the table above and was compared to the live HTTP response from
`GET /api/v1/admin/dashboard/executive`.

```sql
-- Support: the same-day SLA defect, raw versus normalised
SELECT
  (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open','in_progress')) AS open_ip,
  (SELECT COUNT(*) FROM support_tickets WHERE first_response_at IS NULL
     AND first_response_due_at IS NOT NULL AND first_response_due_at < datetime('now')
     AND status NOT IN ('resolved','closed')) AS fr_raw,        -- 0  (what the dashboard showed)
  (SELECT COUNT(*) FROM support_tickets WHERE first_response_at IS NULL
     AND first_response_due_at IS NOT NULL
     AND REPLACE(SUBSTR(first_response_due_at,1,19),'T',' ') < datetime('now')
     AND status NOT IN ('resolved','closed')) AS fr_fixed,      -- 7  (the truth)
  (SELECT MIN(resolution_due_at) FROM support_tickets) AS stored_shape,  -- 2026-08-10T18:09:01.397Z
  (SELECT datetime('now')) AS sqlite_shape;                              -- 2026-08-10 21:53:44

-- Catalogue: how much of the published catalogue is test material
SELECT
  (SELECT COUNT(*) FROM series WHERE status='published') AS pub_series_all,               -- 2
  (SELECT COUNT(*) FROM series WHERE status='published' AND content_class='production') AS pub_series_prod, -- 0
  (SELECT COUNT(*) FROM episodes WHERE is_published=1) AS pub_eps_all,                    -- 14
  (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id=e.series_id
     WHERE e.is_published=1 AND s.content_class='production') AS pub_eps_prod,            -- 0
  (SELECT COUNT(*) FROM games WHERE status='published') AS games_all,                     -- 1
  (SELECT COUNT(*) FROM series WHERE content_class='test_fixture') AS fixture_series;     -- 2

-- Rights: two tables, one of them with no writer
SELECT (SELECT COUNT(*) FROM content_rights) AS publish_gate_table,   -- 0, never written by any route
       (SELECT COUNT(*) FROM rights_licenses) AS rights_screen_table; -- 0, what /rights shows

-- Devices: the projection is empty because nothing writes it
SELECT COUNT(*) FROM account_devices;  -- 0

-- Stored date shapes, which decide whether a text comparison is safe
SELECT (SELECT MAX(created_at) FROM audit_logs) AS audit_shape,        -- 2026-08-10 21:25:31 (safe)
       (SELECT due_at FROM production_requirements WHERE due_at IS NOT NULL LIMIT 1) AS due_shape;
       -- 2026-08-17T21:24:58.533Z (needs normalising)

-- Website, blog, SEO, customers and platform counters
SELECT
  (SELECT COUNT(*) FROM web_pages WHERE status='published') AS pages_pub,     -- 21
  (SELECT COUNT(*) FROM web_pages WHERE status='draft') AS pages_draft,       -- 23
  (SELECT COUNT(*) FROM blog_posts WHERE status='published') AS blog_pub,     -- 13
  (SELECT COUNT(*) FROM blog_posts WHERE status='draft') AS blog_draft,       -- 9
  (SELECT COUNT(*) FROM blog_posts WHERE status<>'archived' AND author_id IS NULL) AS blog_noauthor, -- 9
  (SELECT COUNT(*) FROM web_pages p LEFT JOIN seo_meta m
     ON m.entity_type='web_page' AND m.entity_id=p.id
    WHERE p.status='published' AND (m.seo_title IS NULL OR TRIM(m.seo_title)='')) AS pg_missing_title,   -- 4
  (SELECT COUNT(*) FROM blog_posts b LEFT JOIN seo_meta m
     ON m.entity_type='blog_post' AND m.entity_id=b.id
    WHERE b.status='published' AND (m.seo_title IS NULL OR TRIM(m.seo_title)='')) AS post_missing_title, -- 4
  (SELECT COUNT(*) FROM web_redirects) AS redirects,                          -- 9
  (SELECT COUNT(*) FROM content_reviews WHERE status='pending') AS reviews,   -- 43
  (SELECT COUNT(*) FROM family_projection WHERE status='active') AS families, -- 14
  (SELECT group_concat(DISTINCT plan) FROM family_projection) AS plans,       -- free
  (SELECT COUNT(*) FROM child_projection WHERE status='active') AS children,  -- 10
  (SELECT COUNT(*) FROM failed_family_events) AS dlq,                         -- 0
  (SELECT COUNT(*) FROM audit_logs WHERE created_at >= datetime('now','-1 day')) AS audit24; -- 560
```

## Reproducing the whole check

```
cd dashboard/api
npx tsc --noEmit                      # 0 errors
npm test                              # 876 pass, 0 fail
node scripts/verify-executive-e2e.mjs --base http://127.0.0.1:8787 \
  --email seo.verify@majarra.local --password '<password>'   # 364 passed, 0 failed
```

## What could not be verified from this database

- **The 60-day expiry window** (`rights.expiring_soon`): `rights_licenses` holds no rows
  locally, so the boundary arithmetic is verified by reading the normalised SQL, not by
  observing a licence cross the boundary.
- **Overdue workflow stages**: no `workflow_run_stages` row has a `due_at`, so the corrected
  predicate is verified by construction and against the endpoint it mirrors, not against data.
- **A resolution SLA breach**: no unsettled ticket has a passed resolution deadline, so only
  the first-response clock demonstrated the defect with real rows. Both use the same predicate.
- **The unavailable-source path for the ten queried modules**: exercised in
  `test/executiveDashboard.test.mjs` with a stub that returns no row, because making a real
  table unreadable would mean altering the local schema.
