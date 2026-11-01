"""Seed the model_library table with placeholder model photos.

Placeholder-only: generates solid-color labeled images and uploads them to R2,
then inserts rows. Swap in real photographed models later by re-running this
script's upload+insert logic with real files — no schema change needed.
"""
import io
import json

from PIL import Image, ImageDraw

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


def make_placeholder(label: str, color: tuple) -> bytes:
    img = Image.new("RGB", (512, 768), color)
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), label, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def seed():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("delete from model_library")

    for model in MODELS:
        base_image_urls = {}
        for pose in POSES:
            label = f"{model['name']} - {pose}"
            data = make_placeholder(label, model["color"])
            key = f"model_library/{model['name'].lower().replace(' ', '_')}/{pose}.jpg"
            url = upload_bytes(key, data, "image/jpeg")
            base_image_urls[pose] = url

        cur.execute(
            "insert into model_library (name, base_image_urls, active) values (%s, %s, %s)",
            (model["name"], json.dumps(base_image_urls), True),
        )
        print(f"Seeded {model['name']}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    seed()
