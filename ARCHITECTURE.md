# Adorn — AI On-Model Imagery Platform — Architecture

## 1. Product Summary

Adorn lets a small, local apparel designer upload one photo of a product and get back realistic AI-generated images of a model wearing it (close-up + full-body), selectable from a small model library, deliverable to a dashboard, with an optional auto-generated catalogue/lookbook export.

**Target customer:** small local apparel sellers who sell via Instagram/Etsy, not enterprise brands, not necessarily running a Shopify store.

**Scope decision (updated for POC):** Apparel AND jewelry both in scope. Jewelry is the harder generation problem (scale/reflectivity of gems/metal — see §4a), so it is tested as a separate, explicitly flagged pipeline path, not assumed to work via the same prompt/flow as apparel. If jewelry quality proves unusable during Step 2 validation, the fallback is to ship apparel-only and revisit jewelry later — this is a risk accepted knowingly, not a changed risk assessment.

**Phase:** POC — free-tier-first, $0 fixed infra cost until usage justifies paid tiers.

## 2. System Overview

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────┐
│   Browser    │────▶│   FastAPI    │────▶│  Gemini API     │────▶│  Cloudflare  │
│  (Next.js)   │◀────│   Backend    │◀────│ (image gen/edit)│◀────│  R2 Storage  │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Supabase    │
                     │ (Postgres +   │
                     │    Auth)      │
                     └──────────────┘
```

## 3. Tech Stack (current — free tier)

| Layer | Choice | Cost | Notes |
|---|---|---|---|
| Frontend | Next.js (React) | Free (Vercel free tier) | Separate repo/deploy from backend |
| Backend | FastAPI (Python) | Free (self-host) | This repo |
| Backend hosting | Render.com / Railway free tier | Free (sleeps when idle) | Fine for POC traffic |
| Auth | Supabase Auth | Free tier | |
| Database | Supabase Postgres | Free tier | |
| File storage | Cloudflare R2 | Free tier (10GB, no egress fee) | |
| Background removal | `rembg` (local, open-source) | Free | Runs in-process, no external call |
| Landmark detection (jewelry only) | `mediapipe` (local, open-source) | Free | Face/hand keypoints for earring/necklace/ring placement scale+position, §4a |
| Image generation | **Gemini API (Google AI Studio free tier)** — Gemini 2.5 Flash Image ("Nano Banana") | Free tier | Takes product photo + model photo + prompt → composited result |
| PDF/catalogue export | `WeasyPrint` (HTML → PDF) | Free, open-source | |
| Payments (later, not POC) | Stripe test mode | Free until real charges | Not wired yet |
| Dev tool | Claude Code (Claude Pro) | Existing subscription | Used to build the app; NOT part of the running app — Claude has no image-gen role |

**Swap-to-paid path (future, not now):** Gemini free tier → paid Gemini/Imagen tier or Replicate/Fal hosted try-on models, once usage outgrows free quotas. Render free tier → paid dyno once cold-starts become a problem for real users.

## 4. Core Pipeline

```
1. UPLOAD
   User uploads product photo → stored in R2 → thumbnail generated
   User tags category: "apparel" or "jewelry" (drives which generation path runs)

2. SEGMENT
   rembg runs locally in FastAPI process → background-removed product cutout

3. MODEL SELECT
   User picks one of 5-6 pre-shot models from static library
   (each model: front pose, 3/4 pose, close-up crop — pre-photographed, stored in R2)
   Jewelry additionally needs close-up reference shots of hand/ear/neck per model (§4a)

4. GENERATE (async job) — path depends on category
   APPAREL path:
     FastAPI calls Gemini API: product cutout + model base photo + prompt
       → "Composite this garment onto this model, photorealistic, [angle/framing]"
     Two calls per job: one framed for full-body, one framed for close-up

   JEWELRY path (see §4a for why this differs):
     a. Detect placement anchor on model photo (face landmarks for earrings/necklace,
        hand landmarks for rings/bracelet) using a landmark model (mediapipe, free/local)
     b. Compute expected scale/position box from anchor points, not left to the
        generative model to guess
     c. Call Gemini API with product cutout + model close-up + anchor box + prompt
        → "Composite this piece at this position/scale, preserve reflectivity/detail"
     d. Flag low-confidence placements for manual review before calling it "complete"

   Result images stored in R2, job marked "complete" (or "needs_review") in Postgres

