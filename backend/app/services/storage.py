import boto3

from app.config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def upload_bytes(key: str, data: bytes, content_type: str) -> str:
    _client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return public_url(key)


def public_url(key: str) -> str:
    return f"{settings.r2_public_url.rstrip('/')}/{key}"
