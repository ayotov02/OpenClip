from minio import Minio

from app.core.config import settings

storage_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=settings.MINIO_SECURE,
)


def ensure_bucket() -> None:
    if not storage_client.bucket_exists(settings.MINIO_BUCKET):
        storage_client.make_bucket(settings.MINIO_BUCKET)
