Proceed with a FULL ADMIN DASHBOARD + BUSINESS OPERATIONS + MARKETING + WEBSITE + BLOG + SEO COMPLETION PROGRAM for Majarra.

This task is APPROVED FOR IMPLEMENTATION.

GOAL
====

Transform the current Majarra dashboard from a strong but partially-complete CMS/admin application into a production-grade operating system capable of managing the entire Majarra business from one place.

The final system must allow Majarra staff to operate:

- Content
- Editorial production
- Media production
- Localization
- Translation
- Dubbing / TTS
- Learning / curriculum
- Families and customers
- Customer support
- Subscriptions and plans
- Revenue operations
- Rights and licensing
- Schools / B2B
- Partnerships
- Marketing
- Campaigns
- Website
- Blog
- SEO
- App experience
- Releases
- Remote configuration
- Recommendations
- Analytics
- Business KPIs
- Technical operations
- Security
- Audit
- Backup / restore
- Compliance / privacy operations

This task must also FIX everything that is:

- mocked
- fake
- placeholder
- UI-only
- partially implemented
- disconnected from its backend
- backend-only with no usable UI
- inconsistent between frontend/backend/schema
- undocumented
- incorrectly reporting completeness
- unsafe for production
- missing validation
- missing authorization
- missing audit logging

Do NOT create fake functionality merely to make the dashboard look complete.

A feature counts as implemented only when its real data flow works:

UI
→ authenticated API
→ authorization
→ validation
→ database/service
→ audit/event where applicable
→ read-back verification

==================================================
IMPORTANT EXISTING PROJECT CONTEXT
==================================================

The REAL admin application is:

F:\Projects\cartoonapp\dashboard\

with:

dashboard/front
= React + TypeScript + Vite

dashboard/api
= Cloudflare Workers + D1 + R2 + Queues + Durable Objects

The root:

admin-dashboard.html

is only an old visual mockup and must NOT be treated as the production dashboard.

Do not accidentally develop two dashboards.

If safe:
- clearly mark the root mockup as deprecated/non-production
- document the canonical admin entry point

Do not destructively delete historical files without verifying references.

FamilyState remains the authority for family/child state.

Admin projections remain read-oriented where previously architected.

Do not create synchronous FamilyState + D1 dual writes unless the existing architecture explicitly requires them.

==================================================
MAJARRA PRODUCT SCOPE
==================================================

Majarra contains:

- planets
- categories
- series
- seasons
- episodes
- stories
- books
- comics where added later
- audio content
- games
- activities/projects
- characters
- learning objectives
- skills
- mastery
- quizzes
- media
- translations
- voice/audio
- artwork
- campaigns
- subscriptions
- families
- children
- devices
- downloads
- schools
- partners
- public website
- blog

The initial canonical languages are:

- Arabic
- English
- French

The administration architecture must NOT hardcode the platform permanently to only three languages.

==================================================
EXECUTION RULE
==================================================

Complete this program in the order below.

Do not skip major dependencies.

Before starting each major phase:

1. Inspect the existing implementation.
2. Reuse good working architecture.
3. Fix incomplete implementations rather than replacing them unnecessarily.
4. Back up data before migrations.
5. Add tests.
6. Verify the actual behavior.

Do NOT automatically deploy production.

Complete everything technically possible in the current development environment.

Anything requiring an external provider, legal decision, production credentials or human approval must be marked:

EXTERNAL BLOCKER

but the surrounding engineering must still be completed as far as safely possible.

==================================================
PHASE 0 — MASTER AUDIT AND BASELINE
==================================================

Perform a full implementation audit of:

dashboard/front
dashboard/api
app_main where dashboard-controlled features depend on the app
public/marketing website
landing pages
docs
migrations
D1
R2 bindings
Queues
Durable Objects

Classify every dashboard feature:

COMPLETE
PARTIAL
MOCK
UI ONLY
BACKEND ONLY
BROKEN
MISSING
EXTERNAL BLOCKER

Create a machine-readable feature matrix and a human-readable matrix.

Verify the current 45 registered admin routes individually.

Do not infer implementation from the existence of a React page.

Verify actual API behavior.

==================================================
PHASE 1 — REMOVE FAKE / MOCK BEHAVIOR
==================================================

Search the dashboard for:

- hardcoded metrics
- fake users
- fake revenue
- fake campaigns
- fake devices
- fake support data
- fake analytics
- prompt()/alert()-based production workflows
- placeholder arrays
- TODO production actions
- disabled buttons pretending to be implemented
- frontend-only state posing as persistence

For every case:

either connect it to real functionality
or explicitly mark/remove the unavailable action.

No misleading admin UI.

==================================================
PHASE 2 — ADMIN AUTHORIZATION HARDENING
==================================================

Audit EVERY admin API route.

Permission enforcement must happen in the Worker/API, never only in React.

Verify:

role
+ scope
+ content type
+ language
+ team permissions
+ validity/expiration

where relevant.

Add centralized authorization helpers if duplication currently risks inconsistent enforcement.

Add automated tests proving unauthorized requests fail.

Sensitive actions must be audited.

==================================================
PHASE 3 — ADMIN AUTHENTICATION & MFA
==================================================

Finish production-grade admin login security.

Support as appropriate to the existing stack:

- MFA
- recovery flow
- session management
- session expiry
- logout all sessions
- suspicious session detection
- rate limiting
- brute-force protection
- account lock/recovery policy
- security event log
- admin device/session history

Do not invent an external SMS/email provider if none is configured.

Provider-dependent delivery may remain EXTERNAL BLOCKER.

==================================================
PHASE 4 — EXECUTIVE BUSINESS DASHBOARD
==================================================

Create a real executive home dashboard.

It should answer in one screen:

TODAY / 7 DAYS / 30 DAYS / CUSTOM RANGE

- active families
- active children
- new registrations
- trials started
- trial → paid conversion
- paid subscribers
- new subscriptions
- cancellations
- churn
- failed payments
- recoveries
- MRR/ARR where meaningful
- gross revenue
- refunds
- active devices
- content consumption
- watch time
- reading activity
- games played
- learning activity
- content published
- content awaiting review
- production bottlenecks
- support tickets
- support SLA
- system health
- failed jobs
- storage/media health

Never fabricate metrics.

If source data does not yet exist:
show a truthful unavailable state and implement the missing instrumentation where technically appropriate.

==================================================
PHASE 5 — CUSTOMER 360 / FAMILY OPERATIONS
==================================================

Build a proper Customer 360 view.

Opening a family should show:

Family
→ Parent
→ Children
→ Subscription
→ Entitlements
→ Devices
→ Downloads
→ Preferences
→ Consents
→ Progress summary
→ Favorites
→ Recent activity
→ Payments
→ Refunds
→ Support tickets
→ Internal support notes
→ Audit trail

Respect privacy boundaries.

Admin must never obtain unnecessary child-private data.

==================================================
PHASE 6 — CUSTOMER SUPPORT CRM
==================================================

Complete Support Center as a real operations tool.

Implement:

- support tickets
- ticket status
- priority
- category
- assigned agent/team
- SLA
- internal notes
- customer-visible responses where provider exists
- attachments where safe
- escalation
- timeline
- linked family
- linked subscription/payment/device
- tags
- search
- saved filters

Implement safe operational actions where architecture allows:

- subscription resync
- entitlement resync
- restore purchase state
- device revoke
- PIN reset workflow
- account recovery workflow

Every sensitive action:

authorization
+ reason
+ confirmation
+ audit log

Do NOT fake parent notifications.

If notification delivery is unavailable, return/report that truthfully.

==================================================
PHASE 7 — DEVICES & DOWNLOAD MANAGEMENT
==================================================

Complete device operations.

Admin should see:

- device
- platform
- app version
- last seen
- family
- status
- offline downloads
- download storage usage where available
- DRM/offline entitlement state where available

Actions:

- revoke device
- revoke downloads
- resync
- inspect errors
- notify parent if messaging infrastructure exists

Add a real downloads data model if the application architecture actually needs server-side visibility.

Do not create unnecessary surveillance of child behavior.

==================================================
PHASE 8 — SUBSCRIPTIONS / PLANS / PRICING
==================================================

Create complete commercial plan management.

Support:

- plans
- tiers
- billing period
- countries
- currencies
- localized price display
- trial duration
- entitlements
- family limits
- device limits
- download limits
- plan availability
- plan versioning
- grandfathering
- scheduled price changes
- promo eligibility

Do NOT hardcode payment-provider-specific implementation unless the project has an approved provider.

Build the provider-neutral domain model and operational UI.

External payment-provider completion may remain EXTERNAL BLOCKER.

==================================================
PHASE 9 — PROMOTIONS / COUPONS
==================================================

Implement promotion management:

- promo code
- campaign relationship
- start/end date
- usage limits
- eligible countries
- eligible plans
- new users only
- percentage/fixed/trial extension where supported
- redemption tracking
- abuse safeguards

Provider integration may remain external if not selected.

==================================================
PHASE 10 — REVENUE OPERATIONS
==================================================

Complete real revenue management and reporting.

Support available data for:

- transactions
- subscription renewals
- refunds
- failed payments
- recovered payments
- chargebacks
- taxes where data exists
- payment provider fees
- currency
- net/gross values
- reconciliation status

Views:

Revenue overview
Subscription movement
Refund report
Failed payment report
Country revenue
Plan revenue
Channel revenue

Do not manufacture accounting numbers.

==================================================
PHASE 11 — RIGHTS & LICENSING
==================================================

Build a real rights/licensing system.

Each licensed content asset should be able to define:

- IP owner
- licensor
- contract/reference
- territories
- languages
- platforms
- allowed distribution
- start date
- end date
- renewal date
- exclusivity
- restrictions
- document attachment
- notes
- responsible owner

Add alerts for:

- rights expiring
- rights expired
- content scheduled outside licensed period
- country/language/platform mismatch

Publishing must fail closed when a required rights record explicitly prohibits publication.

Majarra Originals may have a first-party rights status.

==================================================
PHASE 12 — CONTENT CMS COMPLETION
==================================================

Audit and complete CRUD and operational flows for:

- planets
- categories
- series
- seasons
- episodes
- stories
- story pages
- books
- comics architecture if present
- games
- activities/projects
- characters
- visual styles
- learning objectives
- skills
- reviews

Support:

draft
→ review
→ approved
→ scheduled
→ published
→ unpublished
→ archived

Do not allow destructive hard deletion of published business data without explicit protected workflow.

==================================================
PHASE 13 — CONTENT CALENDAR
==================================================

Build a Content Calendar.

Views:

day
week
month

Show:

- episode releases
- stories
- books
- campaigns
- homepage placements
- seasonal collections
- marketing events

Support drag/reschedule if safe.

Detect scheduling conflicts.

==================================================
PHASE 14 — BULK OPERATIONS
==================================================

Implement safe bulk management for appropriate objects:

- assign reviewer
- change category
- change age track
- schedule
- add tags
- update metadata
- archive
- export
- translation assignment

Destructive bulk actions require strong confirmation and authorization.

==================================================
PHASE 15 — WORKFLOW ENGINE
==================================================

Replace any static/mock workflow model with a real workflow engine.

Support workflow templates such as:

EPISODE:
Author
→ Educational Review
→ Language Review
→ Media Production
→ QA
→ Publisher

STORY:
Writer
→ Editor
→ Translation
→ Illustration
→ Narration
→ QA
→ Publisher

