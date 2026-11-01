import io
import os
import urllib.request

import mediapipe as mp
import numpy as np
from google import genai
from google.genai import types
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from PIL import Image

from app.config import settings

_MODEL_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".mp_models")
_FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
_HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)


def _ensure_model(url: str) -> str:
    os.makedirs(_MODEL_CACHE_DIR, exist_ok=True)
    path = os.path.join(_MODEL_CACHE_DIR, url.rsplit("/", 1)[-1])
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    return path

MODEL_NAME = "gemini-3.1-flash-lite-image"

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _bytes_to_image(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


def _extract_image_bytes(response) -> bytes:
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data
    raise RuntimeError("Gemini response contained no image data")


def generate_apparel_composite(cutout_bytes: bytes, model_photo_bytes: bytes, framing: str) -> bytes:
    """framing: 'full_body' or 'closeup'."""
    prompt = (
        f"Composite this garment onto this model photo, photorealistic, {framing} framing. "
        "Preserve the garment's exact color, pattern, and texture. Keep the model's pose, "
        "face, and background unchanged — only replace/add the clothing. "
        "The product photo is a flat-lay shot: any visible brand/size tag near the collar "
        "is sewn on the INSIDE BACK of the neckline and is never visible from the front or "
        "on a worn garment — do not render it anywhere in the output image."
    )
    response = _get_client().models.generate_content(
        model=MODEL_NAME,
        contents=[prompt, _bytes_to_image(cutout_bytes), _bytes_to_image(model_photo_bytes)],
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )
    return _extract_image_bytes(response)


_face_detector = None
_hand_detector = None


def _get_face_detector():
    global _face_detector
    if _face_detector is None:
        model_path = _ensure_model(_FACE_MODEL_URL)
        options = mp_vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            num_faces=1,
        )
        _face_detector = mp_vision.FaceLandmarker.create_from_options(options)
    return _face_detector


def _get_hand_detector():
    global _hand_detector
    if _hand_detector is None:
        model_path = _ensure_model(_HAND_MODEL_URL)
        options = mp_vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            num_hands=2,
        )
        _hand_detector = mp_vision.HandLandmarker.create_from_options(options)
    return _hand_detector


def detect_jewelry_anchor(model_photo_bytes: bytes, piece_type: str) -> dict:
    """piece_type: 'earring' | 'necklace' | 'ring' | 'bracelet'.

    Returns {"box": [x0,y0,x1,y1] in pixel coords, "confidence": float} or
    {"box": None, "confidence": 0.0} if no landmark was found.
    """
    pil_img = _bytes_to_image(model_photo_bytes)
    arr = np.array(pil_img)
    h, w = arr.shape[:2]
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)

    if piece_type in ("earring", "necklace"):
        result = _get_face_detector().detect(mp_image)
        if not result.face_landmarks:
            return {"box": None, "confidence": 0.0}
        landmarks = result.face_landmarks[0]
        xs = [lm.x * w for lm in landmarks]
        ys = [lm.y * h for lm in landmarks]
        confidence = 0.9
    else:  # ring, bracelet
        result = _get_hand_detector().detect(mp_image)
        if not result.hand_landmarks:
            return {"box": None, "confidence": 0.0}
        landmarks = result.hand_landmarks[0]
        xs = [lm.x * w for lm in landmarks]
        ys = [lm.y * h for lm in landmarks]
        confidence = 0.8

    box = [min(xs), min(ys), max(xs), max(ys)]
    return {"box": box, "confidence": confidence}


def generate_jewelry_composite(
    cutout_bytes: bytes, model_photo_bytes: bytes, anchor_box: list, piece_type: str
) -> bytes:
    prompt = (
        f"Composite this {piece_type} onto this model photo at approximately pixel region "
        f"{anchor_box} (x0,y0,x1,y1), photorealistic. Preserve the piece's reflectivity, "
        "metal/gem detail, and scale relative to the anchor region. Keep the model's face, "
        "skin, and background unchanged."
    )
    response = _get_client().models.generate_content(
        model=MODEL_NAME,
        contents=[prompt, _bytes_to_image(cutout_bytes), _bytes_to_image(model_photo_bytes)],
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )
    return _extract_image_bytes(response)
