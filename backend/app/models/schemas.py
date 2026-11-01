from typing import Literal, Optional

from pydantic import BaseModel


class ProductUploadResponse(BaseModel):
    product_id: int
    cutout_image_url: str


class ModelLibraryEntry(BaseModel):
    id: int
    name: str
    base_image_urls: dict
    active: bool


class JobCreateRequest(BaseModel):
    product_id: int
    model_id: int


class JobCreateResponse(BaseModel):
    job_id: int


class JobStatusResponse(BaseModel):
    status: Literal["pending", "processing", "complete", "needs_review", "failed"]
    result_urls: Optional[dict] = None
    placement_confidence: Optional[float] = None
    error: Optional[str] = None
