# PROGRESS.md — Build Log

Update this file after every meaningful step: what changed, what was tested, what's next. Keep entries dated and terse.

## Status at a glance

- [x] Step 0: Repo/env scaffolding (requirements.txt, folder structure, .env setup)
- [x] Step 1: Model library — photograph/collect 5-6 model reference images (placeholder images used for now, per user decision; swap for real photos later with no schema change)
- [ ] Step 2: Core pipeline proof — upload → rembg segment → Gemini composite onto ONE hardcoded model (no UI, script-level test). Run as TWO separate checks: apparel composite, and jewelry composite (with mediapipe landmark placement). Each is its own go/no-go — see decision log below.
- [ ] Step 3: FastAPI endpoints (products/upload, jobs, job polling) wired to Supabase + R2
- [ ] Step 4: Model selection + async job handling + minimal dashboard (frontend)
- [ ] Step 5: Catalogue/PDF export via WeasyPrint
- [ ] Step 6: Validation round — 15-20 real target designers, before/after examples, willingness-to-pay check
- [ ] Step 7: Credits + Stripe (only after Step 6 signals go)

**Current step: 2 — blocked on Gemini free-tier image-gen quota (limit: 0). Paused; resume ~2026-11-06 when user expects quota reset. See log below before resuming.**

## Decision/validation gate reminder

Step 2 is the real go/no-go checkpoint, now split into two independent checks (apparel and jewelry both in scope per user decision on 2026-10-31). If Gemini free-tier composites don't look convincing on real photos for a category, stop and reassess that category specifically before building Steps 3-5 around it — apparel and jewelry do not need to both pass to proceed; a jewelry failure can fall back to apparel-only without blocking the rest of the build.

---

## Log

### 2026-10-31 — Project initialized
- Created ARCHITECTURE.md, SKILLS.md, PROGRESS.md, requirements.txt.
- Stack locked for POC: FastAPI backend, Supabase (DB+auth), Cloudflare R2 (storage), rembg (segmentation), Gemini API free tier (generation), WeasyPrint (PDF export).
- No code written yet. Next action: Step 0 — scaffold backend folder structure per ARCHITECTURE.md §7, confirm `pip install -r requirements.txt` works in the existing `.venv`.

### 2026-10-31 — Scope updated: jewelry added back into POC
- User decided to include jewelry alongside apparel in the POC (originally deferred). Architecture updated with a separate jewelry generation path using `mediapipe` landmark detection for placement/scale, plus a `needs_review` status for low-confidence results. See ARCHITECTURE.md §4a and SKILLS.md decision #1.
- `requirements.txt` updated with `mediapipe>=0.10.14`.
- Fixed a pip dependency conflict: `google-genai==0.3.0` pinned `pillow<12.0.0` against `rembg`'s `pillow>=12.1.0` requirement. Relaxed to `Pillow>=12.1.0` and `google-genai>=1.0.0`.

### 2026-10-31 — Fixed broken dev environment (Python 3.14 → 3.13)
- `.venv` was created with Python 3.14 (brand new release); `pydantic-core` and other compiled deps had no prebuilt wheels for it, causing a `maturin`/Rust build failure on install.
- Recreated `.venv` with Python 3.13 (already installed on the system). `python3.13-venv` apt package was missing and sudo wasn't available non-interactively, so bootstrapped pip manually via `python3.13 -m venv --without-pip .venv` + `get-pip.py`.
- `pip install -r requirements.txt` now completes cleanly — all packages (FastAPI, Supabase, boto3, rembg, mediapipe, google-genai, WeasyPrint) installed with no conflicts.
- **If this venv is ever deleted/recreated:** use `python3.13`, not plain `python3` (which resolves to 3.14 on this machine).

