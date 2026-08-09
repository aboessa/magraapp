# AutoFlow API — Bug Report (for the AutoFlow maintainer / support agent)

Platform: Genova / AutoFlow, base URL `https://autoflow-api.aboessa101.workers.dev`,
docs at `https://autoflow-web-3yn.pages.dev/docs`. All findings below are from
live testing against a real account on the Free plan, using the Flow Image
Automator Chrome extension (flow.google.com) as the generation worker. Freepik
was intentionally not tested. Job IDs are real and can be looked up via
`GET /api/jobs/:id` for verification.

---

## Bug 1 — `imagen4` jobs are accepted, assigned to a worker, then silently vanish

**Steps to reproduce:**
```
POST /api/jobs
{ "type": "image", "prompt": "<a normal <500 char prompt>", "model": "imagen4",
  "aspectRatio": "landscape", "count": 1 }
```

**Observed:**
- Response: `201 { success: true, jobId: "...", status: "queued", _debug: { assigned: true } }`
- The job briefly shows `status: "processing"` in `GET /api/jobs`.
- Within a few polling cycles, the job **disappears from `GET /api/jobs` entirely**
  (not present at any `status` filter: pending/queued/processing/completed/failed).
- `GET /api/jobs/:id` for that id returns `404 { "error": "Job not found" }`.
- No credit appears to be refunded or consumed observably; the job simply ceases to exist.

**Evidence — two separate reproductions:**
- Job `14a4a1ab-6b59-4d32-9178-e0ad2718f8bb` (model `imagen4`) — vanished.
- A second `imagen4` submission with the same prompt shape — same outcome.

**Workaround found:** switching `model` to `nano_banana2` with the identical
prompt and settings completed successfully in ~50s (job `48bed0cd-8d16-4890-ba57-c5c7f7384ade`).
This strongly suggests the bug is specific to the `imagen4` model routing/worker
matching, not the request shape.

---

## Bug 2 — Documented 500-char prompt limit is not enforced server-side

**Steps to reproduce:**
```
POST /api/jobs
{ "type": "image", "prompt": "<600 chars of 'a'>", "model": "nano_banana2" }
```

**Expected (per docs):** `400 Bad Request` — docs state `prompt` has a "max 500 chars" constraint.

**Observed:** `201 Created`, job `6b89b8c6-a3e5-4a53-bb07-a2fc419e2520` was
accepted, queued, assigned, and **completed successfully**, consuming 1 credit.

**Impact:** callers relying on the documented limit as a server-side guarantee
will unknowingly spend credits on oversized prompts instead of getting a fast,
free 400 rejection.

---

## Bug 3 — `referenceImages.images` as raw base64 breaks the job-creation database write

**Steps to reproduce:**
```
POST /api/jobs
{ "type": "image", "prompt": "...", "model": "nano_banana2",
  "referenceImages": { "images": ["<base64 of a ~2.8MB PNG>"], "mode": "ingredients" } }
```

**Observed:**
```
500 { "error": "Internal error creating job",
      "details": "D1_ERROR: string or blob too big: SQLITE_TOOBIG",
      "stack": "Error: D1_ERROR: string or blob too big: SQLITE_TOOBIG\n
                at D1DatabaseSessionAlwaysPrimary._sendOrThrow (cloudflare-internal:d1-api:182:19)\n
                at async cloudflare-internal:d1-api:464:19" }
```

**Root cause (visible from the stack trace):** the job row — including the
full reference image payload — is written into a single Cloudflare D1 field/row,
which has a per-value size ceiling. A ~2.8MB base64 string exceeds it and the
whole job creation fails with an internal 500 that leaks a raw D1 stack trace
to the API client.

**Impact / secondary issues:**
1. **No client-side validation** — the API should reject oversized reference
   images with a clean `400` before attempting the D1 write, not a `500` with
   a leaked stack trace.
2. **No documented size limit** — the docs describe `referenceImages.images`
   as "base64-encoded strings" with no stated max size, so callers cannot know
   in advance what will fit.
3. A **working example from this same account's job history** (job
   `9961cd08-157b-4a40-8f31-d168dbc0b25d`) shows the actual accepted shape is
   richer than the docs describe: each reference image is an **object**
   `{ name, data: "data:image/jpeg;base64,...", mimeType }`, not a bare base64
   string as `POST /api/jobs` documentation implies. The docs should be
   corrected to show this object shape.

---

## Bug 4 — `tag` reference mode is undocumented on the public docs page content we could reach, and its behavior is unreliable

The docs list a reference mode table that includes:

> `tag` — Flow — "Named characters referenced inline as `@name` in the prompt. Keeps a cast consistent across scenes."

We tested this twice with a compressed JPEG reference (well under any size
limit — 20–37KB base64) and `@name` used inline in the prompt:

**Test A** (job `feb0b88c-3d07-415c-80f3-e2804117d437`):
- Prompt: `"@zughb the tiny light-gray baby bird tilts a little as a soft breeze moves nearby leaves..."`
- Reference: 37KB base64 JPEG of a bird-and-nest illustration, `mode: "tag"`, `name: "zughb"`
- Job completed normally (`status: completed`, no error).
- **Downloaded result had zero relation to the prompt or the reference image**:
  it was a nighttime graphic with large glowing decorative letters ("logo"-style
  content), not a bird scene at all.

