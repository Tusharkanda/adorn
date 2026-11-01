from rembg import new_session, remove

# u2net is ~176MB vs rembg's new default bria-rmbg (~1GB), which OOMs on
# memory-constrained dev machines. u2net is plenty for POC product cutouts.
_session = None


def _get_session():
    global _session
    if _session is None:
        _session = new_session("u2net")
    return _session


def segment(image_bytes: bytes) -> bytes:
    """Remove background from a product photo, returning a PNG cutout with alpha."""
    return remove(image_bytes, session=_get_session())
