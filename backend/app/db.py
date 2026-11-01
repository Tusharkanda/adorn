import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings


def _psycopg2_dsn(database_url: str) -> str:
    # psycopg2 doesn't understand the `pgbouncer` query param some Supabase
    # connection strings include (it's a hint for drivers using prepared
    # statements against the transaction-mode pooler).
    return database_url.split("?")[0]


def get_connection():
    return psycopg2.connect(_psycopg2_dsn(settings.database_url), cursor_factory=RealDictCursor)