5. DELIVER
   Dashboard polls job status → shows generated images when ready
   Jewelry results show a "beta — verify fit/scale" label until proven reliable
   User can regenerate (future: costs a credit) or download

6. CATALOGUE EXPORT (secondary feature)
   User selects N completed jobs → WeasyPrint renders HTML template → PDF lookbook
```

### 4a. Why jewelry gets a separate path

Diffusion-style image generation tends to guess scale/position for small reflective objects rather than place them precisely, and tends to blur or flatten facets/metal reflections. The mitigation that's practical at POC budget (no full PBR/3D pipeline) is to constrain placement geometrically using landmark detection (face/hand keypoints) instead of relying on the prompt alone, and to treat every jewelry result as needing a visual confidence flag until real testing shows otherwise. This is the main technical unknown in the combined-scope POC — treat Step 2's jewelry test as its own go/no-go checkpoint, separate from apparel's.

## 5. Data Model

```sql
users           id, email, created_at
products        id, user_id, category (enum: 'apparel' | 'jewelry'), original_image_url, cutout_image_url, created_at
model_library   id, name, base_image_urls (jsonb: front/three_quarter/closeup/hand/ear/neck), active
jobs            id, user_id, product_id, model_id, status, result_urls (jsonb), placement_confidence (float, nullable), created_at, error
catalogues      id, user_id, job_ids (int[]), pdf_url, created_at
```

`status` on jobs: `pending` → `processing` → `complete` | `needs_review` | `failed`
`needs_review` applies only to jewelry jobs with low placement confidence (§4a).

No credits/billing table yet — deferred until Stripe is wired in (post-POC).

## 6. API Surface

```
POST /products/upload        multipart image + category ('apparel'|'jewelry') → { product_id, cutout_image_url }
GET  /models                 → list of active model_library entries
POST /jobs                   { product_id, model_id } → { job_id }  (async; path chosen by product.category)
GET  /jobs/{job_id}          → { status, result_urls, placement_confidence? }
POST /catalogues              { job_ids: [...] } → { pdf_url }
GET  /health                 → liveness check
```

Auth: Supabase JWT passed in `Authorization: Bearer <token>` header, verified in FastAPI dependency.

## 7. Repo Structure (planned)

```
Adorn/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app entrypoint
│   │   ├── routers/
│   │   │   ├── products.py
│   │   │   ├── jobs.py
│   │   │   └── catalogues.py
│   │   ├── services/
│   │   │   ├── segmentation.py   rembg wrapper
│   │   │   ├── generation.py     Gemini API calls
│   │   │   └── storage.py        R2 upload/download helpers
│   │   ├── models/               Pydantic schemas
│   │   ├── db.py                 Supabase/Postgres connection
│   │   └── config.py             env var loading
│   ├── requirements.txt
│   └── .env.example
├── frontend/                     
├── ARCHITECTURE.md
├── SKILLS.md
└── PROGRESS.md
```

## 8. Deployment Plan (POC)

1. Supabase project → get Postgres URL + Auth keys.
2. Cloudflare R2 bucket → get access key/secret + bucket name.
3. Google AI Studio → get free Gemini API key.
4. Backend → push to Render/Railway free tier, set env vars there.
5. Frontend → push to Vercel free tier, point at backend URL.
6. Smoke test full pipeline end-to-end with one real product photo before inviting testers.

## 9. Known Limitations (be upfront with testers)

- Gemini free tier has rate limits — expect slower responses and occasional throttling under test load.
- Jewelry generation is beta-quality by design — placement/scale accuracy is not guaranteed; results below confidence threshold are flagged `needs_review`, not hidden.
- No payments wired yet — manual credit-granting if needed during testing.
- Model library is small (5-6 models) — diversity will expand post-validation, not before.

## 10. Validation Gate

Before expanding scope: confirm with 15-20 real target designers that generated image quality is convincing enough to use, and that they'd pay for it. This gate exists independent of the tech build — see PROGRESS.md for status.

## 11. Build Phases (one phase = one session)

Each phase below is sized to fit in a single Claude Code session and ends with something runnable/testable, so a new session can start clean by reading PROGRESS.md's "Current step" line and this phase's entry/exit criteria — no need to re-read the whole architecture from scratch.

**How to use this across sessions:** at the end of a session, update PROGRESS.md's checklist and "Current step" line and add a dated log entry. At the start of the next session, just say "continue with Phase N" — PROGRESS.md tells the new session exactly where things stand.

### Phase 0 — Scaffolding
- **Builds:** `backend/app/` folder structure (§7), `requirements.txt`, `.env.example`, venv working, `GET /health` returns 200.
- **Entry:** empty repo.
- **Exit:** `uvicorn app.main:app` runs locally and `/health` responds.
- **Touches:** `backend/app/main.py`, `backend/app/config.py`, `backend/requirements.txt`.

### Phase 1 — Model library
- **Builds:** 5-6 model reference photos (front/3-quarter/closeup, plus hand/ear/neck closeups for jewelry) collected and uploaded to R2; `model_library` rows seeded in Postgres.
- **Entry:** Phase 0 done, R2 + Supabase accounts created.
- **Exit:** a script can list active models with their image URLs from the DB.
- **Touches:** `model_library` table, a seed script, R2 bucket contents.

### Phase 2 — Core pipeline proof (the go/no-go gate)
- **Builds:** script-level (no API, no UI) test of upload → rembg segment → Gemini composite, run as two independent checks: apparel and jewelry (with mediapipe landmark placement for jewelry).
- **Entry:** Phases 0-1 done, Gemini API key obtained.
- **Exit:** real product photos produce convincing composites for apparel; jewelry checked separately and allowed to fail independently (fallback: apparel-only). This is the decision gate in §4a — don't proceed to Phase 3 for a category that fails here.
- **Touches:** `backend/app/services/segmentation.py`, `backend/app/services/generation.py`, a standalone test script (not wired into the API yet).

### Phase 3 — API layer
- **Builds:** `POST /products/upload`, `POST /jobs`, `GET /jobs/{job_id}`, wired to Supabase (auth + `products`/`jobs` tables) and R2, async job processing using the pipeline proven in Phase 2.
- **Entry:** Phase 2 passed (at least apparel).
- **Exit:** can upload a real photo via curl/Postman and poll a job to `complete`.
- **Touches:** `backend/app/routers/products.py`, `backend/app/routers/jobs.py`, `backend/app/db.py`, `backend/app/models/`.

### Phase 4 — Frontend + model selection + dashboard
- **Builds:** Next.js frontend: upload form, model picker (`GET /models`), job status polling, minimal dashboard showing results.
- **Entry:** Phase 3 API stable.
- **Exit:** a user can go through the full flow in a browser and see generated images appear.
- **Touches:** `frontend/` (new Next.js app), calls into the Phase 3 API.

### Phase 5 — Catalogue/PDF export
- **Builds:** `POST /catalogues` + WeasyPrint HTML→PDF template, job selection UI.
- **Entry:** Phase 4 done, several completed jobs exist to export.
- **Exit:** selecting N jobs produces a downloadable PDF lookbook.
- **Touches:** `backend/app/routers/catalogues.py`, an HTML template, frontend export UI.

### Phase 6 — Validation round
- **Builds:** nothing new in code; this is the 15-20 designer test (§10) — before/after examples, willingness-to-pay check.
- **Entry:** Phases 0-5 done, app usable end-to-end.
- **Exit:** go/no-go decision on whether to invest in Phase 7.
- **Touches:** PROGRESS.md log only.

### Phase 7 — Credits + Stripe (post-validation only)
- **Builds:** credits table/billing logic, Stripe test-mode integration, regenerate-costs-a-credit flow.
- **Entry:** Phase 6 signals "go."
- **Exit:** a test payment grants credits that are consumed by a job.
- **Touches:** new `credits` table, `backend/app/routers/` payment endpoints, Stripe webhook handler.
