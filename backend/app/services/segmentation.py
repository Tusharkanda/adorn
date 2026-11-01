from rembg import new_session, remove

# isnet-general-use is ~176MB, same ballpark as u2net, vs rembg's default
# bria-rmbg (~1GB) which OOMs on memory-constrained dev machines. Unlike u2net
# it resolves fine open structures (e.g. the holes inside dangly earrings)
# instead of treating the whole silhouette as one solid blob.
_session = None


def _get_session():
    global _session
    if _session is None:
        _session = new_session("isnet-general-use")
    return _session


def segment(image_bytes: bytes) -> bytes:
    """Remove background from a product photo, returning a PNG cutout with alpha."""
    return remove(
        image_bytes,
        session=_get_session(),
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=5,
        post_process_mask=True,
    )
