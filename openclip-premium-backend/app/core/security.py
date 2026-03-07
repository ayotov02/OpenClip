import hashlib
import secrets


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, key_hash, key_prefix)."""
    raw = f"oc_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    prefix = raw[:7]
    return raw, key_hash, prefix