ISLAMIC:
Authoring Scope
→ Source Verification
→ Sharia Review
→ Language Proof
→ Media Review
→ Publisher

Allow:

- stages
- required roles
- assignments
- due dates
- dependencies
- required approvals
- rejection
- requested changes
- comments
- SLA
- escalation
- history

Do not mark a workflow complete because a status string changed without the required approvals.

==================================================
PHASE 16 — TASK / PRODUCTION MANAGEMENT
==================================================

Create a production pipeline where staff can see the actual production state of every content item.

Example:

Episode
Script ✅
Educational review ✅
AR voice ❌
EN translation ❌
FR translation ❌
Storyboard 70%
Video ❌
Thumbnail ✅
Captions ❌
QA ❌
Publish ❌

Each production requirement should support:

- owner
- team
- status
- due date
- dependency
- blocker
- notes
- asset links

Provide Kanban + table where practical.

==================================================
PHASE 17 — STORY BUILDER COMPLETION
==================================================

Complete Story Builder.

Add:

- ZIP bulk import
- downloadable ZIP template
- manifest validation
- import preview
- page mapping report
- Excel/CSV import where documented
- interrupted upload resume
- duplicate detection
- missing page detection
- language mapping
- image mapping
- audio mapping
- old/new narration comparison
- version history
- rollback
- publish validation

Maintain:

page
+ image
+ per-language text
+ per-language audio
+ timing
+ bubbles/dialogue
+ layout

Do not bake translated text permanently into artwork.

==================================================
PHASE 18 — MEDIA PRODUCTION CENTER
==================================================

Upgrade Media Library into a production-oriented Media Center.

Support:

- images
- posters
- banners
- thumbnails
- video masters
- HLS
- narration
- dubbing
- captions
- music
- SFX
- game assets
- story assets
- book assets

Show:

- owner
- linked content
- language
- version
- status
- storage
- size
- duration/dimensions
- validation
- processing history

Detect orphan assets and missing requirements.

==================================================
PHASE 19 — CONTENT QUALITY CENTER
==================================================

Implement automated quality checks.

Examples:

Episode:
- missing video
- missing thumbnail
- missing caption
- missing language
- missing objective
- missing review
- invalid duration
- missing rights

Story:
- missing page
- missing text
- missing illustration
- missing narration
- duplicate page order

Game:
- invalid content pack
- missing assets
- unsupported engine
- missing localization

Website/blog:
- missing SEO title
- missing description
- broken canonical
- missing OG image
- missing alt text

Show severity:

ERROR
WARNING
INFO

Block publish on defined ERROR rules.

==================================================
PHASE 20 — TRANSLATION CENTER
==================================================

Complete a proper localization workflow.

Canonical current languages:

Arabic
English
French

But architecture must support adding more later.

Support:

- source language
- target language
- assignment
- translator
- reviewer
- status
- version
- source changed after translation warning
- glossary
- translation memory concepts where practical
- comments
- due date

Track completeness separately for:

- title
- synopsis
- episode script
- story page
- book page
- game prompts
- captions
- metadata
- website
- blog

Do NOT treat declared language support as actual translation.

==================================================
PHASE 21 — DUBBING / TTS / AUDIO CENTER
==================================================

Complete narration and dubbing operations.

Use existing `adminTts.ts` where appropriate.

Support:

- content item
- language
- voice
- provider/model
- prompt/style
- text source version
- generated/recorded status
- review status
- duration
- audio asset
- regenerate
- replace
- compare versions

Never place provider secrets in frontend code.

Credentials remain server-side secrets.

Generated audio ≠ approved audio.

Separate:

GENERATED
RECORDED
REVIEWED
APPROVED
PUBLISHED

For Islamic recitation or other content whose governance forbids synthetic voice, enforce that rule.

==================================================
PHASE 22 — LEARNING / CURRICULUM OPERATIONS
==================================================

Complete management for:

- skills
- objectives
- tracks
- difficulty
- prerequisites
- mastery criteria
- curriculum mappings
- content coverage
- quiz relationships
- games
- activities

Provide curriculum coverage reports:

Planet
→ age track
→ skill
→ objective
→ content items

Expose gaps and over-concentration.

==================================================
PHASE 23 — QUIZ BUILDER
==================================================

Complete Quiz Builder.

Support appropriate question types:

- single choice
- multiple choice where pedagogically justified
- image choice
- ordering
- matching
- simple true/false where appropriate

Support:

- localized prompts
- age
- objective
- explanation
- answer validation
- randomization controls
- accessibility
- preview
- versioning

Do not create high-pressure testing for preschool content where editorial design forbids it.

==================================================
PHASE 24 — PARENT REPORTS
==================================================

Build parent-report management and preview.

Support summaries based on safe progress data:

- watched/read/played
- skills introduced
- mastery movement
- completed activities
- suggested next content

No unnecessary raw behavioral surveillance.

Admin should be able to preview what a parent would see.

==================================================
PHASE 25 — HOME EXPERIENCE BUILDER
==================================================

Complete the Home Page Builder.

Editors must be able to manage modules such as:

- Hero
- Continue
- New releases
- Recommended
- Planet rows
- Stories
- Games
- Audio
- Learning
- Seasonal collection
- Premium
- CTA

Support:

- drag ordering
- content selection
- audience targeting
- age
- country
- language
- subscription tier
- app version where appropriate
- start/end schedule
- draft
- preview
- approval
- publish
- rollback

Preview:

Mobile
Tablet
TV
Web where relevant

==================================================
PHASE 26 — REMOTE CONFIG + KILL SWITCH
==================================================

Remote Config already exists.

Finish the operational layer.

Add:

- typed flags
- description
- owner
- environment
- rollout percentage
- audience
- start/end schedule
- change history
- rollback

Create protected Kill Switch controls for critical capabilities such as:

- registration
- login where appropriate
- downloads
- playback initiation
- games
- TTS generation
- uploads
- campaigns

Dangerous kill switches require confirmation and audit.

==================================================
PHASE 27 — RELEASE CENTER
==================================================

Create a Release Center.

Track:

- Android version
- iOS version
- Web version where applicable
- release notes
- rollout state
- minimum supported version
- recommended version
- forced upgrade
- associated Remote Config
- associated content release
- known issues

Do not assume direct App Store/Play Store integration exists.

External store API integration may be separate.

==================================================
PHASE 28 — CAMPAIGNS / MARKETING CENTER
==================================================

Complete marketing campaign management.

Support:

- campaign
- objective
- audience
- countries
- languages
- age/family segmentation where appropriate
- channel
- creative
- landing page
- promo code
- start/end
- budget metadata
- UTM configuration
- status
- owner
- results

Channels may include:

- push
- email
- in-app
- website banner
- blog/content marketing

Do not pretend an external delivery provider exists if not configured.

==================================================
PHASE 29 — MARKETING FUNNEL / ATTRIBUTION
==================================================

Build reporting for the acquisition funnel where instrumentation exists:

Visitor
→ landing page
→ account
→ child profile
→ trial
→ subscription
→ retained family

Support UTM dimensions:

source
medium
campaign
content

Add privacy-conscious attribution.

Do not expose child identity in marketing analytics.

==================================================
PHASE 30 — PUBLIC WEBSITE CMS
==================================================

Ensure Majarra has a proper public marketing website CMS managed through the dashboard.

Manage pages such as:

Home
Explore
Planets
Series
Stories
Audio
Games
Learning
Parents
Safety
Plans
Devices
Download
Originals
About
Partners
Help
Blog
Legal

Editors should be able to manage:

- page sections
- ordering
- text
- media
- CTA
- translations
- SEO
- publication state
- schedule
- preview

Do not require code deployment for routine marketing copy changes.

==================================================
PHASE 31 — BLOG CMS — REQUIRED
==================================================

Majarra MUST have a real blog/content publishing system.

Implement a production-grade Blog CMS.

Entities:

BLOG POST
CATEGORY
TAG
AUTHOR

For each post support:

- title
- slug
- excerpt
- body
- hero image
- author
- category
- tags
- language
- translated versions
- related posts
- related Majarra content
- CTA
- draft
- review
- scheduled
- published
- archived
- published_at
- updated_at

Editor:

- rich text / structured block editor
- headings
- paragraphs
- lists
- images
- video embeds where safe
- callouts
- quotes
- CTA blocks
- related content blocks

Support:

Arabic RTL
English LTR
French LTR

Provide:

- preview
- autosave
- revision history
- rollback
- scheduled publishing

==================================================
PHASE 32 — BLOG STRATEGY STRUCTURE
==================================================

Prepare useful blog taxonomy such as:

- Parenting
- Education
- Arabic learning
- Children & technology
- Family activities
- Stories
- Learning through play
- Majarra news
- Content guides
- Muslim family topics where editorially/religiously appropriate

Do not fabricate religious guidance.

Religious articles must follow the same authoritative sourcing/review governance as other Islamic content.

==================================================
PHASE 33 — TECHNICAL SEO — REQUIRED
==================================================

Audit and implement strong technical SEO for the PUBLIC Majarra website and blog.

Do NOT index private/admin/app-only pages that should not appear in search engines.

Implement where applicable:

- clean semantic URLs
- unique `<title>`
- meta descriptions
- canonical URLs
- robots directives
- robots.txt
- XML sitemap
- sitemap index if needed
- blog sitemap
- image sitemap if useful
- correct HTTP status codes
- redirects
- 404 handling
- no redirect chains
- hreflang
- language alternate links
- structured data
- Open Graph
- Twitter/X cards
- favicon/app metadata
- breadcrumb structure
- image alt text
- semantic headings
- internal linking
- pagination SEO where needed

==================================================
PHASE 34 — MULTILINGUAL SEO
==================================================

SEO must properly support:

Arabic
English
French

Use a consistent multilingual URL strategy.

Do not duplicate identical pages under multiple URLs without canonicals/hreflang.

Implement proper:

hreflang:
ar
en
fr
x-default where appropriate

Ensure Arabic pages have:

lang="ar"
dir="rtl"

and EN/FR use proper LTR semantics.

Blog translations should link as translation equivalents, not unrelated posts.

==================================================
PHASE 35 — STRUCTURED DATA
==================================================

Add correct Schema.org structured data only where valid.

Potential types:

Organization
WebSite
WebPage
BreadcrumbList
Article / BlogPosting
FAQPage only when actual FAQ content qualifies
VideoObject for public video metadata where applicable
SoftwareApplication / MobileApplication where appropriate

Do NOT spam schema or mark content that is not actually present.

Validate generated structured data.

==================================================
PHASE 36 — SEO CONTENT CONTROLS IN ADMIN
==================================================

Add SEO controls to relevant CMS entities.

Fields:

- SEO title
- meta description
- canonical override where genuinely needed
- index/noindex
- follow/nofollow where genuinely needed
- OG title
- OG description
- OG image
- social image
- structured-data preview
- slug
- redirect from old slug

Provide SEO quality warnings:

- missing title
- title too short/long
- duplicate title
- missing description
- duplicate description
- missing canonical
- missing alt text
- broken internal link
- orphan page
- missing hreflang
- duplicate slug

Do not automatically rewrite editorial content without approval.

==================================================
PHASE 37 — SEO-FRIENDLY RENDERING
==================================================

Inspect the current public website rendering architecture.

If important public pages are currently client-only rendered in a way that prevents reliable crawl/index behavior, implement the least disruptive architecture necessary for crawlable HTML.

Options may include:

- static generation
- prerendering
- SSR
- edge rendering

Choose based on the existing project architecture.

