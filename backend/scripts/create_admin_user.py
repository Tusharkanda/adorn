"""Create (or reset the password for) a test user in Supabase auth for frontend testing."""

import secrets
import sys

from supabase import create_client

sys.path.insert(0, ".")
from app.config import settings

EMAIL = "admin@adorn.test"
PASSWORD = secrets.token_urlsafe(9)

client = create_client(settings.supabase_url, settings.supabase_service_key)

existing = client.auth.admin.list_users()
match = next((u for u in existing if u.email == EMAIL), None)

if match:
    client.auth.admin.update_user_by_id(match.id, {"password": PASSWORD})
    print(f"Updated password for existing user {EMAIL}")
else:
    client.auth.admin.create_user(
        {"email": EMAIL, "password": PASSWORD, "email_confirm": True}
    )
    print(f"Created user {EMAIL}")

print(f"EMAIL={EMAIL}")
print(f"PASSWORD={PASSWORD}")
