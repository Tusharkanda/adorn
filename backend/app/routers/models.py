from fastapi import APIRouter

from app.db import get_connection
from app.models.schemas import ModelLibraryEntry

router = APIRouter(tags=["models"])


@router.get("/models", response_model=list[ModelLibraryEntry])
def list_models():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("select id, name, base_image_urls, active from model_library where active order by id")
    rows = cur.fetchall()
    conn.close()
    return rows