Do not rewrite the entire website framework without evidence that it is necessary.

Verify generated public HTML contains meaningful content and metadata without requiring post-load JavaScript where SEO-critical.

==================================================
PHASE 38 — PERFORMANCE / CORE WEB QUALITY
==================================================

Optimize public website performance.

Audit:

- bundle size
- image formats
- responsive images
- lazy loading
- font loading
- caching
- render blocking
- JavaScript loading
- CLS
- LCP
- INP-related interaction performance
- unnecessary third-party scripts

Do not sacrifice accessibility for performance.

==================================================
PHASE 39 — SEARCH
==================================================

Complete internal search for:

Dashboard:
- content
- family/customer
- tickets
- assets
- blog
- rights

Public/app:
- series
- stories
- games
- audio
- relevant content

Support language-aware search where the existing stack permits it.

Do not expose draft/admin content publicly.

==================================================
PHASE 40 — RECOMMENDATIONS ADMIN
==================================================

Complete recommendation controls.

Support:

- editorial recommendations
- manual boosts
- exclusions
- age constraints
- language constraints
- subscription eligibility
- content safety constraints

Maintain clear separation between:

editorial recommendation
and
algorithmic recommendation.

Provide explanation/debug view for admins where possible.

==================================================
PHASE 41 — ANALYTICS CENTER
==================================================

Complete analytics dashboards.

Product analytics:

- DAU/WAU/MAU where definable
- family retention
- child profile activity aggregate
- watch completion
- story completion
- game engagement
- content discovery
- downloads
- device distribution

Content analytics:

- content starts
- completion
- drop-off
- favorites
- search discovery
- recommendations contribution

Business analytics:

- acquisition
- trial conversion
- paid conversion
- churn
- revenue
- ARPU where meaningful
- campaign performance

Do not fabricate missing historical events.

==================================================
PHASE 42 — ALERT CENTER
==================================================

Create a centralized alert center.

Examples:

CONTENT
- scheduled content not production-ready
- missing translation
- missing audio
- missing rights
- review overdue

BUSINESS
- failed payment spike
- churn anomaly
- support SLA breach

TECHNICAL
- Worker error spike
- queue backlog
- failed queue messages
- R2 issue
- D1 issue
- cron failure
- backup failure

RIGHTS
- expiring soon
- expired

SECURITY
- suspicious admin login
- repeated authorization failures

Support:

severity
owner
status
acknowledged
resolved
history

==================================================
PHASE 43 — OPERATIONS / NOC CENTER
==================================================

Complete OpsPage as a real operational console.

Show available health data for:

- Workers/API
- D1
- R2
- Queues
- Durable Objects
- cron/scheduled jobs
- media processing
- email/push integrations if configured
- TTS provider if configured

Include:

- health
- latency
- error rate
- queue depth
- retries
- dead-letter / failed events
- last successful job
- incidents

No fake green health indicators.

==================================================
PHASE 44 — FAILED EVENTS / QUEUES
==================================================

Build safe operations for failed async processing.

Admin may:

- inspect
- retry
- quarantine
- mark resolved

Preserve payload privacy.

Do not display secrets.

All manual retries must be audited.

==================================================
PHASE 45 — BACKUP & RESTORE
==================================================

Build a real backup operations center.

For applicable stores:

- D1
- relevant metadata
- critical configuration

Show:

- last backup
- status
- size
- retention
- verification status

Implement restore workflow with:

- explicit authorization
- environment guard
- confirmation
- preview
- audit trail

Never allow a one-click accidental production restore.

Test restore in a safe non-production environment.

==================================================
PHASE 46 — AUDIT LOG COMPLETION
==================================================

Audit logging must cover sensitive actions such as:

- login/security
- roles
- permissions
- publishing
- content deletion/archive
- user/account actions
- subscription operations
- refunds
- device revoke
- rights changes
- plan/pricing changes
- Remote Config
- Kill Switch
- backup/restore
- support sensitive actions

Audit records should include where safe:

actor
action
resource
timestamp
before/after summary
reason
request correlation id

Never log passwords, tokens or secrets.

==================================================
PHASE 47 — PRIVACY / DATA OPERATIONS
==================================================

Create clear operational surfaces for privacy-related requests supported by the platform.

Examples:

- account data export
- account deletion
- child profile deletion
- consent history
- data retention status

Do not expose sensitive child data more broadly just to make admin screens richer.

==================================================
PHASE 48 — SCHOOLS / B2B
==================================================

Complete existing school-account management where planned.

Support:

- organization
- school
- admin contact
- seats
- plan
- entitlement
- start/end
- invoices/reference where provider permits
- cohorts/classes only if already part of the product model

Avoid inventing classroom surveillance features.

==================================================
PHASE 49 — PARTNERSHIPS
==================================================

Complete partnership operations.

Support:

- partner
- type
- owner
- status
- contact
- contract metadata
- campaign/content relationship
- territory
- start/end
- notes
- documents
- tasks

==================================================
PHASE 50 — TEAM OPERATIONS
==================================================

Complete staff productivity management inside the dashboard.

Provide:

- My Tasks
- team workload
- overdue
- unassigned
- review queue
- production blockers

Avoid turning the dashboard into an unnecessary full HR system.

Scope is operational work related to Majarra.

==================================================
PHASE 51 — APPROVAL MATRIX
==================================================

Add configurable approval requirements for sensitive operations.

Examples:

Islamic publish
→ Sharia approval required

Major pricing change
→ commercial/admin approval

Production backup restore
→ elevated approval

Rights override
→ rights/admin approval

Keep this simple and auditable.

==================================================
PHASE 52 — NOTIFICATIONS FOR STAFF
==================================================

Build internal dashboard notifications.

Examples:

- assigned review
- task due
- content rejected
- translation stale
- rights expiring
- SLA breach
- production failure

External Slack/Teams integration is optional and provider-dependent.

The dashboard itself must work without Slack/Teams.

==================================================
PHASE 53 — EXPORTS / REPORTS
==================================================

Provide permission-aware export functionality where useful.

Formats as appropriate:

CSV
XLSX where existing stack supports it cleanly
PDF only where genuinely useful

Examples:

- content production status
- translation status
- revenue
- subscriptions
- support SLA
- rights
- campaigns

Never export more customer/child data than necessary.

==================================================
PHASE 54 — ACCESSIBILITY OF ADMIN
==================================================

Audit Admin UI accessibility.

At minimum:

- keyboard operation
- focus states
- semantic controls
- form labels
- readable errors
- responsive layouts
- contrast
- RTL Arabic
- LTR EN/FR where applicable

==================================================
PHASE 55 — RESPONSIVE ADMIN UX
==================================================

The dashboard should remain primarily desktop-optimized but usable on:

- laptop
- large tablet

Do not waste effort making highly complex production tables phone-first.

Critical operational alerts and simple approvals should remain usable on smaller screens.

==================================================
PHASE 56 — ADMIN DESIGN SYSTEM
==================================================

Consolidate duplicated UI patterns.

Create/reuse consistent:

- forms
- tables
- filters
- status chips
- confirmation dialogs
- date pickers
- uploaders
- empty states
- error states
- loading states
- permission-denied states

Avoid each page creating a different UX for the same concept.

==================================================
PHASE 57 — A/B / EXPERIMENT FOUNDATION
==================================================

After P0/P1 business operations are stable, implement a safe experimentation foundation if feasible.

Support:

- experiment
- variants
- audience
- start/end
- metric definition
- allocation
- stop
- result

Experiments involving children must not manipulate safety, religious governance, privacy, or core educational standards.

If instrumentation is insufficient, implement foundation and mark statistical analysis as not-ready.

==================================================
PHASE 58 — WEBSITE / BLOG ANALYTICS
==================================================

Add analytics views for public content where instrumentation exists:

- landing-page visits
- blog page views
- top articles
- organic entrances
- CTA clicks
- signup contribution
- campaign contribution

Respect privacy.

Do not use child profiles for advertising targeting.

==================================================
PHASE 59 — SEO OPERATIONS DASHBOARD
==================================================

Create an SEO operations area in Admin.

Show:

- indexable pages
- noindex pages
- missing metadata
- sitemap status
- redirects
- broken links
- duplicate titles
- duplicate descriptions
- orphan pages
- hreflang issues
- canonical issues
- structured data issues

If live search-engine provider integrations are unavailable, perform internal deterministic checks and clearly distinguish them from external search-engine indexing status.

==================================================
PHASE 60 — WEBSITE REDIRECT MANAGER
==================================================

Implement redirect management for public URLs.

Support:

old path
→ new path

301 / 302 where appropriate

Protect against:

- redirect loops
- redirect chains
- unsafe external redirects

Blog slug changes should offer redirect creation.

==================================================
PHASE 61 — LEGAL PAGE MANAGEMENT
==================================================

Allow authorized staff to manage versioned public legal pages:

- Privacy
- Terms
- Cookie-related content where used
- Child/family safety information

Support:

version
effective date
language
published copy
history

Do not generate legal claims automatically.

Actual legal wording remains a human/legal responsibility.

==================================================
PHASE 62 — STATUS / HELP CONTENT
==================================================

Complete help-center content management if consistent with existing architecture.

Support:

- FAQs
- help articles
- categories
- search
- language
- related support ticket category

Do not confuse this with the public blog.

==================================================
PHASE 63 — GLOBAL COMMAND / SEARCH UX
==================================================

If appropriate to the current UI, implement a global admin search/command palette for quickly finding:

- content
- family
- ticket
- asset
- blog post
- campaign
- right/license

Respect permissions in search results.

==================================================
PHASE 64 — DATA VALIDATION & INTEGRITY
==================================================

Create comprehensive integrity checks.

Examples:

- orphan relations
- invalid language states
- published content missing assets
- published content missing review
- invalid rights
- stale translation
- broken asset links
- duplicate slugs
- broken blog relations
- invalid game packs
- invalid workflow references

Expose these in an Admin Health / Data Quality report.

==================================================
PHASE 65 — PERFORMANCE OF ADMIN
==================================================

Audit:

- large tables
- N+1 API behavior
- oversized payloads
- pagination
- filtering
- searching
- expensive D1 queries
- repeated API calls

Implement server-side pagination/filtering where needed.

Do not load entire business datasets into the browser unnecessarily.

==================================================
PHASE 66 — OBSERVABILITY
==================================================

Add correlation IDs and structured operational logging where missing.

Logs must not contain:

- passwords
- tokens
- API keys
- sensitive child content

Make errors traceable from Admin UI to Worker logs/events where feasible.

==================================================
PHASE 67 — TEST SUITE
==================================================

Create/expand automated tests.

BACKEND:
- auth
- permissions
- scope enforcement
- workflow
- publishing gates
- support actions
- pricing domain
- rights
- Remote Config
- Kill Switch
- audit logging
- blog
- SEO metadata
- redirects
- content validation
- backup guards

FRONTEND:
- critical workflows
- permissions
- forms
- failures
- publishing validation
- blog editor
- SEO editor
- support operations

Run:

npm test
type checks
build
lint where configured

and relevant Flutter tests only where dashboard-controlled app behavior was changed.

Do not disable failing tests merely to obtain green status.

==================================================
PHASE 68 — END-TO-END ACCEPTANCE FLOWS
==================================================

Verify at minimum:

FLOW A — CONTENT
Create draft episode
→ assign team
→ review
→ media status
→ translation status
→ QA
→ schedule
→ publish