**Test B** (job `2bca87b1-7f28-4589-a5cf-86207e116a97`):
- Prompt: `"@zughb the tiny light-gray baby bird stands on the rim of his round nest..."`
- Reference: 15KB base64 JPEG, same `tag` mode, same character name.
- Job completed normally in 41s.
- **Downloaded result matched the prompt's composition** (small bird on nest
  rim, mother bird in nest, daylight) but **completely ignored the reference
  image's art style** — it returned a realistic nature photograph instead of
  the storybook illustration style shown in the reference.

**Conclusion:** `tag` mode's output is unpredictable — one run returned
content entirely unrelated to both the prompt and the reference (a capture/
routing bug), and the other run honored the prompt's composition but not the
reference's visual style, defeating the documented purpose ("keeps a cast
consistent across scenes"). Neither run reproduced the reference character's
actual appearance.

---

## Bug 5 — Flow Image Automator extension repeatedly fails with "failed to capture result from page" (5 consecutive failures observed)

**Steps to reproduce:** Submit multiple sequential `nano_banana2` jobs with no
special parameters (plain prompt, no reference image), spaced ~7s apart.

**Observed:** After 2 successful jobs, the next 5 consecutive jobs all failed
identically:
```
status: "failed"
error_message: "Generation completed but failed to capture result from page."
```
Job IDs: `c019a846-be26-4494-bd8d-2a842f84f389`,
`e9a451b2-d276-460f-92a2-eabab13c7791`,
`26f1abda-971a-42c0-8af6-8026afcaeb4f`,
`204e1073-12a4-46b4-b7ae-3c68e34bdeff`,
`68ef1ed6-5af9-4374-bc3f-cfc632e3c2c8`.

**Impact:** Each failed job still consumed the generation window (~4 min stuck
at `processing` before failing) and, per the documented "1 credit per job"
billing rule, presumably consumed a credit for a result that was never
delivered. The message implies the Flow-side generation actually finished but
the extension's page-scraping/capture step failed to retrieve it — this points
to a reliability problem in the Chrome extension's DOM-scraping logic on
flow.google.com (e.g., losing track of which generation result belongs to
which job after several requests in the same browser session), not something
controllable from the API caller's side. Retrying later (next day) with the
same job shape succeeded again, consistent with a session/DOM-state problem
in the extension rather than a permanent account issue.

**Suggested fix directions for the AutoFlow team:**
- Add a retry-with-backoff inside the extension before reporting `failed`,
  since the underlying generation did complete.
- Do not deduct a credit (or refund it) when the failure reason is
  `"failed to capture result from page"`, since this is an extension-side
  fault, not a bad request.
- Consider a job-to-result correlation ID surfaced in the Flow page DOM so the
  extension cannot attribute another job's output to the wrong job (see Bug 6).

---

## Bug 6 — Cross-contamination risk: a `download`/`file` fetch for one job returned unrelated content matching a *different* job's prompt

While debugging Bug 1, we fetched `GET /api/jobs/:id/file` for a job we had
just submitted and initially believed the returned PNG was our bird-nest
generation. On closer inspection, the file's job record (`GET /api/jobs?limit=20`)
showed:
```
job 9961cd08-157b-4a40-8f31-d168dbc0b25d
  stored prompt: "لوجو كونكر"   <- someone else's / a different session's job, NOT ours
  settings: { model: "nano_banana2", referenceImages: {...} }
```
This job had been created by a separate, roughly-simultaneous dashboard
submission (not through our API calls), and briefly appeared at the top of our
account's job list ahead of our own job while both were mid-flight. We
mistakenly attributed its result to our job before checking the stored
`prompt` field on the job record. This is not conclusively an API-side
contamination bug (job records are correctly indexed by their own IDs and
correctly stored their own prompts) — **but Bug 4 and Bug 5 both show workers
occasionally returning content that does not match the job's own stored
prompt**, which is a more serious version of the same symptom on the extension
side. We flag this because any queue where **multiple browser tabs/extensions
share the same generation surface (flow.google.com)** is at risk of result
misattribution if the extension's capture step identifies "the last generated
image on the page" rather than a job-specific element.

**Recommendation:** confirm whether the Flow Image Automator extension
correlates captured results to job IDs via a strict per-job browser tab/
session, or via "poll the page for the newest result" — the latter would
explain both Bug 4 and this near-miss.

---

## Summary table

| # | Area | Endpoint / Component | Severity | Repro count |
|---|---|---|---|---|
| 1 | `imagen4` jobs vanish | `POST /api/jobs` (model=imagen4) | High | 2/2 |
| 2 | 500-char prompt limit not enforced | `POST /api/jobs` | Medium | 1/1 |
| 3 | Reference image size breaks D1 write, leaks stack trace | `POST /api/jobs` (referenceImages) | High | 1/1 |
| 4 | `tag` mode unreliable (wrong content once, wrong style once) | `POST /api/jobs` (mode=tag) | High | 2/2 |
| 5 | Extension capture failures, 5 in a row | Flow Image Automator extension | High | 5/5 in one session |
| 6 | Possible result/job cross-attribution risk | Flow Image Automator extension | Needs investigation | 1 near-miss |

Not tested: Freepik model/extension, video models (veo3_fast/quality, veo2_fast), JWT bearer auth, WebSocket transport, rate-limit (429) behavior under load.
