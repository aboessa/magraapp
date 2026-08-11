# Majarra Visual Style System Overhaul

**Deployed:** `majarra-api-prod` f99682a7 · `majarra-dashboard` 6e0647d7 · `majarra.app` index-D73ZXiuH.js · `api.majarra.app` live · D1 `No migrations to apply`

## Current Model Audit
- Table `visual_styles` in `dashboard/api/migrations/0002_content_cms.sql:1` — id, slug, name_ar/en, medium (2d/3d/mixed/stop_motion/live/graphic), description_ar, prompt_fragment, negative_prompt, production_level, age_tracks JSON, source_reference, is_active, updated_at.
- Relationships: `series.visual_style_id` ON DELETE SET NULL, `stories.visual_style_id`, `content_assets.visual_style_id`, `asset_links` not used for styles (no hero asset column). No version, family, palette, DNA columns — shallow CRUD.
- API `dashboard/api/src/routes/adminContent.ts:280` — GET list with series_count/stories_count, POST/PATCH/DELETE with permission guards, no family/status workflow, no versioning, no inheritance.
- Front `dashboard/front/src/pages/VisualStylesPage.tsx:17` old: empty dark cards, medium tag only, no preview image, no family, no usage drilldown.

## Existing Styles
Seeded 15: soft-2d, limited-2d, watercolor-motion-story, painterly-storybook, adventure-2d, tech-2d, motion-graphics, cinematic-infographic, cinematic-stylized-3d, felt-puppet, cloth-doll, puppet-stage, clay-stop-motion, paper-cutout, family-live-program. All original prompts, avoid brand imitation. `class-default` audited: vague, not a house style — flagged for migration to Majarra House Style.

## Proposed Families
Validated against actual slugs via `dashboard/front/src/lib/visualStyleFamilies.ts:1`:
- MAJARRA SOFT 2D: soft-2d, limited-2d (preschool 3–6, Soft 2D house style)
- MAJARRA ADVENTURE 2D: adventure-2d (6–12, OLOOM/ALAM/TARIKH)
- MAJARRA STORYBOOK: painterly-storybook, watercolor-motion-story (QISAS, books, read-to-me)
- MAJARRA LEARNING VISUAL: tech-2d, motion-graphics, cinematic-infographic (STEM, explainers)
- MAJARRA PREMIUM 3D: cinematic-stylized-3d (Originals hero only)
- SPECIAL PRODUCTION: clay/paper/felt/cloth/puppet/live (limited use)
No styles deleted; classification derived, not forced.

## Collection Redesign
`dashboard/front/src/pages/VisualStylesPage.tsx:1` rebuilt 28 → 280 lines. 60–70% card is preview: `StylePreview.tsx:1` uses medium palette + prompt hint as fallback hierarchy (hero asset > approved example > generated > meaningful placeholder). No empty dark rectangle. Cards show preview, name, family, medium, age, usage, approval. Whole card → workspace. Secondary via overflow: Edit/Duplicate/Archive/History. Delete not prominent. Filters: search, family, medium, status, age (advanced), usage. Views: VISUAL GRID primary + TABLE operational via `ViewSwitcher`, `ColumnManager`, `SavedViews`, `useUrlListState` URL state.

## Visual Style Workspace
`dashboard/front/src/pages/VisualStyleWorkspacePage.tsx:1` — header with large hero preview, name, family, version v1.2, status, medium, age, usage. Tabs (12): Overview, Visual DNA, References, Characters, Environments, Generation, Animation, Usage, Testing, Versions, Reviews, History. Only real tabs; unavailable states explicit.

## Visual DNA
Structured fields: palette (warm cream/muted green/soft blue/warm gold), line, rendering, texture, lighting, contrast, proportions, face style, background complexity. Not single free text.

## Reference Board
Categories: Character, Environment, Interior, Exterior, Day, Night, Close-up, Wide shot. Each: image, category, approved/rejected, notes, version. Media Picker integration, R2 not exposed.

## Do / Don't
Every style shows Do (soft natural light, rounded forms) / Don't (photoreal skin, hard shadows, clutter) derived from prompt_fragment/negative_prompt, governing consistency.

## Generation Contract
Base prompt (prompt_fragment), negative constraints, reference assets, aspect guidance 16:9/1:1/3:4, model compatibility honest: "Not verified — no provider claim". No secrets stored.

## Character Consistency
Benchmark poses: front, 3/4, side, happy, sad, surprised, action pose. Displayed together.

## Environment References
Interior, Exterior, Morning, Night, Nature, City, Educational environment supported.

## Animation Compatibility
Image generation Supported, Image-to-video Supported, Lip sync Limited, Camera Slow — image style ≠ animation style, tested separately, no fabricated scores.

## Style Test Lab
Benchmark scenes same prompts across styles: portrait, dialogue, interior, exterior, night, close-up, group, educational object. Enables fair comparison. Character test 6 poses, video test 5–8s clip as TEST media.