FLOW B — STORY
Create story
→ pages
→ illustrations
→ AR/EN/FR
→ narration
→ review
→ publish

FLOW C — SUPPORT
Find family
→ open ticket
→ inspect subscription
→ perform authorized action
→ audit

FLOW D — MARKETING
Create campaign
→ audience
→ landing/blog relationship
→ schedule
→ analytics metadata

FLOW E — BLOG
Create AR article
→ SEO
→ EN/FR translations
→ preview
→ schedule
→ publish
→ sitemap
→ canonical/hreflang

FLOW F — RIGHTS
Attach licensed series
→ territory/language restrictions
→ attempt invalid publish
→ publish blocked

FLOW G — OPERATIONS
Failed queue job
→ inspect
→ retry
→ resolve
→ audit

FLOW H — RELEASE
New release
→ Remote Config
→ staged rollout
→ rollback simulation

==================================================
PHASE 69 — SECURITY ACCEPTANCE
==================================================

Verify:

- no admin page bypasses backend authorization
- secrets never exposed to frontend
- test fixtures never appear publicly in production
- drafts never appear publicly
- protected media remains protected
- sensitive actions are audited
- account/family operations cannot cross authorization boundaries
- public blog/website endpoints cannot expose admin fields
- admin routes are noindex
- app-private pages are not accidentally indexable

==================================================
PHASE 70 — SEO ACCEPTANCE
==================================================

Verify public website/blog:

[ ] crawlable public HTML
[ ] unique titles
[ ] descriptions
[ ] canonical
[ ] hreflang AR/EN/FR
[ ] correct lang/dir
[ ] robots.txt
[ ] sitemap
[ ] blog sitemap
[ ] OG metadata
[ ] structured data
[ ] image alt
[ ] breadcrumb where appropriate
[ ] valid redirects
[ ] no indexation of admin/private app
[ ] 404 works
[ ] no obvious broken internal links
[ ] no duplicate-slug collisions
[ ] performance acceptable

==================================================
PHASE 71 — BUSINESS ACCEPTANCE
==================================================

At the end, I should be able to use one admin application to answer:

What content is being produced?
Who owns it?
What is late?
What is blocked?
What needs review?
What is translated?
What media is missing?
What goes live today?
What rights are expiring?
How many customers do we have?
What plans are they on?
What payments failed?
What support cases are open?
How is revenue moving?
Which campaign is performing?
What content performs best?
Is the platform healthy?
Are queues failing?
Did backups succeed?
What changed in production configuration?
What blog posts are scheduled?
What SEO issues remain?

If the dashboard cannot answer one of these because the underlying system has no data source, document the missing instrumentation/provider instead of fabricating an answer.

==================================================
PRIORITY ORDER
==================================================

Execute in this priority order:

P0 — REQUIRED BEFORE COMMERCIAL OPERATION

1. Auth / permissions / MFA
2. Audit
3. Customer 360
4. Support
5. Devices
6. Plans / pricing domain
7. Subscription operations
8. Rights/licensing
9. Workflow
10. Content QA/publishing gates
11. Home Builder
12. Remote Config + Kill Switch
13. Ops / queues
14. Backup / restore
15. Production pipeline
16. Translation/audio operations
17. Website CMS
18. Blog
19. Technical SEO

P1 — BUSINESS GROWTH

20. Executive analytics
21. Revenue operations
22. Campaigns
23. Marketing funnel
24. Content Calendar
25. Bulk operations
26. Parent reports
27. Search
28. Recommendations
29. SEO Operations Center
30. Schools / Partnerships

P2 — SCALE

31. Presence / soft lock
32. A/B experimentation
33. advanced integrations
34. additional operational automation

Do not spend significant time on P2 while P0 remains broken.

==================================================
NO FAKE COMPLETION
==================================================

These words have strict meanings:

UI EXISTS
= React page exists.

BACKEND EXISTS
= real endpoint exists.

CONNECTED
= UI uses real endpoint.

FUNCTIONAL
= real data round-trip works.

SECURE
= backend authorization verified.

AUDITED
= action produces audit event.

PRODUCTION-READY
= functionality + validation + permissions + error handling + tests + required external configuration.

Do not use "Completed" unless the correct level is actually achieved.

==================================================
PRODUCTION SAFETY
==================================================

Do not:

- auto-deploy production
- perform destructive catalogue cleanup
- delete real customer/family data
- invent billing transactions
- create fake analytics
- expose private media
- move FamilyState authority into D1
- expose Google/TTS/payment secrets
- disable security controls
- publish review-gated content
- publish Islamic content without its required governance
- index private dashboard/app pages

==================================================
SOURCE CONTROL
==================================================

Use logical commits by implementation domain.

Examples:

admin(auth): ...
admin(support): ...
admin(workflow): ...
admin(marketing): ...
web(blog): ...
web(seo): ...
ops(...): ...

Do not create one massive unreviewable commit.

Before migrations/data writes:
create backups.

==================================================
DOCUMENTATION
==================================================

Update:

docs/DASHBOARDv2.md

so it reflects ACTUAL state rather than plans.

Create/update a canonical document such as:

docs/ADMIN_BUSINESS_OPERATIONS.md

describing:

- architecture
- modules
- permissions
- operational workflows
- external dependencies
- production checklist

Also maintain the established Kiro reports.

==================================================
KIRO REPORTING — REQUIRED
==================================================

Overwrite:

F:\Projects\cartoonapp\KIRO_LAST_REPORT.md

with the COMPLETE final report.

Append the task record to:

F:\Projects\cartoonapp\KIRO_REPORT_HISTORY.md

KIRO_LAST_REPORT.md must contain:

# Majarra Admin & Business Operations — Full Completion Report

## Executive Summary
## Before / After
## Dashboard Feature Matrix
## Authentication & Security
## Authorization Audit
## Executive Dashboard
## Customer 360
## Customer Support
## Devices & Downloads
## Plans & Pricing
## Subscription Operations
## Revenue
## Rights & Licensing
## Content CMS
## Production Workflow
## Story Builder
## Media Production
## Translation
## Dubbing / TTS
## Learning & Curriculum
## Quiz Builder
## Parent Reporting
## Home Builder
## Remote Config
## Kill Switch
## Release Center
## Marketing
## Campaigns
## Attribution
## Public Website CMS
## Blog
## SEO
## Technical SEO Verification
## Analytics
## SEO Operations
## Search
## Recommendations
## Operations / Queues
## Alerts
## Backup / Restore
## Audit Log
## Privacy
## Schools
## Partnerships
## Tests
## Builds
## Database Migrations
## Files Changed
## Commits
## Security Verification
## Remaining External Blockers
## Remaining Technical Debt
## Final Acceptance Checklist
## Exact Remaining Work

For every major module show:

✅ COMPLETE
⚠️ EXTERNAL BLOCKER
❌ INCOMPLETE

and explain why.

==================================================
FINAL ACCEPTANCE CHECKLIST
==================================================

Do not finish without explicitly reporting:

[ ] No fake/mock business data remains in active production admin flows
[ ] Backend permissions audited
[ ] MFA/security completed as far as available infrastructure permits
[ ] Customer 360 works
[ ] Support CRM works
[ ] Devices operations work
[ ] Plans/pricing operational domain works
[ ] Revenue reporting uses real data only
[ ] Rights/licensing works
[ ] Workflow engine works
[ ] Production management works
[ ] Quality/publish gates work
[ ] Story Builder complete
[ ] Translation center works
[ ] Audio/TTS operations work
[ ] Home Builder works
[ ] Remote Config works
[ ] Kill Switch works
[ ] Release Center works
[ ] Campaign management works
[ ] Website CMS works
[ ] Blog CMS works
[ ] Arabic blog works
[ ] English blog architecture works
[ ] French blog architecture works
[ ] SEO fields work
[ ] sitemap works
[ ] robots works
[ ] canonicals work
[ ] hreflang works
[ ] structured data works
[ ] admin/private pages are noindex
[ ] SEO audit interface exists
[ ] Analytics uses real events/data
[ ] Ops center reports real health
[ ] Queue failures can be handled
[ ] Backup workflow works
[ ] Restore safety verified
[ ] Audit coverage verified
[ ] Tests pass
[ ] builds pass
[ ] docs match reality

==================================================
FINAL STOP CONDITION
==================================================

Complete ALL technically possible P0 work first.

Then complete P1.

Then complete P2 only where it does not delay unresolved P0/P1 work.

Do not stop merely because one external integration is unavailable.

Finish all independent engineering around that blocker.

At completion:

1. Save the complete report to KIRO_LAST_REPORT.md.
2. Append KIRO_REPORT_HISTORY.md.
3. Provide the exact git commits.
4. List any external blockers separately.
5. Do NOT start another project phase.
6. STOP and wait for my approval.


==================================================
PART 2 — ADMIN UX / INFORMATION ARCHITECTURE COMPLETION PROGRAM (UX-1 .. UX-50)
==================================================

> Appended 2026-08-09. This section amends the plan above: the previously approved
> DASHBOARD v3 backend/business program is functionally broad, but the current Admin
> UI/UX is too shallow, CRUD-oriented and table/form-only for Majarra's scale.
> This is a HIGH-PRIORITY ADMIN UX + INFORMATION ARCHITECTURE + ENTITY DETAIL
> COMPLETION program, applied ACROSS THE ENTIRE ADMIN APPLICATION, not only the
> pages shown in screenshots.

CORE PRINCIPLE
--------------
Every important business object must have TWO distinct experiences:
1. COLLECTION / INDEX EXPERIENCE - find, compare, filter, sort, bulk-manage many objects.
2. ENTITY DETAIL / WORKSPACE EXPERIENCE - fully understand and operate one object.
Example: Planets list -> click Planet -> full Planet workspace. Same for Series,
Episodes, etc. Rows exposing only Edit/Delete is insufficient - the entity
name/card/image itself must normally be clickable into a dedicated detail workspace.

UX-1 GLOBAL COLLECTION PAGE STANDARD
Audit every collection/list page (planets, categories, series, seasons, episodes,
stories, books, comics, games, activities, characters, media assets, skills,
objectives, quizzes, parents, children, families, employees, teams, roles, tasks,
reviews, tickets, devices, downloads, plans, subscriptions, transactions, refunds,
rights, licenses, schools, partners, campaigns, blog posts, website pages, SEO
issues, releases, alerts, incidents, workflow items, production jobs, translations,
TTS/audio jobs). Every applicable page must offer multiple useful viewing modes.

UX-2 VIEW MODES: reusable infra for Table, Grid, Card, Compact, Kanban,
Hierarchy/Tree, Calendar, Timeline. Only expose views that make sense per entity
(e.g. Series: Table/Grid/Cards; Episodes: Table/Cards/Production Kanban; Media:
Grid/Table; Tasks: Table/Kanban; Content Calendar: Calendar/Timeline; Planets:
Grid/Table; Workflow: Kanban/Table).

UX-3 VIEW SWITCHER: consistent [Table][Grid][Cards][Kanban] switcher, remembers
user's last choice per page.

UX-4 PROFESSIONAL FILTER SYSTEM: reusable advanced filters with search, filters,
sorting, grouping, pagination, saved views, column selection, density, bulk
selection. Filters must be entity-aware (content: planet/category/age
track/series/season/type/production style/status/publication/language/translation
completeness/audio completeness/artwork completeness/workflow stage/reviewer/
owner/team/rights status/territory/dates/scheduled release/missing assets/quality
errors; family: country/plan/subscription status/registration date/#children/
#devices/ticket state; blog: language/category/author/tag/status/SEO health/
scheduled date; campaign: channel/country/language/status/owner/dates/objective).

