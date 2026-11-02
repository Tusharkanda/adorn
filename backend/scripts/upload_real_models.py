"""Upload real photographed models, replacing the placeholder swatches.

Usage:
    1. Create a folder per model under scripts/model_photos/, named after the
       model (the folder name becomes the model's display name, title-cased):

           backend/scripts/model_photos/
             amara/
               front.jpg
               three_quarter.jpg
               closeup.jpg
               hand.jpg       (optional, needed for ring/bracelet jewelry)
               ear.jpg        (optional, needed for earrings)
               neck.jpg       (optional, needed for necklaces)
             elena/
               front.jpg
               closeup.jpg
               ...

       You don't need every pose -- only upload what you have. For apparel,
       'front' and 'closeup' are what generation.py actually uses. For
       jewelry, it needs 'ear', 'neck' or 'hand' depending on piece type.
       'three_quarter' is display-only (shown in the frontend model picker).

    2. Run from backend/:
           PYTHONPATH=. python scripts/upload_real_models.py

       Add --dir to point elsewhere, or --root-dir to use a different
       scripts/ root.

This upserts by model name (same row is reused if it already exists), so it
won't break jobs that already reference these models, and partial pose sets
are merged into whatever base_image_urls the model already has rather than
replacing the whole dict.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, ".")

from app.db import get_connection
from app.services.storage import upload_bytes

POSES = {"front", "three_quarter", "closeup", "hand", "ear", "neck"}

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
}


def upload_model_dir(model_dir: Path, cur) -> None:
    name = model_dir.name.replace("_", " ").replace("-", " ").title()

    files = [f for f in model_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
    if not files:
        print(f"Skipping {model_dir.name}: no files")
        return

    new_urls: dict[str, str] = {}
    for f in sorted(files):
        pose = f.stem.lower()
        if pose not in POSES:
            print(f"  ! skipping {f.name}: '{pose}' isn't a recognized pose {sorted(POSES)}")
            continue
        content_type = CONTENT_TYPES.get(f.suffix.lower())
        if content_type is None:
            print(f"  ! skipping {f.name}: unsupported extension {f.suffix}")
            continue

        key = f"model_library/{model_dir.name.lower()}/{pose}{f.suffix.lower()}"
        url = upload_bytes(key, f.read_bytes(), content_type)
        new_urls[pose] = url
        print(f"  uploaded {pose} -> {url}")

    if not new_urls:
        print(f"Skipping {name}: no recognized pose files")
        return

    cur.execute("select id, base_image_urls from model_library where name = %s", (name,))
    existing = cur.fetchone()
    if existing:
        merged = {**existing["base_image_urls"], **new_urls}
        cur.execute(
            "update model_library set base_image_urls = %s, active = true where id = %s",
            (json.dumps(merged), existing["id"]),
        )
        print(f"Updated {name} ({len(new_urls)} pose(s))")
    else:
        cur.execute(
            "insert into model_library (name, base_image_urls, active) values (%s, %s, %s)",
            (name, json.dumps(new_urls), True),
        )
        print(f"Created {name} ({len(new_urls)} pose(s))")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dir",
        default=str(Path(__file__).parent / "model_photos"),
        help="Folder containing one subfolder per model (default: scripts/model_photos)",
    )
    args = parser.parse_args()

    root = Path(args.dir)
    if not root.exists():
        print(f"{root} doesn't exist. Create it with one subfolder per model, e.g.:")
        print(f"  {root}/amara/front.jpg")
        sys.exit(1)

    model_dirs = sorted(d for d in root.iterdir() if d.is_dir())
    if not model_dirs:
        print(f"No model subfolders found in {root}")
        sys.exit(1)

    conn = get_connection()
    cur = conn.cursor()
    for model_dir in model_dirs:
        print(f"\n{model_dir.name}/")
        upload_model_dir(model_dir, cur)
    conn.commit()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