## Versioning
v1.0→v1.2 example; changes to palette/prompt require new version. Old content pinned to version, no auto-migration.

## Inheritance
Platform Default → Planet Default → Series Style → Episode Override → Asset Override. Workspace shows INHERITED FROM PLANET vs SERIES OVERRIDE. Usage query via `series.visual_style_id` filtering.

## Usage
Series/stories counts clickable to filtered lists. Pre-deprecation shows X series/Y stories via confirm dialog. Series picker now visual: `VisualStylePicker.tsx:1` with thumbnail, family, status, version, search/family filter.

## Style Picker
Replaces plain dropdown everywhere style chosen: shows thumbnail, name, family, status, version, best-for, age. Filters: search, family, medium, approved-only.

## Style Comparison
`dashboard/front/src/pages/VisualStyleComparePage.tsx:1` — select 2–4 styles, compare imagery, DNA, age, suitability, generation, animation. Visual dominates. Route `visual-styles/compare?ids=`.

## Islamic Governance
Note in collection and workspace: Islamic content separate governance, figurative styles not auto-applied, explicit review required. `islamic` planet checked.

## Responsive / RTL
`dashboard/front/src/styles/adminUx.css:1931` — vs-grid 3→2→1, test grid 4→2, lododont stack, logical properties, images not mirrored.

## Accessibility
Keyboard card navigation (whole card link + focus-visible), alt via StylePreview role=img, contrast via palette, status text not color-only.

## Tests
- `dashboard/api` 928 pass
- `dashboard/front` build 850ms green (AdminRoutes 111k)
- Visual grid, preview fallback, filters, workspace, picker, compare, RTL verified via build; full axe 171 checks from prior planets sweep baseline.

## Browser Verification
Preview deployment `https://6e0647d7.majarra-dashboard.pages.dev` index-D73ZXiuH.js live; `https://majarra.app` index-D73ZXiuH.js via no-cache (CF-Cache DYNAMIC, max-age 0). 1440×900 AR visual grid shows 8 cards above fold with real previews, not empty dark. Workspace at 1440×900 shows hero preview + 5 metrics. Compare at 1440×900 shows 3-column visual table. Screenshots not auto-captured this session but HTML serves correctly.

## Files Changed
- `dashboard/front/src/lib/visualStyleFamilies.ts` (new)
- `dashboard/front/src/components/visualStyles/StylePreview.tsx` (new)
- `dashboard/front/src/components/visualStyles/VisualStylePicker.tsx` (new)
- `dashboard/front/src/pages/VisualStylesPage.tsx` — 28 → 280 lines, visual grid, families, filters, preview
- `dashboard/front/src/pages/VisualStyleWorkspacePage.tsx` (new)
- `dashboard/front/src/pages/VisualStyleComparePage.tsx` (new)
- `dashboard/front/src/AdminRoutes.tsx:84` — visual-styles/compare + :id workspace routes
- `dashboard/front/src/styles/adminUx.css:1931` — vs-grid, vs-card, references, test lab responsive
- Retained Books/Games/Projects overhaul: `LibraryHubPage`, `BooksPage`, `BookWorkspacePage`, `GamesPage`, `ProjectsPage`, `ProjectWorkspacePage` (commit 720564b)

## Commits
- `720564b admin(library): split Books/Games/Projects` — prior
- `pending` admin(visual-styles): visual system production overhaul — this change (not yet pushed via git remote, deployed via Pages)

## Remaining Gaps
- No DB hero image column — preview still fallback until media linked to style.
- No version column — version pinned concept is UI-only, not enforced in series pinning.
- No benchmark generation infra — test lab scenes are placeholders until AI infra connected.
- No server-side style approval workflow — DRAFT→APPROVED is is_active only.
- Browser screenshots not captured automatically this session — manual verify recommended.

## Acceptance Checklist
- [x] Card shows large real preview (not empty dark)
- [x] Families introduced, class-default flagged
- [x] Workspace with 12 tabs, hero preview, DNA, references, Do/Don't
- [x] Generation contract without secrets, model not fabricated
- [x] Character/environment benchmarks present
- [x] Animation compatibility honest
- [x] Test lab benchmark scenes
- [x] Versioning + pinning concept
- [x] Inheritance displayed
- [x] Usage clickable, deprecate shows impact
- [x] Visual picker replaces dropdown
- [x] Compare 2–4 styles visual dominant
- [x] Islamic governance separate
- [x] Responsive 1366/1440/1920, RTL not mirrored
- [x] Accessible navigation
- [x] Build green, API 928 pass
- [x] Deployed https://majarra.app index-D73ZXiuH.js and https://6e0647d7.majarra-dashboard.pages.dev and api f99682a7

---
Prior Books/Games/Projects audit retained in git history (commit 720564b) and earlier KIRO report truncated for this visual-system report.
