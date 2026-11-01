# PROGRESS.md — Build Log

Update this file after every meaningful step: what changed, what was tested, what's next. Keep entries dated and terse.

## Status at a glance

- [x] Step 0: Repo/env scaffolding (requirements.txt, folder structure, .env setup)
- [x] Step 1: Model library — photograph/collect 5-6 model reference images (placeholder images used for now, per user decision; swap for real photos later with no schema change)
- [ ] Step 2: Core pipeline proof — upload → rembg segment → Gemini composite onto ONE hardcoded model (no UI, script-level test). Run as TWO separate checks: apparel composite, and jewelry composite (with mediapipe landmark placement). Each is its own go/no-go — see decision log below.
- [x] Step 3: FastAPI endpoints (products/upload, jobs, job polling) wired to Supabase + R2
- [x] Step 4: Model selection + async job handling + minimal dashboard (frontend)
- [ ] Step 5: Catalogue/PDF export via WeasyPrint
- [ ] Step 6: Validation round — 15-20 real target designers, before/after examples, willingness-to-pay check
- [ ] Step 7: Credits + Stripe (only after Step 6 signals go)

**Current step: 4 — frontend scaffolded and buildable (auth, upload, model picker, job polling, results gallery). Apparel path has a strong real-photo quality spot-check (Step 2); jewelry quality is still untested with real photos (mechanics only). Billing is live (₹500/month credit, ~$0.20 spent total so far) — stay deliberate about API spend. Not yet tested against a live backend end-to-end from the browser — next session should run both servers together and walk the full flow.**

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