### 2026-10-31 — Step 0 complete: backend scaffolding
- Created `backend/app/{main.py,config.py}` + empty `routers/`, `services/`, `models/` packages (with `__init__.py`).
- Moved `requirements.txt` into `backend/` per ARCHITECTURE.md §7. Added `backend/.env.example` listing all env vars needed for Supabase/R2/Gemini (not filled in yet — Phase 1 needs real accounts).
- Verified: `uvicorn app.main:app` (run from `backend/`, using the repo-root `.venv`) serves `GET /health` → `{"status":"ok"}`.
### 2026-10-31 — Step 1 complete: accounts + model library seeded
- Created Supabase project, Cloudflare R2 bucket, Gemini API key (all free tier). All three connectivity-tested directly from Python (Postgres via psycopg2, R2 via boto3, Gemini via google-genai `client.models.list()`).
- Fixed two `.env` gotchas: (1) Supabase's `?pgbouncer=true` query param on `DATABASE_URL` isn't understood by psycopg2 — stripped in `app/db.py::_psycopg2_dsn`, not needed since psycopg2 doesn't use prepared statements the pooler worries about. (2) Original DB password had unencoded special characters that broke URL parsing — user reset the password to one without special chars rather than URL-encoding it.
- Added `backend/app/db.py` (psycopg2 connection helper), `backend/app/services/storage.py` (R2 upload/public-URL helper via boto3).
- Applied schema from ARCHITECTURE.md §5 as `backend/migrations/001_init.sql` (users/products/model_library/jobs/catalogues). `users.id` references Supabase's built-in `auth.users(id)`.
- Seeded `model_library` with 5 placeholder models (solid-color labeled JPEGs, 6 poses each: front/three_quarter/closeup/hand/ear/neck) via `backend/scripts/seed_model_library.py`. Verified a seeded R2 URL is publicly reachable (200 OK). **Placeholders, not real model photos** — swap later by re-running the seed logic with real files; no schema/code change needed.
- Added `backend/.env.example` (full template) and root `.gitignore` (excludes `.env`, `.venv`, etc.) since this will become a git repo eventually.
### 2026-10-31 — Step 2 started, blocked on Gemini free-tier quota
- Built `backend/app/services/segmentation.py` (rembg) and `backend/app/services/generation.py` (Gemini composite calls for apparel + jewelry, mediapipe landmark anchor detection for jewelry), plus `backend/scripts/test_pipeline.py` (standalone mechanics test, placeholder images).
- **rembg gotcha:** rembg 2.0.86 now defaults to the `bria-rmbg` model (~1GB), which OOM-killed the process on this machine (14GB RAM, ~9GB already used by other apps). Switched to the much lighter `u2net` model (~176MB) via `rembg.new_session("u2net")` — works fine. If this OOMs again on another machine, same fix applies.
- **mediapipe gotcha:** mediapipe 1.2.0 removed the old `mp.solutions.face_mesh`/`mp.solutions.hands` API entirely. Rewrote `detect_jewelry_anchor` to use the new Tasks API (`mediapipe.tasks.python.vision.FaceLandmarker`/`HandLandmarker`), which downloads `.task` model files from `storage.googleapis.com/mediapipe-models/...` on first use (cached in `backend/.mp_models/`). Confirmed working — correctly returns "no face detected" on a placeholder (faceless) model photo.
- **Blocking finding — Gemini free tier has ZERO quota for image generation:** confirmed via live API calls (not just docs) against two different models (`gemini-2.5-flash-image` and `gemini-3.1-flash-lite-image`) — both returned `429 RESOURCE_EXHAUSTED`, `limit: 0`, on the free tier, for requests/day, requests/minute, AND input-tokens/minute. This directly contradicts ARCHITECTURE.md §3's "$0 fixed infra cost" assumption for the generation layer — Gemini image-gen models apparently require billing enabled regardless of actual free-tier usage (confirmed via Google's own dev forums, not just this account).
- Also hit a transient `401 UNAUTHENTICATED` on the API key mid-session (unrelated to quota) — resolved by regenerating the key in AI Studio.
- **User decision (2026-10-31): pause Phase 2 here. User expects their quota to reset 2026-11-06 — resume testing then.** Do not spend money on billing without the user re-confirming when picking this back up; re-ask the enable-billing-vs-wait question if the reset doesn't actually unblock it.
- **Current state:** segmentation step fully verified working end-to-end on placeholder images. Generation step is code-complete but UNVERIFIED — no successful Gemini image-gen call has happened yet in this project. Phase 2 cannot be marked done until that happens.
- Next action (on/after 2026-11-06): re-run `PYTHONPATH=. ../.venv/bin/python backend/scripts/test_pipeline.py` from `backend/`. If still `limit: 0`, the Nov 6 reset assumption was wrong — re-raise the billing-vs-architecture-revisit decision with the user immediately rather than guessing further.
