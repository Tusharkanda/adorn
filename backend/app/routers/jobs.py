from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.auth import get_current_user
from app.db import get_connection
from app.models.schemas import JobCreateRequest, JobCreateResponse, JobStatusResponse
from app.services import generation, storage

router = APIRouter(prefix="/jobs", tags=["jobs"])

CONFIDENCE_THRESHOLD = 0.6

# POC limitation: products don't yet record a jewelry piece_type (earring/necklace/
# ring/bracelet), so jewelry jobs default to 'earring'. Needs a schema + upload-form
# addition before jewelry is a real multi-piece-type feature -- see PROGRESS.md.
DEFAULT_JEWELRY_PIECE_TYPE = "earring"


@router.post("", response_model=JobCreateResponse)
def create_job(
    body: JobCreateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("select id, category, cutout_image_url from products where id = %s and user_id = %s", (body.product_id, user["id"]))
    product = cur.fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=404, detail="product not found")

    cur.execute("select id, base_image_urls from model_library where id = %s and active", (body.model_id,))
    model = cur.fetchone()
    if not model:
        conn.close()
        raise HTTPException(status_code=404, detail="model not found")

    cur.execute(
        """
        insert into jobs (user_id, product_id, model_id, status, occasion, environment)
        values (%s, %s, %s, 'pending', %s, %s) returning id
        """,
        (user["id"], body.product_id, body.model_id, body.occasion, body.environment),
    )
    job_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()

    background_tasks.add_task(_process_job, job_id)
    return JobCreateResponse(job_id=job_id)


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "select status, result_urls, placement_confidence, error from jobs where id = %s and user_id = %s",
        (job_id, user["id"]),
    )
    job = cur.fetchone()
    conn.close()
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return JobStatusResponse(**job)


def _fetch_bytes(url: str) -> bytes:
    import httpx

    return httpx.get(url, timeout=30).content


def _resolve_pose_urls(base_image_urls: dict, occasion: str | None) -> dict:
    """model_library.base_image_urls is either flat ({pose: url}, the
    original single-look shape) or nested ({occasion: {pose: url}}, for
    models with multiple styled looks like bridal/festive/daily). Resolve to
    a flat {pose: url} dict either way, picking the requested occasion (or
    the first available one if none was requested/found)."""
    if not base_image_urls:
        return {}
    if not isinstance(next(iter(base_image_urls.values())), dict):
        return base_image_urls
    if occasion and occasion in base_image_urls:
        return base_image_urls[occasion]
    return next(iter(base_image_urls.values()))


def _process_job(job_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        select j.id, j.product_id, j.model_id, j.occasion, j.environment,
               p.category, p.cutout_image_url, m.base_image_urls
        from jobs j
        join products p on p.id = j.product_id
        join model_library m on m.id = j.model_id
        where j.id = %s
        """,
        (job_id,),
    )
    job = cur.fetchone()

    cur.execute("update jobs set status = 'processing' where id = %s", (job_id,))
    conn.commit()

    try:
        cutout_bytes = _fetch_bytes(job["cutout_image_url"])
        base_urls = _resolve_pose_urls(job["base_image_urls"], job["occasion"])

        if job["category"] == "apparel":
            result_urls = {}
            for framing, pose in (("full_body", "front"), ("closeup", "closeup")):
                model_bytes = _fetch_bytes(base_urls[pose])
                composite = generation.generate_apparel_composite(
                    cutout_bytes, model_bytes, framing, job["environment"]
                )
                key = f"jobs/{job_id}/{framing}.png"
                result_urls[framing] = storage.upload_bytes(key, composite, "image/png")

            cur.execute(
                "update jobs set status = 'complete', result_urls = %s where id = %s",
                (_to_json(result_urls), job_id),
            )
        else:  # jewelry
            piece_type = DEFAULT_JEWELRY_PIECE_TYPE
            anchor_pose = {"earring": "ear", "necklace": "neck", "ring": "hand", "bracelet": "hand"}[piece_type]
            model_bytes = _fetch_bytes(base_urls[anchor_pose])

            anchor = generation.detect_jewelry_anchor(model_bytes, piece_type)
            confidence = anchor["confidence"]
            box = anchor["box"] or [0, 0, 0, 0]

            composite = generation.generate_jewelry_composite(
                cutout_bytes, model_bytes, box, piece_type, job["environment"]
            )
            key = f"jobs/{job_id}/{piece_type}.png"
            result_url = storage.upload_bytes(key, composite, "image/png")

            status = "complete" if confidence >= CONFIDENCE_THRESHOLD else "needs_review"
            cur.execute(
                "update jobs set status = %s, result_urls = %s, placement_confidence = %s where id = %s",
                (status, _to_json({piece_type: result_url}), confidence, job_id),
            )

        conn.commit()
    except Exception as e:
        cur.execute("update jobs set status = 'failed', error = %s where id = %s", (str(e), job_id))
        conn.commit()
    finally:
        conn.close()


def _to_json(data: dict) -> str:
    import json

    return json.dumps(data)