UX-5 SAVED VIEWS: authorized admins can save PRIVATE/TEAM/SHARED reusable views
(e.g. "Episodes missing thumbnails", "French translation incomplete", "Rights
expiring in 30 days", "Failed payments", "My assigned reviews").

UX-6 COLUMN CUSTOMIZATION: show/hide, reorder, resize, sticky key columns, sort,
density options, reset to default. Avoid forcing constant horizontal scroll.

UX-7 VISUAL CONTENT REPRESENTATION (MAJOR): whenever an entity has a meaningful
visual asset, show it (planet artwork, series poster/cover, season/episode
thumbnail, story/book/game cover, character reference art, media thumbnail, blog
hero image, campaign creative, website page preview). No generic colored-letter
icon when a real image exists. Fallback: actual image -> inherited related image
-> meaningful generated placeholder. Images lazy-loaded, aspect-ratio safe,
crop-safe, accessible, responsive.

UX-8 PLANET DETAIL WORKSPACE (/admin/planets/:id): Header (artwork, AR/EN/FR
names, slug, status, age coverage, content count, actions) + tabs: Overview,
Content Hierarchy (Planet -> Categories -> Series -> Seasons -> Episodes/Stories/
Books/Games/Activities with counts, expand/collapse), Series (cards/table),
Statistics, Learning, Production, Localization, Media, Rights & Availability,
Analytics, Quality, Workflow, History.

UX-9 SERIES DETAIL WORKSPACE: Header (poster, banner, title, planet, age track,
content type, production style, publication state) + Overview, Content Tree
(Series -> Seasons -> Episodes with thumbnails), related Content Types (books,
games, activities, characters, stories, projects), Production Status (progress
per script/translation AR-EN-FR/voice/video/thumbnails/QA), Media, Characters,
Learning, Rights, Availability (allowed/blocked/scheduled per country), Workflow,
Analytics, Audit.

UX-10 EPISODE DETAIL WORKSPACE: Header (thumbnail, series, season, number,
title, duration, status) + Overview, Full script, Scenes, Production,
Localization, Voice/dubbing, Captions, Artwork/assets, Video, Learning
objectives, Quiz, Games, Family activity, Parent guide, Rights, Availability,
Workflow, QA, Analytics, Audit history. Clear production progress bars per
track (Editorial/AR/EN/FR/Voice/Video/Captions/QA).

UX-11 STORY DETAIL: cover, pages (with visual thumbnails, click to open page
editor/preview), illustrations, languages, narration, reading modes, age,
series, planet, workflow, QA, analytics.

UX-12 GAME DETAIL: cover, engine, objective, skills, age, difficulty, content
pack, levels, localization, voice prompts, visual assets, implementation
status, preview, attempts analytics, mastery relationship, QA, workflow.

UX-13 CHARACTER DETAIL: portrait/reference sheet, expressions, poses, voice
actor/config, series, episode appearances, style reference, approved artwork,
assets, name localization, production history.

UX-14 FAMILY/CUSTOMER DETAIL (Customer 360, richer visual UX): header + tabs
Overview, Subscription, Children, Devices, Downloads, Entitlements, Payments,
Support, Consents, Activity summary, Progress, Audit. No unnecessary
child-sensitive exposure.

UX-15 EMPLOYEE/ADMIN USER DETAIL: avatar/initials, name, email, status, role,
team memberships, scopes, content types, languages, current assignments,
review queue, tasks, recent admin activity, session/security state, last
login, MFA, audit history. Actions: edit, disable, reset/recovery, revoke
sessions, change role, assign team - all with permissions and audit.

UX-16 FIX CREATE EMPLOYEE UX: replace the cramped/isolated modal with a
right-side creation drawer or dedicated page, structured as: 1) Identity
(name/email), 2) Role (selector + description + capabilities), 3) Scope
(planet/content/language/team), 4) Security (temp password, strength,
force change, MFA), 5) Review (permission summary before create). Provide
inline validation, clear error states, duplicate email detection, disabled
submit until valid, loading state, success confirmation.

UX-17 GLOBAL ENTITY NAVIGATION: consistent clickable breadcrumbs
(Content -> Planet -> Series -> Season -> Episode) with previous/next nav.

UX-18 CONTEXTUAL SIDE PANEL: reusable Quick View (e.g. episode thumbnail click
shows thumbnail/status/progress/owner/languages/next task + "Open full page"),
does not replace the full detail workspace.

UX-19 GLOBAL SEARCH: true command/search navigation across authorized planets,
series, episodes, stories, games, media, family, customer, ticket, employee,
campaign, blog, rights. Results show type, thumbnail/icon, name, secondary
context, status. Click -> entity detail.

UX-20 DASHBOARD HOME COMPLETE REDESIGN: real business command center, not
random cards, role-aware modules:
- Top KPI bar (active families, paid subscribers, active children, revenue,
  new trials, conversion, churn, published content, production blockers,
  support backlog) with Today/7D/30D/Custom + trend vs previous period.
- Executive Overview charts only where real data exists (subscriptions,
  revenue, acquisition funnel, retention, churn, consumption, device mix).
- Content Operations (scheduled today, awaiting review, blockers, missing
  media, translation backlog, QA errors, upcoming releases).
- Production Pipeline (Writing/Review/Translation/Audio/Artwork/Video/QA/
  Ready/Scheduled counts, click-through filtered views).
- Team Work (my tasks, overdue, unassigned, reviews waiting, team workload).
- Customer Operations (open tickets, SLA breaches, failed payments,
  subscription issues, device problems).
- Rights (expiring soon, expired, territory conflicts).
- Marketing (active campaigns, starting soon, recent performance, publishing
  schedule).
- SEO/Website (critical issues, scheduled posts, broken links, indexability).
- Technical Operations (real Worker health, queue backlog, failed jobs, last
  backup, incidents, storage/media errors - never fake green indicators).
- Activity Stream (avatar, action, entity thumbnail/name, timestamp, result;
  click opens affected entity).
- Customizable/role-aware home with presets: Owner/Executive, Content
  Manager, Production Manager, Marketing, Support, Finance, Engineering Ops.

UX-21 THUMBNAILS IN TABLES: first meaningful column includes
[thumbnail] Title / subtitle-context (episode+series, series+planet,
story cover+title, blog hero+title, etc).

UX-22 EMPTY STATE QUALITY: explain what's missing, why, what action is
available. Never a blank dark container.

UX-23 FORM SYSTEM OVERHAUL: reusable standard with sections, field groups,
help text, validation, required indicators, autosave where appropriate,
unsaved-changes warning, sticky save bar, keyboard accessibility. Long forms
use tabs/sections/stepper/drawer/dedicated page based on complexity, not giant
undifferentiated modals.

UX-24 MODAL/DRAWER RULES: modal only for confirmations/small forms/short
actions; side drawer for quick edit/filters/quick create/quick view;
dedicated pages for large content editing, employee permissions, episode/
series editing, story building, rights/licensing, campaign configuration.

UX-25 FILTER DRAWER: basic filters visible; "More filters" opens a side
drawer; active filters shown as removable chips; Clear all / Save view /
Apply.

UX-26 BULK SELECTION UX: contextual bulk action bar on selection (e.g.
"12 episodes selected" -> Assign reviewer / Change status / Schedule / Add
tags / Export), only actions valid for entity + permissions.

UX-27 STATUS LANGUAGE: standardize status chips/colors globally (Draft, In
Review, Changes Requested, Approved, Production, QA, Scheduled, Published,
Archived, Blocked) - one vocabulary across the whole dashboard.

UX-28 ANALYTICS INSIDE ENTITY PAGES: contextual analytics on Series/Episode/
Campaign/Blog post/Plan/Planet detail pages in addition to the Global
Analytics page for cross-business analysis.

UX-29 GEOGRAPHIC AVAILABILITY UX: central Territory/Availability component
reusable across series, episodes, stories, books, games, licensed content,
plans, promos, campaigns, homepage modules. Modes: Worldwide / Worldwide
except selected / Selected only / Unavailable. Show country, status,
start/end, source/reason (rights/commercial/editorial/legal/campaign
targeting). Support inherited policy with explicit INHERITED vs OVERRIDDEN
indicator on detail pages.

UX-30 CONTENT HIERARCHY EXPLORER: reusable visual explorer (Planet -> Series
-> Season -> Episode/Game/Book/Activity) with expand/collapse, thumbnail,
status, language completeness, production status, direct navigation. Usable
both as a standalone Content Explorer page and embedded in Planet/Series
detail.

UX-31 MEDIA PREVIEW: image preview, safe video preview, audio player (+
waveform if practical), document metadata/download where authorized - no
raw R2 URLs.

UX-32 ENTITY RELATIONSHIPS: every entity workspace shows related objects,
all clickable, no dead labels (e.g. Episode -> Series/Season/Characters/
Objectives/Games/Activities/Assets/Reviews/Tasks/Rights/Campaign placements).

UX-33 OPERATIONAL ACTION MENUS: primary click opens detail; secondary "..."
menu for Edit/Duplicate/Schedule/Assign/Archive/View history; dangerous
actions visually separated. Avoid 6 icon buttons per row.

UX-34 PAGINATION / LARGE DATA: proper server-side pagination/sorting/
filtering/search everywhere large ("1-50 of 4,281"); never load full
datasets into the browser.

UX-35 URL STATE: filters/page/sort/active tab reflected in URL/query state
for refresh-safety, shareable links, browser back/forward.

UX-36 CROSS-PAGE CONSISTENCY CHECKLIST (apply to every page): has image? show
it. can it open? make clickable. has detail page? provide it. is a
collection? filter/search/sort/paginate. another view mode useful? add
switcher. has status? standardize chip. has related entities? link them. has
operations? action menu. supports bulk? bulk toolbar. needs metrics?
contextual summary.

UX-37 NAVIGATION/SIDEBAR RESTRUCTURE: group logically instead of
accumulating dozens of flat links - Overview / Content (Planets, Series,
Episodes, Stories, Books, Games, Activities, Characters, Media) / Production
(Pipeline, Tasks, Reviews, Workflow, Calendar, Translation, Audio/TTS,
Quality) / Learning (Skills, Objectives, Mastery, Quizzes) / Customers
(Families, Parents, Children, Devices, Support) / Commercial (Plans,
Subscriptions, Revenue, Promotions, Rights) / Growth (Campaigns, Marketing,
Website, Blog, SEO) / B2B (Schools, Partnerships) / App Control (Home
Builder, Recommendations, Remote Config, Releases) / Operations (Health,
Queues, Alerts, Backups) / Administration (Employees, Teams, Roles, Audit,
Settings). Adapt to actual modules and permissions.

UX-38 COMMAND CENTER HEADER: Global Search, Create button (permission-aware
shortcuts: New Series/Episode/Story/Campaign/Blog Post/Ticket), Notifications,
Tasks, Language, Theme, Admin profile.

UX-39 UI RESPONSIVENESS/LAYOUT BUGS: audit visually at 1366x768, 1440x900,
1920x1080, large tablet. Fix overflowing dialogs, excessive whitespace,
clipped sidebar/header, broken RTL, inconsistent container width, content
hidden behind fixed elements, tables exceeding viewport, avoidable horizontal
scroll, modals taller than viewport, weak spacing, inconsistent alignment.
Desktop-first.