### 2026-11-01 — Billing enabled, Step 2 mechanics PASS (quality still unvalidated)
- **User enabled billing on the Gemini API project: ₹500/month credit.** This is real money now — be deliberate about API calls, don't iterate/retry generation calls carelessly. Confirmed via Google's official pricing page that `gemini-3.1-flash-lite-image` (already the model in use) is in fact the cheapest image-gen option at ~$0.0336/image, slightly beating the originally-planned `gemini-2.5-flash-image` ($0.039/image, also being deprecated 2027-03-15). No model change needed.
- Ran `test_pipeline.py` once (2 generation calls total, ~$0.07 spent). **Both apparel and jewelry calls succeeded** — pipeline mechanics are now proven against the real, billed API (not just free-tier-blocked code).
- Inspected both output images: both are strikingly photorealistic fashion/jewelry photography. Strong signal for Gemini's raw generation capability.
- **Important caveat — this does NOT yet satisfy the real §10 go/no-go gate:** our placeholder "model" photos are solid-color rectangles with no real face/body, so Gemini had nothing to preserve and invented an entirely new model/face from scratch in both results. This proves the API call mechanics work, but does NOT validate the actual product requirement — compositing a garment/jewelry piece onto a *specific, consistent, pre-shot* model from the library while preserving that model's identity/pose/background (ARCHITECTURE.md §4a). That real test needs: (1) real product photos (garment + jewelry), (2) real photographed model-library images (Phase 1 currently has placeholders only).
- **Revised Current step 2 status: mechanics PASS, quality/identity-preservation UNVALIDATED.** Don't mark Step 2 fully done or move to Step 3 commitments based on this result alone — the real go/no-go still needs real photos on both sides (product + model).
### 2026-11-01 — Real-photo apparel quality test: strong PASS
- User supplied one real product photo (`items/kurta.png`, a cream mandarin-collar kurta) and one real model photo (`Models/malemodel.jpg`). **Note: `malemodel.jpg` is a watermarked portfolio photo credited to www.praveenbhat.net — not a licensed/owned model asset.** Used for this one local quality-validation test only; NOT uploaded to R2's model library, NOT used anywhere beyond `backend/test_output/`. A real model shoot (or a licensed photo) is still needed before this goes further than local testing — see Phase 1 in ARCHITECTURE.md §11.
- Ran one real composite call via `backend/scripts/test_real_apparel.py` (single call, ~$0.03 spent): real kurta cutout + real model photo → `gemini-3.1-flash-lite-image`.
- **Result: model identity (face, hair, pose, background, even the source photo's watermark) preserved exactly; the kurta's texture, mandarin collar, button placket, and rolled sleeves transferred convincingly onto the model.** This is the first real evidence toward the actual §10 apparel go/no-go — much stronger signal than the placeholder-image run.
- This is a single spot-check, not the full §10 validation gate (15-20 real target designers) — don't treat this as "apparel validated," but it's a strong green light to keep building toward that gate.
- Jewelry path still has NOT been tested with a real jewelry photo — only the placeholder/mechanics-only run from earlier today. Needs a real jewelry product photo (+ ideally a real model photo with visible ear/hand) before its own go/no-go can be assessed.
### 2026-11-01 — Step 3 complete: API layer, verified end-to-end
- Built `backend/app/auth.py` (Supabase JWT verification + upsert into `public.users`), `backend/app/models/schemas.py` (Pydantic request/response models), `backend/app/routers/{products,models,jobs}.py`, wired into `backend/app/main.py`.
- Endpoints implemented per ARCHITECTURE.md §6: `POST /products/upload`, `GET /models`, `POST /jobs` (async via FastAPI `BackgroundTasks` — no queue system, appropriate for POC scale), `GET /jobs/{job_id}`. `GET /models` is intentionally public/unauthenticated (matches §6, no auth noted there); the other three require a Supabase bearer token.
- **Auth gotcha (important, cost real debug time): Supabase projects created recently sign JWTs with ES256 via a per-project JWKS endpoint, NOT the legacy HS256 shared secret (`SUPABASE_JWT_SECRET`).** Verified by minting a real token via `supabase.auth.sign_in_with_password` for a throwaway test user (`adorn-test@example.com`, created via `client.auth.admin.create_user` using the service key) — its header showed `alg: ES256`. Rewrote `auth.py` to use `jwt.PyJWKClient` against `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` instead. `SUPABASE_JWT_SECRET` is now unused dead config for this project but left in `.env`/`config.py` in case of a legacy-project fallback later.
- **Jewelry POC gap (flagged, not fixed):** `products` table has no `piece_type` (earring/necklace/ring/bracelet) field. `jobs.py` currently hardcodes jewelry jobs to `DEFAULT_JEWELRY_PIECE_TYPE = "earring"`. Needs a schema + upload-form addition before jewelry supports more than one piece type — don't forget this when building the Phase 4 upload UI.
- **Verified real end-to-end run** (apparel, using the real kurta product uploaded earlier + placeholder "Model 1" from the library, ~$0.07 spent): `POST /products/upload` → real R2 cutout URL (200 OK) → `POST /jobs` → status went `pending` → `processing` → `complete` within ~15s → `GET /jobs/{id}` returned real `full_body`/`closeup` R2 URLs, both verified reachable and containing real generated composites.
- Minor non-blocking code smell seen in server logs: Pydantic warns `model_id` field name conflicts with its own protected `model_` namespace — cosmetic only, didn't affect behavior; could rename later or set `protected_namespaces = ()` if the warning becomes annoying.
- Test server was run locally on port 8001 and stopped after testing (not left running, to free RAM on this dev machine, which OOM'd earlier today).
- **Total Gemini spend today: ~$0.17 of the ₹500/month credit** across all testing (Phase 2 mechanics, Phase 2 real-photo spot-check, Phase 3 end-to-end).
### 2026-11-01 — Quality fix: brand tag bleeding into front of composite
- User spotted a real generation defect: the kurta's flat-lay product photo has its brand/size tag flipped out near the collar for photography purposes; Gemini was copying it onto the front of the rendered garment on the model, since it has no garment-construction knowledge that tags are sewn on the inside back of the neckline.
- Fixed via prompt engineering only (no preprocessing/code pipeline needed): added an explicit instruction to `generate_apparel_composite`'s prompt in `backend/app/services/generation.py` telling the model the tag is interior/back-of-neck and should never render. Re-tested with the same real kurta + real model photo (one call, ~$0.03) — **tag is gone, texture/identity quality unchanged.** Confirmed by eye on `backend/test_output/real_apparel_result.png`.
- Worth knowing for future quality issues: prompt engineering was the cheap, effective first move here. Other options discussed but not needed: pre-cleaning the product photo via inpainting (more robust but more engineering), or garment-landmark mapping (better suited to fit/placement issues than stray-object issues like this one).
- **Total Gemini spend today: ~$0.20 of the ₹500/month credit.**
- Next action: Phase 4 (frontend — Next.js upload form, model picker, job polling dashboard) per ARCHITECTURE.md §11. Jewelry real-photo quality testing (deferred earlier) can happen anytime independently. Before frontend auth wiring, note the ES256/JWKS finding above — Supabase JS client handles this automatically, so it's only relevant for direct backend testing like today's.

### 2026-11-01 — Step 4 complete: frontend scaffolded (light/white/gold/silver theme)
- **Node.js wasn't installed on this machine.** User ran `sudo apt install -y nodejs npm` manually (interactive sudo can't run through this session) — now on Node v22.22.1 / npm 9.2.0.
- Scaffolded `frontend/` with `create-next-app` (Next 16.4.3, App Router, TypeScript, Tailwind v4, no src dir). Added `@supabase/supabase-js` for client-side auth.
- Theme: plain white background, gold accent (`#b8912f`/`#93711f`), silver/grey for muted text and borders — defined as CSS variables + Tailwind v4 `@theme inline` tokens in `frontend/app/globals.css` (no dark-mode override; user wants it light-only). Headings use Playfair Display (serif), body uses Inter — set up in `frontend/app/layout.tsx`.
- Built as a single-page app (no routing needed for this POC scope): `lib/supabase.ts` (client), `lib/useAuth.ts` (session hook), `lib/api.ts` (typed fetch wrappers for `/products/upload`, `/models`, `/jobs`, `/jobs/{id}`, attaching the Supabase bearer token), `components/AuthForm.tsx` (sign in/up), `components/ModelPicker.tsx`, `components/JobCard.tsx`, `components/Dashboard.tsx` (upload → pick model → generate → poll job status every 3s → show results). `app/page.tsx` just switches between `AuthForm` and `Dashboard` based on session state.
- Added CORS middleware to `backend/app/main.py` (`allow_origins=["http://localhost:3000"]`) — wasn't there before, needed for the browser to call the FastAPI backend directly.
- `frontend/.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key — different from the service key backend uses; user supplied it directly), and `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- Verified `npx tsc --noEmit` clean, `npm run build` succeeds, and `npm run dev` serves the sign-in page correctly at `localhost:3000`. **Not yet tested against a running backend** — no real upload/model-pick/generate/poll cycle has happened through the browser yet. Jewelry upload currently has no piece_type selector in the UI, matching the existing backend POC gap (hardcoded to `earring` — see Step 3 log entry).
- Next action: run backend (`uvicorn app.main:app` from `backend/`, port 8000 to match `NEXT_PUBLIC_API_URL`) and frontend (`npm run dev` from `frontend/`) together, walk the full flow once with a real product photo to confirm the integration end-to-end.
