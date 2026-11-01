import jwt
from fastapi import Header, HTTPException

from app.config import settings
from app.db import get_connection

# Supabase projects created from ~2025 onward sign JWTs with ES256 via a
# per-project JWKS endpoint, not the legacy HS256 shared secret
# (SUPABASE_JWT_SECRET is kept in config for older/legacy projects but isn't
# used here -- verified against a real token during Phase 3 testing).
_jwks_client = jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id = payload["sub"]
    email = payload.get("email", "")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        insert into users (id, email) values (%s, %s)
        on conflict (id) do update set email = excluded.email
        returning id, email
        """,
        (user_id, email),
    )
    user = cur.fetchone()
    conn.commit()
    conn.close()

    return user