UX-40 RTL/LTR: genuinely RTL Arabic dashboard - nav, tables, pagination,
icons, drawers, forms, breadcrumbs, charts, tooltips, modals. EN switch
produces true LTR. Not just translated text with wrong layout direction.

UX-41 DESIGN DENSITY: professional, data-rich, not cluttered; eliminate
large empty areas; desktop admin density, not a consumer mobile app.

UX-42 LOADING/ERROR/SKELETON STATES: every major data surface supports
loading, skeleton, empty, error, retry, permission-denied. No blank screens
or indefinite spinners.

UX-43 EXPORT/SHARE VIEW: export current filtered view (CSV/XLSX) reflecting
active filters where practical.

UX-44 REAL TEST DATA RULE: no fake data to make redesigned pages look
richer - use real D1 records/projections/assets; zero data shows a correctly
designed empty state.

UX-45 COMPONENT LIBRARY (build once, reuse everywhere): EntityThumbnail,
EntityTitleCell, ViewSwitcher, AdvancedFilterBar, FilterDrawer,
SavedViewSelector, ColumnManager, BulkActionBar, StatusChip,
ProductionProgress, LanguageCompleteness, MediaCompleteness,
CountryAvailability, EntityBreadcrumbs, EntityHeader, DetailTabs,
RelationList, MetricCard, TrendCard, ActivityFeed, QuickViewDrawer,
EmptyState, ErrorState, ConfirmAction, EntityActionMenu.

UX-46 DETAIL PAGE STANDARD: Entity Header (thumbnail, title, context, status,
primary action) + Summary Metrics + Tabs (only relevant ones): Overview,
Related Content, Production, Localization, Media, Workflow, Analytics,
Rights/Availability, History.

UX-47 FULL PAGE-BY-PAGE AUDIT: audit all registered Admin routes visually and
functionally; for each record current view, usefulness, missing view modes/
filters/search/images/detail nav/metrics/bulk ops/pagination/empty-error UX/
drilldown/related entities/layout bugs, then fix them. Do not stop after
Series and Dashboard Home.

ACCEPTANCE CRITERIA
- UX-47 (Planets): grid/cards, filter/search, view switch, click -> full
  workspace, drill into series -> season -> episode. No dead end.
- UX-48 (Series): Table/Grid/Card, images, filters, click -> full detail with
  episodes/statistics/media/production/translations/rights/analytics/workflow.
- UX-49 (Dashboard Home): real operational command center (business KPI,
  content, production, team/tasks, customer/support, marketing, rights,
  system health, alerts, recent activity, upcoming work), role-aware.
- UX-50 (Every collection) - before calling this complete, every collection
  page must answer YES to: searchable? filterable? sortable? correct
  pagination? item openable? real detail page? image visualized if it has
  one? another view mode useful and present? bulk-manageable where
  appropriate? related entities clickable? good loading/error/empty states?
  URL state preserved? RTL correct? Any relevant NO = page incomplete.

IMPORTANT: this is an INFORMATION ARCHITECTURE and ADMIN OPERATING UX
problem, not a "prettier cards" problem. Target: a new senior content
manager, production manager, marketer, support agent or owner opens the
dashboard and understands WHAT EXISTS, WHERE IT BELONGS, WHAT STATE IT IS
IN, WHAT IS MISSING, WHO OWNS IT, WHAT HAPPENS NEXT, HOW IT IS PERFORMING -
without querying the database or navigating unrelated pages.

EXECUTION PRIORITY (this UX/IA program is now part of the core Dashboard v3
implementation - do not postpone it until after every backend phase; build
reusable Admin UX primitives early so later modules use the correct design
from the start):
1. Shared Admin design/list/detail infrastructure (view modes, filter bar,
   saved views, column manager, bulk bar, status chips, entity header/tabs,
   breadcrumbs, thumbnails, empty/error/loading states - the component
   library in UX-45).
2. Dashboard Home redesign (UX-20).
3. Planets/Series/Season/Episode drilldown workspaces (UX-8, UX-9, UX-10).
4. All remaining Content pages (Stories, Books, Games, Activities,
   Characters, Media - UX-11, UX-12, UX-13).
5. Production/Workflow.
6. Customers/Support (Family 360, Employee detail - UX-14, UX-15, plus the
   Create Employee redesign in UX-16).
7. Marketing/Website/Blog.
8. Commercial.
9. Operations.
10. Remaining pages.

REPORTING: add a dedicated "## Admin UX / Information Architecture
Completion" section to F:\Projects\cartoonapp\KIRO_LAST_REPORT.md covering
pages audited, pages redesigned, view modes implemented, detail pages added,
drilldowns added, reusable components built, filtering coverage,
thumbnail/image coverage, bulk actions, responsive fixes, RTL fixes,
remaining pages, and manual verification performed. Also update the
canonical Dashboard documentation.

FINAL RULE: do not claim the Majarra Admin is complete merely because all
business modules exist. It is complete only when those modules are
practical to operate at scale through a rich, coherent, searchable,
filterable, drillable, visual, role-aware interface.



The previously approved `DASHBOARD v3` plan is functionally broad, but the current Admin UI/UX is far too small, shallow and CRUD-oriented for the scale of Majarra.

I have reviewed the actual dashboard visually.

The problem is NOT only missing backend/business modules.

The dashboard itself currently feels like:
- simple tables
- simple forms
- shallow pages
- sparse overview screens
- weak information hierarchy
- very limited drill-down
- little visual content representation
- too much unused space
- insufficient operational density
- insufficient management context

This is NOT acceptable for the final Majarra Admin.

Majarra must have an enterprise-grade content/business operating dashboard capable of managing a large streaming, education, content, production and subscription business.

Treat this as a HIGH-PRIORITY ADMIN UX + INFORMATION ARCHITECTURE + ENTITY DETAIL COMPLETION program.

Do not redesign only the pages shown in screenshots.

Apply the principles below ACROSS THE ENTIRE ADMIN APPLICATION.

==================================================
CORE PRINCIPLE
==================================================

Every important business object must have TWO distinct experiences:

1. COLLECTION / INDEX EXPERIENCE
   Used to find, compare, filter, sort and bulk-manage many objects.

2. ENTITY DETAIL / WORKSPACE EXPERIENCE
   Used to completely understand and operate one specific object.

Example:

Planets list
→ click Planet
→ full Planet workspace

Series list
→ click Series
→ full Series workspace

Episode list
→ click Episode
→ full Episode workspace

The existing pattern where rows only expose Edit/Delete actions is insufficient.

The entity name/card/image itself should normally be clickable and open a dedicated detail workspace.

==================================================
PHASE UX-1 — GLOBAL COLLECTION PAGE STANDARD
==================================================

Audit EVERY page that displays a collection/list.

Examples include but are not limited to:

- planets
- categories
- series
- seasons
- episodes
- stories
- books
- comics
- games
- activities
- characters
- media assets
- skills
- objectives
- quizzes
- parents
- children
- families
- employees
- teams
- roles
- tasks
- reviews
- tickets
- devices
- downloads
- plans
- subscriptions
- transactions
- refunds
- rights
- licenses
- schools
- partners
- campaigns
- blog posts
- website pages
- SEO issues
- releases
- alerts
- incidents
- workflow items
- production jobs
- translations
- TTS/audio jobs

Every applicable collection page must provide multiple useful viewing modes.

==================================================
VIEW MODES
==================================================

Build reusable view-mode infrastructure.

Depending on entity type, support appropriate combinations of:

TABLE VIEW
- dense operational data
- configurable columns

GRID VIEW
- visual thumbnails/cards

CARD VIEW
- richer metadata cards

COMPACT VIEW
- maximum density

KANBAN VIEW
- workflow/status-based entities

HIERARCHY / TREE VIEW
- hierarchical content

CALENDAR VIEW
- scheduled entities

TIMELINE VIEW
- production/release/history entities

Do NOT force every view onto every object.

Only expose views that actually make sense.

Example:

Series:
Table / Grid / Cards

Episodes:
Table / Cards / Production Kanban

Media:
Grid / Table

Tasks:
Table / Kanban

Content Calendar:
Calendar / Timeline

Planets:
Grid / Table

Workflow:
Kanban / Table

==================================================
PHASE UX-2 — VIEW SWITCHER
==================================================

Add a consistent view switcher to applicable pages.

Example:

[ Table ] [ Grid ] [ Cards ] [ Kanban ]

Remember the user's selected view where reasonable.

The user should not be forced back to the default table every time.

==================================================
PHASE UX-3 — PROFESSIONAL FILTER SYSTEM
==================================================

Current filters are far too limited.

Create a reusable advanced filter system.

Every applicable list page should support:

- search
- filters
- sorting
- grouping
- pagination
- saved views
- column selection
- display density
- bulk selection

Filters should be entity-aware.

CONTENT example:

- planet
- category
- age track
- series
- season
- content type
- production style
- status
- publication status
- language
- translation completeness
- audio completeness
- artwork completeness
- workflow stage
- reviewer
- owner
- team
- rights status
- territory
- date created
- date updated
- scheduled release
- missing assets
- quality errors

FAMILY example:

- country
- plan
- subscription status
- registration date
- number of children
- number of devices
- support ticket state

BLOG example:

- language
- category
- author
- tag
- status
- SEO health
- scheduled date

CAMPAIGN example:

- channel
- country
- language
- status
- owner
- start/end
- objective

==================================================
PHASE UX-4 — SAVED VIEWS
==================================================

Allow authorized admins to save reusable views.

Examples:

"Episodes missing thumbnails"

"French translation incomplete"

"Publishing this week"

"Islamic content awaiting Sharia review"

"Rights expiring in 30 days"

"Failed payments"

"Support SLA breached"

"My assigned reviews"

Saved views may be:

PRIVATE
TEAM
SHARED

depending on permissions.

==================================================
PHASE UX-5 — COLUMN CUSTOMIZATION
==================================================

Tables must support:

- show/hide columns
- reorder columns
- resize where practical
- sticky important columns
- sort
- density options

Allow reset to default.

Do not make tables so wide that normal operations require constant horizontal scrolling.

==================================================
PHASE UX-6 — VISUAL CONTENT REPRESENTATION
==================================================

This is a MAJOR requirement.

Whenever an entity has a meaningful visual asset, DISPLAY IT.

Examples:

Planet:
planet artwork/icon

Series:
poster / cover

Season:
series poster or season artwork

Episode:
thumbnail

Story:
cover

Book:
cover

Game:
cover

Character:
reference art/avatar

Activity:
cover

Media:
actual thumbnail/preview

Blog:
hero image

Campaign:
creative thumbnail

Website page:
page preview/screenshot where available

Do NOT show a generic colored letter icon if a real appropriate image exists.

Fallback hierarchy:

actual entity image
→ inherited related image
→ meaningful generated placeholder/icon

Images must be:

- lazy loaded
- aspect-ratio safe
- crop-safe
- accessible
- responsive

==================================================
PHASE UX-7 — PLANET DETAIL WORKSPACE
==================================================

Currently clicking a planet must NOT lead nowhere or only to edit.

Create:

/admin/planets/:id

or architecture-consistent equivalent.

Planet Detail must be a complete workspace.

HEADER:

- planet artwork
- Arabic name
- English/French localized names
- slug
- status
- age coverage
- content count
- main actions

TABS / SECTIONS:

OVERVIEW

Show:

- description
- purpose
- target ages
- languages
- owners/team
- status

CONTENT HIERARCHY

Planet
→ Categories
→ Series
→ Seasons
→ Episodes / Stories / Books / Games / Activities

