import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth import get_current_user
from app.db import get_connection
from app.models.schemas import ProductUploadResponse
from app.services import segmentation, storage

router = APIRouter(prefix="/products", tags=["products"])


@router.post("/upload", response_model=ProductUploadResponse)
async def upload_product(
    file: UploadFile = File(...),
    category: str = Form(...),
    user: dict = Depends(get_current_user),
):
    if category not in ("apparel", "jewelry"):
        raise HTTPException(status_code=400, detail="category must be 'apparel' or 'jewelry'")

    original_bytes = await file.read()
    key_prefix = f"products/{user['id']}/{uuid.uuid4()}"

    original_url = storage.upload_bytes(
        f"{key_prefix}/original{_ext(file.filename)}", original_bytes, file.content_type or "image/jpeg"
    )

    cutout_bytes = segmentation.segment(original_bytes)
    cutout_url = storage.upload_bytes(f"{key_prefix}/cutout.png", cutout_bytes, "image/png")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        insert into products (user_id, category, original_image_url, cutout_image_url)
        values (%s, %s, %s, %s)
        returning id
        """,
        (user["id"], category, original_url, cutout_url),
    )
    product_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()

    return ProductUploadResponse(product_id=product_id, cutout_image_url=cutout_url)


def _ext(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()
