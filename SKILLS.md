# SKILLS.md — Session Continuity Reference

Purpose: if this conversation is lost/switched, read this file plus ARCHITECTURE.md and PROGRESS.md to fully restore context before doing any work on this project.

## What this project is

Adorn: an AI platform that generates on-model product imagery (close-up + full-body) for small, local apparel designers from a single uploaded product photo, with an optional catalogue/lookbook export. Target customer explicitly excludes enterprise brands and Shopify-dependent sellers — this is for Instagram/Etsy-native solo/small designers.

## Decisions already made — do not re-litigate these without the user raising it

1. **Scope: apparel AND jewelry both in POC (updated — originally apparel-only).** User explicitly asked to include jewelry despite the known difficulty. Jewelry runs a separate generation path with landmark-based placement constraints (mediapipe) and a `needs_review` confidence flag, rather than being forced through the same flow as apparel — see ARCHITECTURE.md §4a. If jewelry quality proves unusable in Step 2 testing, fallback is apparel-only; this is a knowingly accepted risk, not an unflagged one.
2. **Positioning: no-storefront-required, local/indie seller, not Shopify-app competitor.** Reason: Snappyit, ModelScene, JewelAI, Lumesa, The New Black AI all assume a Shopify/enterprise catalogue context — the open gap is sellers who only post to Instagram/Etsy with no storefront backend.
3. **Pricing model (future, not built yet): credit packs, not subscriptions.** Reason: matches irregular/batch usage pattern of designers who shoot a collection occasionally, not continuously; lowers commitment barrier for cash-constrained buyer.
4. **Validation gate before heavy build-out:** talk to 15-20 real target designers with before/after examples to confirm willingness to pay, before investing further. Status of this gate lives in PROGRESS.md — check it before assuming the idea is validated.
5. **Model library approach: pre-photograph 5-6 real models in detail (multiple angles)** rather than generating models from scratch each time. Reason: consistency across a user's catalogue, better realism, and a path to solving jewelry placement accuracy later via real reference geometry.
6. **Backend language: Python (FastAPI).** User's explicit preference, stated after an initial Next.js-API-routes suggestion.
7. **Tech selection philosophy: free-tier-first.** Use $0-cost tools until the POC validates, then swap to paid tiers. Current stack: FastAPI, Supabase (free), Cloudflare R2 (free), `rembg` (free/local), Gemini API free tier for generation, WeasyPrint (free) for PDF export.
8. **Claude's role:** Claude Pro / Claude Code is the *development* tool (writing/debugging code), not a component of the running app. Claude does not do image generation. Gemini is the image generation engine.
9. **"Gemini argon"** — user mentioned this term once; meaning was never clarified. If it resurfaces, ask the user what it refers to before assuming — do not silently guess a product name into the architecture.

## Where things stand

Always check PROGRESS.md for the current build step — this file holds philosophy/decisions, not live status.

## How to pick up work correctly

1. Read ARCHITECTURE.md for the system design and current repo structure.
2. Read PROGRESS.md for what's actually been built vs. still planned.
3. Don't re-propose alternatives to decisions 1-8 above unless the user explicitly reopens them (e.g., if free-tier Gemini proves too slow/limited, that's an expected future conversation, not a sign the original choice was wrong).
4. Keep the build order from ARCHITECTURE.md §10 / PROGRESS.md: segmentation+generation pipeline proven on one hardcoded model FIRST, before building UI polish, auth, or billing. Quality of generated output is the real go/no-go gate, not feature completeness.