Show counts at every level.

Allow expansion/collapse.

SERIES

Visual cards/table of all series belonging to planet.

STATISTICS

- series count
- episode count
- story count
- game count
- book count
- activity count
- published/draft
- production completeness
- translation completeness
- media completeness

LEARNING

- skills
- learning objectives
- age-track coverage
- curriculum coverage

PRODUCTION

- scripts
- artwork
- voice
- video
- captions
- outstanding work

LOCALIZATION

AR / EN / FR completeness.

MEDIA

Posters, banners, planet cover, related assets.

RIGHTS & AVAILABILITY

- country availability
- territory restrictions
- licensing

ANALYTICS

When real analytics exist:
- consumption
- completion
- engagement
- top series

QUALITY

Open QA issues.

WORKFLOW

Pending reviews/tasks.

HISTORY

changes / publishing / audit.

==================================================
PHASE UX-8 — SERIES DETAIL WORKSPACE
==================================================

Create a rich dedicated Series page.

Clicking a series anywhere should normally open it.

HEADER:

- poster
- banner
- title
- planet
- age track
- content type
- production style
- publication state

OVERVIEW:

- synopsis
- purpose
- audience
- metadata

CONTENT TREE:

Series
→ Seasons
→ Episodes

Show visual thumbnails for episodes.

CONTENT TYPES:

Also show related:

- books
- games
- activities
- characters
- stories
- projects

depending on series.

PRODUCTION STATUS:

Progress indicators such as:

Scripts 6/6
Translations:
AR 6/6
EN 2/6
FR 0/6

Voice:
AR ...
EN ...
FR ...

Video:
...

Thumbnails:
...

QA:
...

MEDIA:

poster/banner/trailer/gallery.

CHARACTERS:

character cards and relationships.

LEARNING:

objectives/skills.

RIGHTS:

territories, dates, restrictions.

AVAILABILITY:

countries where:
allowed
blocked
scheduled

WORKFLOW:

current stage
reviewers
tasks
deadlines.

ANALYTICS:

views/completion/favorites/search/recommendation contribution when instrumented.

AUDIT:

history.

==================================================
PHASE UX-9 — EPISODE DETAIL WORKSPACE
==================================================

Every episode needs its own serious workspace.

Header:

thumbnail
series
season
episode number
title
duration
status

Sections:

- Overview
- Full script
- Scenes
- Production
- Localization
- Voice/dubbing
- Captions
- Artwork/assets
- Video
- Learning objectives
- Quiz
- Games
- Family activity
- Parent guide
- Rights
- Availability
- Workflow
- QA
- Analytics
- Audit history

Provide clear production progress.

Example:

Editorial        100%
Arabic           100%
English           60%
French             0%
Voice              0%
Video              0%
Captions            0%
QA                  0%

==================================================
PHASE UX-10 — STORY DETAIL
==================================================

Story detail page should show:

cover
pages
illustrations
languages
narration
reading modes
age
series
planet
workflow
QA
analytics

Include visual page thumbnails.

Clicking a page should open page editing/preview.

==================================================
PHASE UX-11 — GAME DETAIL
==================================================

Game page:

- cover
- engine
- objective
- skills
- age
- difficulty
- content pack
- levels
- localization
- voice prompts
- visual assets
- implementation status
- preview
- attempts analytics
- mastery relationship
- QA
- workflow

==================================================
PHASE UX-12 — CHARACTER DETAIL
==================================================

Character page:

- portrait/reference sheet
- expressions
- poses
- voice actor/voice config
- series
- episode appearances
- style reference
- approved artwork
- assets
- languages/name localization
- production history

==================================================
PHASE UX-13 — FAMILY / CUSTOMER DETAIL
==================================================

Use the previously required Customer 360 but make the visual UX significantly richer.

Family Detail should have a strong summary header and tabs.

Overview
Subscription
Children
Devices
Downloads
Entitlements
Payments
Support
Consents
Activity summary
Progress
Audit

Do not expose unnecessary child-sensitive information.

==================================================
PHASE UX-14 — EMPLOYEE / ADMIN USER DETAIL
==================================================

The current employee experience is too shallow.

Create Employee Detail:

- avatar / initials
- name
- email
- account status
- role
- team memberships
- scopes
- content types
- languages
- current assignments
- review queue
- tasks
- recent admin activity
- session/security state
- last login
- MFA
- audit history

Actions:

- edit
- disable
- reset/recovery flow
- revoke sessions
- change role
- assign team

with permissions and audit.

==================================================
PHASE UX-15 — FIX CREATE EMPLOYEE UX
==================================================

The current "Add employee" modal UX shown in the actual dashboard needs redesign.

Problems to solve:

- form feels visually isolated
- layout wastes screen space
- role selection lacks context
- poor information hierarchy
- insufficient permission visibility
- large overlay gives weak orientation

Use either:

A) a properly sized responsive modal for simple creation

OR

B) preferably a right-side creation drawer / dedicated create page if required fields grow.

Employee creation should support:

STEP / SECTION 1 — Identity

name
email

STEP / SECTION 2 — Role

role selector
role description
what this role can do

STEP / SECTION 3 — Scope

planet/content scope
language scope
team

where applicable.

STEP / SECTION 4 — Security

temporary password
password strength
require password change
MFA requirement where supported

STEP / SECTION 5 — Review

summarize permissions before create.

Provide:

- inline validation
- clear error states
- duplicate email detection
- disabled submit until valid
- loading state
- success confirmation

==================================================
PHASE UX-16 — GLOBAL ENTITY NAVIGATION
==================================================

Add consistent breadcrumbs.

Example:

Content
→ Planet: Abjad
→ Series: Luna Discovers Words
→ Season 1
→ Episode 4

Every level should be clickable.

Provide previous/next navigation where useful.

==================================================
PHASE UX-17 — CONTEXTUAL SIDE PANEL
==================================================

For fast operations, introduce a reusable quick-view panel where useful.

Example:

Clicking an episode thumbnail from a table can provide Quick View:

thumbnail
status
production progress
owner
languages
next task

with:

Open full page

This should not replace the full Detail Workspace.

==================================================
PHASE UX-18 — GLOBAL SEARCH
==================================================

Upgrade global search into true command/search navigation.

Search across authorized:

- planets
- series
- episodes
- stories
- games
- media
- family
- customer
- ticket
- employee
- campaign
- blog
- rights

Results should contain:

type
thumbnail/icon
name
secondary context
status

Click → entity detail.

==================================================
PHASE UX-19 — DASHBOARD HOME COMPLETE REDESIGN
==================================================

The current dashboard home is far too sparse.

It must become an actual business command center.

Do NOT simply add random cards.

Build role-aware modules.

TOP KPI BAR:

Possible real metrics:

- active families
- paid subscribers
- active children
- revenue
- new trials
- conversion
- churn
- published content
- production blockers
- support backlog

with:

Today
7D
30D
Custom

and trend versus previous comparable period.

==================================================
EXECUTIVE OVERVIEW
==================================================

Add meaningful charts when data exists:

- subscriptions trend
- revenue trend
- acquisition funnel
- retention
- churn
- content consumption
- platform/device mix

Do not draw meaningless charts for unavailable data.

==================================================
CONTENT OPERATIONS
==================================================

Home should show:

- content scheduled today
- content awaiting review
- production blockers
- missing media
- translation backlog
- QA errors
- upcoming releases

==================================================
PRODUCTION PIPELINE
==================================================

Show pipeline counts:

Writing
Review
Translation
Audio
Artwork
Video
QA
Ready
Scheduled

Provide click-through filtered views.

==================================================
TEAM WORK
==================================================

Show:

- my tasks
- overdue tasks
- unassigned tasks
- reviews waiting for me
- team workload

==================================================
CUSTOMER OPERATIONS
==================================================

Show:

- open tickets
- SLA breaches
- failed payments
- subscription issues
- device problems

==================================================
RIGHTS
==================================================

Show:

- rights expiring soon
- expired rights
- territory conflicts

==================================================
MARKETING
==================================================

Show:

- campaigns currently active
- campaigns starting soon
- recent campaign performance
- content/blog publishing schedule

==================================================
SEO / WEBSITE
==================================================

Show:

- SEO critical issues
- blog posts scheduled
- broken links
- indexability problems

==================================================
TECHNICAL OPERATIONS
==================================================

Show actual:

- Worker health
- queue backlog
- failed jobs
- latest backup
- incidents
- storage/media errors

Never use fake green indicators.

==================================================
ACTIVITY STREAM
==================================================

Current "recent activities" experience should be richer.

Show:

user/avatar
action
entity thumbnail
entity name
timestamp
result

Example:

Ahmed approved Episode 14
[thumbnail]

Sara updated Series "..."
[poster]

Click should open affected entity.

==================================================
CUSTOMIZABLE HOME
==================================================

Allow dashboard modules to be rearranged/hidden where practical.

Potential presets:

Owner / Executive
Content Manager
Production Manager
Marketing
Support
Finance
Engineering Ops

Permissions control data access.

==================================================
PHASE UX-20 — THUMBNAILS IN TABLES
==================================================

For content entities with artwork, the first meaningful column should often include:

[thumbnail] Title
             subtitle/context

Examples:

Episode:
thumbnail + episode title + series

Series:
poster + title + planet

Story:
cover + title

Blog:
hero + title

This drastically improves scanning.

==================================================
PHASE UX-21 — EMPTY STATE QUALITY
==================================================

Never show giant empty dark containers.

Empty state should explain:

- what is missing
- why
- what action can be taken

Example:

"No revenue data yet because no payment provider is configured."

NOT:

blank card.

==================================================
PHASE UX-22 — FORM SYSTEM OVERHAUL
==================================================

All forms should follow a coherent reusable standard.

Support:

- sections
- field groups
- help text
- validation
- required indicators
- autosave where appropriate
- unsaved changes warning
- sticky save bar
- keyboard accessibility

Long forms should not be giant undifferentiated modal forms.

Use:

tabs
sections
stepper
drawer
dedicated page

based on complexity.

==================================================
PHASE UX-23 — MODAL/DRAWER RULES
==================================================

Use modal only for:

- confirmations
- small forms
- short actions

Use side drawer for:

- quick edit
- filters
- quick create
- quick view

Use dedicated pages for:

- large content editing
- employee permissions
- episode editing
- series editing
- story building
- rights/licensing
- campaign configuration

Do not place complex business workflows inside cramped modals.

==================================================
PHASE UX-24 — FILTER DRAWER
==================================================

On pages with many filters:

basic filters remain visible.

"More filters"
opens a side drawer.

Show active filters as removable chips.

Provide:

Clear all
Save view
Apply

==================================================
PHASE UX-25 — BULK SELECTION UX
==================================================

When rows/cards are selected, show contextual bulk action bar.

Example:

12 episodes selected

[Assign reviewer]
[Change status]
[Schedule]
[Add tags]
[Export]

Only show actions valid for current entity and permissions.

==================================================
PHASE UX-26 — STATUS LANGUAGE
==================================================

Standardize status display globally.

Examples:

Draft
In Review
Changes Requested
Approved
Production
QA
Scheduled
Published
Archived
Blocked

Use one consistent chip/color semantics across dashboard.

Do not have different pages invent different wording/colors.

==================================================
PHASE UX-27 — ANALYTICS INSIDE ENTITY PAGES
==================================================

Do not isolate all analytics in one Analytics page.

Analytics should ALSO appear contextually.

