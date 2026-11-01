"""One-off real-photo quality test for Phase 2 (apparel only, single call, ~$0.03).

Uses a real product photo + real model photo (NOT the placeholder model library)
to actually validate generation quality per ARCHITECTURE.md §10, rather than just
proving API mechanics. Not wired into the app -- throwaway validation script.
"""
import os

from app.services import generation, segmentation

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
PRODUCT_PATH = os.path.join(ROOT, "items", "kurta.png")
MODEL_PATH = os.path.join(ROOT, "Models", "malemodel.jpg")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "test_output")

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(PRODUCT_PATH, "rb") as f:
        product = f.read()
    with open(MODEL_PATH, "rb") as f:
        model_photo = f.read()

    cutout = segmentation.segment(product)
    print(f"Segmented cutout: {len(cutout)} bytes")

    result = generation.generate_apparel_composite(cutout, model_photo, "full_body")
    out_path = os.path.join(OUT_DIR, "real_apparel_result.png")
    with open(out_path, "wb") as f:
        f.write(result)
    print(f"Saved: {out_path}")
