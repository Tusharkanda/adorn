"""Phase 2 go/no-go script: proves the segment -> generate pipeline runs end to end.

Two independent checks, per ARCHITECTURE.md §4a:
  - apparel: product cutout + model photo -> Gemini composite
  - jewelry: product cutout + model photo -> mediapipe anchor -> Gemini composite

NOTE: this run uses placeholder images (no real garment/jewelry/model photos yet,
per user decision). It proves the pipeline *mechanics* work (API calls succeed,
an image comes back) — it does NOT validate generation *quality*. Quality can
only be judged with real product + model photos. Re-run with real files before
treating this as the actual go/no-go decision in ARCHITECTURE.md §10.
"""
import io
import os

from PIL import Image, ImageDraw

from app.services import generation, segmentation

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "test_output")


def make_placeholder_product(kind: str) -> bytes:
    img = Image.new("RGB", (400, 400), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    if kind == "apparel":
        draw.rectangle([80, 60, 320, 340], fill=(60, 90, 160))  # "shirt"
    else:
        draw.ellipse([150, 150, 250, 250], fill=(220, 190, 60))  # "ring"
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_placeholder_model() -> bytes:
    img = Image.new("RGB", (512, 768), (210, 180, 160))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def run_apparel_check():
    print("\n=== APPAREL CHECK ===")
    product = make_placeholder_product("apparel")
    model_photo = make_placeholder_model()

    cutout = segmentation.segment(product)
    print(f"Segmented cutout: {len(cutout)} bytes")

    try:
        result = generation.generate_apparel_composite(cutout, model_photo, "full_body")
        out_path = os.path.join(OUT_DIR, "apparel_result.png")
        with open(out_path, "wb") as f:
            f.write(result)
        print(f"APPAREL: OK — composite saved to {out_path}")
        return True
    except Exception as e:
        print(f"APPAREL: FAILED — {e}")
        return False


def run_jewelry_check():
    print("\n=== JEWELRY CHECK ===")
    product = make_placeholder_product("jewelry")
    model_photo = make_placeholder_model()

    cutout = segmentation.segment(product)
    print(f"Segmented cutout: {len(cutout)} bytes")

    anchor = generation.detect_jewelry_anchor(model_photo, "earring")
    print(f"Anchor detection: box={anchor['box']}, confidence={anchor['confidence']}")

    if anchor["box"] is None:
        print(
            "JEWELRY: landmark detection found no face — expected with a placeholder "
            "model photo (no real face present). This check needs a real model photo "
            "to be meaningful; mechanics-only pass continues with a dummy box."
        )
        anchor["box"] = [200, 100, 300, 180]

    try:
        result = generation.generate_jewelry_composite(cutout, model_photo, anchor["box"], "earring")
        out_path = os.path.join(OUT_DIR, "jewelry_result.png")
        with open(out_path, "wb") as f:
            f.write(result)
        print(f"JEWELRY: OK — composite saved to {out_path}")
        return True
    except Exception as e:
        print(f"JEWELRY: FAILED — {e}")
        return False


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    apparel_ok = run_apparel_check()
    jewelry_ok = run_jewelry_check()

    print("\n=== SUMMARY ===")
    print(f"Apparel pipeline mechanics: {'PASS' if apparel_ok else 'FAIL'}")
    print(f"Jewelry pipeline mechanics: {'PASS' if jewelry_ok else 'FAIL'}")
    print(
        "Reminder: this only proves the pipeline runs. Real quality validation "
        "(the actual §10 go/no-go) needs real product + model photos."
    )