Example:

Series detail
→ series-specific performance

Episode detail
→ episode performance

Campaign detail
→ campaign performance

Blog post
→ article performance

Plan
→ plan subscription performance

Planet
→ planet engagement

Global Analytics remains for cross-business analysis.

==================================================
PHASE UX-28 — GEOGRAPHIC AVAILABILITY UX
==================================================

Add a central Territory / Availability component reusable across:

- series
- episodes
- stories
- books
- games
- licensed content
- plans
- promos
- campaigns
- homepage modules where appropriate

UI modes:

Worldwide

Worldwide except selected countries

Selected countries only

Unavailable

Show:

country
status
start
end
source/reason:
rights
commercial
editorial
legal
campaign targeting

Allow parent/inherited policy.

Example:

Planet/Series policy inherited by children unless overridden.

Detail pages must show whether availability is:

INHERITED
or
OVERRIDDEN

==================================================
PHASE UX-29 — CONTENT HIERARCHY EXPLORER
==================================================

Build a reusable visual explorer:

Planet
  Series
    Season
      Episode
      Game
      Book
      Activity

Expand/collapse.

Show:

thumbnail
status
language completeness
production status

Support direct navigation.

This can appear both as:

Content Explorer page

and inside Planet/Series detail.

==================================================
PHASE UX-30 — MEDIA PREVIEW
==================================================

Media items should be previewable from Admin.

Image:
visual preview

Video:
safe admin preview

Audio:
player + waveform if practical

Document:
metadata/download where authorized

Do not require opening raw R2 URLs manually.

==================================================
PHASE UX-31 — ENTITY RELATIONSHIPS
==================================================

Every entity workspace should show related objects.

Example Episode:

Series
Season
Characters
Objectives
Games
Activities
Assets
Reviews
Tasks
Rights
Campaign placements

Click through every relationship.

No dead labels.

==================================================
PHASE UX-32 — OPERATIONAL ACTION MENUS
==================================================

Avoid filling every table row with 6 icon buttons.

Use:

primary click → open detail

secondary:
... action menu

Typical:

Edit
Duplicate
Schedule
Assign
Archive
View history

Dangerous actions separated visually.

==================================================
PHASE UX-33 — PAGINATION / LARGE DATA
==================================================

Every potentially large collection must support proper server-side:

pagination
sorting
filtering
search

Provide:

page size
total
current range

Examples:

1–50 of 4,281

Avoid loading complete datasets into the browser.

==================================================
PHASE UX-34 — URL STATE
==================================================

Filters, page, sorting and active tab should be represented in URL/query state where practical.

This allows:

- refresh without losing view
- shareable operational links
- browser back/forward

==================================================
PHASE UX-35 — CROSS-PAGE CONSISTENCY
==================================================

Audit every page against a shared checklist:

Does the object have an image?
→ show it.

Can it be opened?
→ clickable.

Does it have a detail page?
→ provide it.

Is it a collection?
→ filtering/search/sort/pagination.

Does another meaningful view exist?
→ view switcher.

Does it have status?
→ standardized chip.

Does it have related entities?
→ links.

Does it have operations?
→ action menu.

Does it support bulk work?
→ bulk toolbar.

Does it need metrics?
→ contextual summary.

==================================================
PHASE UX-36 — NAVIGATION / SIDEBAR RESTRUCTURE
==================================================

Review the sidebar information architecture.

Do not simply accumulate dozens of links.

Group logically, for example:

OVERVIEW

CONTENT
- Planets
- Series
- Episodes
- Stories
- Books
- Games
- Activities
- Characters
- Media

PRODUCTION
- Pipeline
- Tasks
- Reviews
- Workflow
- Calendar
- Translation
- Audio / TTS
- Quality

LEARNING
- Skills
- Objectives
- Mastery
- Quizzes

CUSTOMERS
- Families
- Parents
- Children
- Devices
- Support

COMMERCIAL
- Plans
- Subscriptions
- Revenue
- Promotions
- Rights

GROWTH
- Campaigns
- Marketing
- Website
- Blog
- SEO

B2B
- Schools
- Partnerships

APP CONTROL
- Home Builder
- Recommendations
- Remote Config
- Releases

OPERATIONS
- Health
- Queues
- Alerts
- Backups

ADMINISTRATION
- Employees
- Teams
- Roles
- Audit
- Settings

Adapt to actual modules and permissions.

==================================================
PHASE UX-37 — COMMAND CENTER HEADER
==================================================

Upgrade global header.

Include where appropriate:

Global Search
Create button
Notifications
Tasks
Language
Theme
Admin profile

Global Create can provide permission-aware shortcuts:

New Series
New Episode
New Story
New Campaign
New Blog Post
New Ticket

==================================================
PHASE UX-38 — UI RESPONSIVENESS / LAYOUT BUGS
==================================================

Audit actual layouts visually at:

1366×768
1440×900
1920×1080
large tablet

Fix:

- overflowing dialogs
- excessive whitespace
- clipped sidebar/header
- broken RTL
- inconsistent container width
- content hidden behind fixed elements
- tables exceeding viewport badly
- horizontal scrolling where avoidable
- modals taller than viewport
- weak spacing
- inconsistent alignment

The dashboard remains desktop-first.

==================================================
PHASE UX-39 — RTL/LTR
==================================================

Arabic dashboard must be genuinely RTL.

Verify:

navigation
tables
pagination
icons
drawers
forms
breadcrumbs
charts
tooltips
modals

Switching to EN should produce true LTR.

Do not merely translate text while leaving layout direction incorrect.

==================================================
PHASE UX-40 — DESIGN DENSITY
==================================================

The dashboard should look professional and data-rich without becoming cluttered.

Current large empty areas must be eliminated.

Use space to surface useful operational context.

Desktop admin screens should have appropriate density.

Do NOT imitate a consumer mobile app.

==================================================
PHASE UX-41 — LOADING / ERROR / SKELETON STATES
==================================================

Every major data surface must support:

loading
skeleton
empty
error
retry
permission denied

Avoid blank screens and indefinite spinners.

==================================================
PHASE UX-42 — EXPORT / SHARE VIEW
==================================================

Where permitted:

Export current filtered view.

Example:

filtered production table
→ export CSV/XLSX.

Exports should reflect current filters when practical.

==================================================
PHASE UX-43 — REAL DASHBOARD TEST DATA RULE
==================================================

Do NOT introduce fake data to make redesigned pages look richer.

Use:

real D1 records
real projections
real assets

If the business has zero revenue or zero users in local/dev:

show correctly designed zero/empty state.

==================================================
PHASE UX-44 — COMPONENT LIBRARY
==================================================

Build reusable primitives instead of duplicating page-specific code:

EntityThumbnail
EntityTitleCell
ViewSwitcher
AdvancedFilterBar
FilterDrawer
SavedViewSelector
ColumnManager
BulkActionBar
StatusChip
ProductionProgress
LanguageCompleteness
MediaCompleteness
CountryAvailability
EntityBreadcrumbs
EntityHeader
DetailTabs
RelationList
MetricCard
TrendCard
ActivityFeed
QuickViewDrawer
EmptyState
ErrorState
ConfirmAction
EntityActionMenu

Reuse them throughout Admin.

==================================================
PHASE UX-45 — DETAIL PAGE STANDARD
==================================================

Every important detail page should generally have:

ENTITY HEADER

Thumbnail/image
Title
Context
Status
Primary action

SUMMARY METRICS

TABS

Overview
Related Content
Production
Localization
Media
Workflow
Analytics
Rights/Availability
History

Only include tabs relevant to that entity.

==================================================
PHASE UX-46 — FULL PAGE-BY-PAGE AUDIT
==================================================

Audit ALL registered Admin routes visually and functionally.

For every page record:

- current view
- usefulness
- missing view modes
- missing filters
- missing search
- missing images
- missing detail navigation
- missing metrics
- missing bulk operations
- missing pagination
- missing empty/error UX
- missing drilldown
- missing related entities
- layout bugs

Then FIX them.

Do not stop after fixing Series and Dashboard Home.

==================================================
PHASE UX-47 — ACCEPTANCE: PLANETS
==================================================

Must be able to:

Open Planets
→ see visual planet cards/grid
→ filter/search
→ switch view
→ click planet
→ see complete planet workspace
→ inspect all series
→ drill into series
→ drill into season
→ drill into episode

No dead end.

==================================================
PHASE UX-48 — ACCEPTANCE: SERIES
==================================================

Open Series
→ Table/Grid/Card
→ images
→ filters
→ click series
→ full detail
→ episodes
→ statistics
→ media
→ production
→ translations
→ rights
→ analytics
→ workflow.

==================================================
PHASE UX-49 — ACCEPTANCE: DASHBOARD HOME
==================================================

Dashboard Home must no longer look like a small catalogue summary.

It must function as an operational command center for the business.

At minimum provide useful real sections for:

- business KPI
- content
- production
- team/tasks
- customer/support
- marketing
- rights
- system health
- alerts
- recent activity
- upcoming work

and support role-aware visibility.

==================================================
PHASE UX-50 — ACCEPTANCE: EVERY COLLECTION
==================================================

Before this task can be called complete, review EVERY collection page and answer:

1. Can I search it?
2. Can I filter it?
3. Can I sort it?
4. Is pagination correct?
5. Can I open an item?
6. Is there a real detail page?
7. Is the entity visualized if it has an image?
8. Is another view mode useful?
9. Can I bulk-manage it where appropriate?
10. Are related entities clickable?
11. Are loading/error/empty states good?
12. Is URL state preserved?
13. Does RTL work?

Any relevant NO means that page remains incomplete.

==================================================
IMPORTANT
==================================================

Do NOT solve this by merely making cards prettier.

This is an INFORMATION ARCHITECTURE and ADMIN OPERATING UX problem.

The target is that a new senior content manager, production manager, marketer, support agent or owner can open the dashboard and understand:

WHAT EXISTS
WHERE IT BELONGS
WHAT STATE IT IS IN
WHAT IS MISSING
WHO OWNS IT
WHAT HAPPENS NEXT
HOW IT IS PERFORMING

without manually querying the database or navigating through unrelated pages.

==================================================
PRIORITY
without manually querying the database or navigating through unrelated pages.

==================================================
PRIORITY
==================================================

This UX/IA program is now part of the core Dashboard v3 implementation.

Priority:

1. shared Admin design/list/detail infrastructure
2. Dashboard Home
3. Planets/Series/Season/Episode drilldown
4. all Content pages
5. Production/Workflow
6. Customers/Support
7. Marketing/Website/Blog
8. Commercial
9. Operations
10. remaining pages

Do not postpone this entire UX work until after every backend phase.

Build the reusable Admin UX primitives early so later modules use the correct design from the start.

==================================================
REPORTING
==================================================

Add a dedicated section to:

F:\Projects\cartoonapp\KIRO_LAST_REPORT.md

named:

## Admin UX / Information Architecture Completion

Report:

- pages audited
- pages redesigned
- view modes implemented
- detail pages added
- drilldowns added
- reusable components
- filtering coverage
- thumbnail/image coverage
- bulk actions
- responsive issues fixed
- RTL issues fixed
- remaining pages
- screenshots/manual verification performed

Also update the canonical Dashboard documentation.

==================================================
FINAL RULE
==================================================

Do not claim the Majarra Admin is complete merely because all business modules exist.

The Admin is complete only when those modules are actually practical to operate at scale through a rich, coherent, searchable, filterable, drillable, visual and role-aware interface.