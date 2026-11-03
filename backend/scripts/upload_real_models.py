"""Upload real photographed models, replacing the placeholder swatches.

Supports multiple styled "occasions" per model (e.g. bridal, festive, daily)
so a jeweler/designer can pick which look they want a shoot generated in.

Usage:
    1. Create a folder per model under scripts/model_photos/, named after the
       model (the folder name becomes the model's display name, title-cased).

       If the model only needs one look, put photos directly in the model
       folder:

           backend/scripts/model_photos/
             amara/
               front.jpg
               three_quarter.jpg
               closeup.jpg
               hand.jpg       (optional, needed for ring/bracelet jewelry)
               ear.jpg        (optional, needed for earrings)
               neck.jpg       (optional, needed for necklaces)

       If the model has multiple occasion looks, put each look in its own
       subfolder instead:

           backend/scripts/model_photos/
             priya/
               bridal/
                 front.jpg
                 closeup.jpg
                 ear.jpg
                 neck.jpg
                 hand.jpg
               festive/
                 front.jpg
                 closeup.jpg
                 ear.jpg
               daily/
                 front.jpg
                 closeup.jpg

       You can mix: loose files directly in the model folder become an
       occasion named "default". You don't need every pose in every
       occasion -- only upload what you have. For apparel, 'front' and
       'closeup' are what generation.py actually uses. For jewelry, it
       needs 'ear', 'neck' or 'hand' depending on piece type.
       'three_quarter' is display-only (shown in the frontend model picker).

    2. Run from backend/:
           PYTHONPATH=. python scripts/upload_real_models.py

       Add --dir to point elsewhere.

This upserts by model name (same row is reused if it already exists), so it
won't break jobs that already reference these models. Pose sets are merged
occasion-by-occasion into whatever base_image_urls the model already has
rather than replacing the whole thing, so re-running this script to add one
more occasion later is safe.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, ".")

from app.db import get_connection
from app.services.storage import upload_bytes

POSES = {"front", "three_quarter", "closeup", "hand", "ear", "neck"}
DEFAULT_OCCASION = "default"

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
}


def _slug(s: str) -> str:
    return s.strip().lower().replace(" ", "_").replace("-", "_")


def _display_name(s: str) -> str:
    return s.replace("_", " ").replace("-", " ").title()


def upload_pose_files(files: list[Path], key_prefix: str) -> dict[str, str]:
    poses: dict[str, str] = {}
    for f in sorted(files):
        pose = f.stem.lower()
        if pose not in POSES:
            print(f"    ! skipping {f.name}: '{pose}' isn't a recognized pose {sorted(POSES)}")
            continue
        content_type = CONTENT_TYPES.get(f.suffix.lower())
        if content_type is None:
            print(f"    ! skipping {f.name}: unsupported extension {f.suffix}")
            continue

        key = f"{key_prefix}/{pose}{f.suffix.lower()}"
        url = upload_bytes(key, f.read_bytes(), content_type)
        poses[pose] = url
        print(f"    uploaded {pose} -> {url}")
    return poses


def merge_occasion(existing: dict, occasion: str, new_poses: dict) -> dict:
    """Normalizes `existing` to the nested {occasion: {pose: url}} shape
    (wrapping an old flat {pose: url} dict as "default" if needed) and
    merges in new_poses under `occasion`."""
    if existing and not isinstance(next(iter(existing.values())), dict):
        existing = {DEFAULT_OCCASION: existing}
    merged = dict(existing or {})
    merged[occasion] = {**merged.get(occasion, {}), **new_poses}
    return merged


def upload_model_dir(model_dir: Path, cur) -> None:
    name = _display_name(model_dir.name)

    loose_files = [f for f in model_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
    occasion_dirs = [d for d in model_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]

    if not loose_files and not occasion_dirs:
        print(f"Skipping {model_dir.name}: empty folder")
        return

    occasions: dict[str, dict[str, str]] = {}

    if loose_files:
        print(f"  [{DEFAULT_OCCASION}]")
        poses = upload_pose_files(loose_files, f"model_library/{model_dir.name.lower()}")
        if poses:
            occasions[DEFAULT_OCCASION] = poses

    for occ_dir in sorted(occasion_dirs):
        occ_files = [f for f in occ_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
        if not occ_files:
            continue
        occasion = _slug(occ_dir.name)
        print(f"  [{occasion}]")
        poses = upload_pose_files(
            occ_files, f"model_library/{model_dir.name.lower()}/{occasion}"
        )
        if poses:
            occasions[occasion] = poses

    if not occasions:
        print(f"Skipping {name}: no recognized pose files")
        return

    cur.execute("select id, base_image_urls from model_library where name = %s", (name,))
    existing = cur.fetchone()
    base_image_urls = existing["base_image_urls"] if existing else {}
    for occasion, poses in occasions.items():
        base_image_urls = merge_occasion(base_image_urls, occasion, poses)

    pose_count = sum(len(p) for p in occasions.values())
    if existing:
        cur.execute(
            "update model_library set base_image_urls = %s, active = true where id = %s",
            (json.dumps(base_image_urls), existing["id"]),
        )
        print(f"Updated {name} ({len(occasions)} occasion(s), {pose_count} photo(s))")
    else:
        cur.execute(
            "insert into model_library (name, base_image_urls, active) values (%s, %s, %s)",
            (name, json.dumps(base_image_urls), True),
        )
        print(f"Created {name} ({len(occasions)} occasion(s), {pose_count} photo(s))")


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
        print(f"  {root}/priya/bridal/front.jpg")
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
