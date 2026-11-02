"""Seed the model_library table with placeholder model photos.

Placeholder-only: generates solid-color labeled images and uploads them to R2,
then inserts rows. Swap in real photographed models later by re-running this
script's upload+insert logic with real files — no schema change needed.
"""
import io
import json

from PIL import Image, ImageDraw, ImageFont

from app.db import get_connection
from app.services.storage import upload_bytes

MODELS = [
    {"name": "Model 1", "color": (200, 160, 140)},
    {"name": "Model 2", "color": (160, 180, 200)},
    {"name": "Model 3", "color": (180, 200, 160)},
    {"name": "Model 4", "color": (200, 180, 160)},
    {"name": "Model 5", "color": (170, 160, 190)},
]

POSES = ["front", "three_quarter", "closeup", "hand", "ear", "neck"]

_NAME_FONT = ImageFont.load_default(size=54)
_POSE_FONT = ImageFont.load_default(size=30)


def _luminance(color: tuple) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def make_placeholder(name: str, pose: str, color: tuple) -> bytes:
    """A clearly-a-placeholder card: name, pose label, and a simple person
    silhouette so it reads as 'no photo yet' rather than a broken image."""
    w, h = 512, 768
    ink = (30, 26, 20) if _luminance(color) > 140 else (250, 246, 238)

    img = Image.new("RGB", (w, h), color)
    draw = ImageDraw.Draw(img)

    # Simple person silhouette (head + shoulders) centered in the frame.
    cx, cy = w // 2, int(h * 0.42)
    head_r = 70
    draw.ellipse(
        [cx - head_r, cy - head_r, cx + head_r, cy + head_r], outline=ink, width=6
    )
    shoulder_w, shoulder_top = 220, cy + head_r + 30
    draw.arc(
        [cx - shoulder_w, shoulder_top, cx + shoulder_w, shoulder_top + 320],
        start=180,
        end=360,
        fill=ink,
        width=6,
    )

    draw.text((w // 2, h - 140), name, fill=ink, font=_NAME_FONT, anchor="mm")
    draw.text(
        (w // 2, h - 90),
        pose.replace("_", " ").upper(),
        fill=ink,
        font=_POSE_FONT,
        anchor="mm",
    )
    draw.text((20, 20), "PLACEHOLDER", fill=ink, font=_POSE_FONT)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def seed():
    """Upsert by name rather than delete+reinsert, so existing jobs that
    reference a model_library row by id don't get orphaned by a foreign key
    violation."""
    conn = get_connection()
    cur = conn.cursor()

    for model in MODELS:
        base_image_urls = {}
        for pose in POSES:
            data = make_placeholder(model["name"], pose, model["color"])
            key = f"model_library/{model['name'].lower().replace(' ', '_')}/{pose}.jpg"
            url = upload_bytes(key, data, "image/jpeg")
            base_image_urls[pose] = url

        cur.execute("select id from model_library where name = %s", (model["name"],))
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "update model_library set base_image_urls = %s, active = true where name = %s",
                (json.dumps(base_image_urls), model["name"]),
            )
            print(f"Updated {model['name']}")
        else:
            cur.execute(
                "insert into model_library (name, base_image_urls, active) values (%s, %s, %s)",
                (model["name"], json.dumps(base_image_urls), True),
            )
            print(f"Seeded {model['name']}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    seed()
