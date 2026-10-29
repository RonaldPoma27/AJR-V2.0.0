"""Primitivas criptográficas pequeñas para la verificación del correo de respaldo."""
import hashlib
import hmac
import secrets

from app.core.config import settings

PURPOSE = "VERIFY_BACKUP_EMAIL"


def generate_code() -> str:
    """Genera un código numérico de seis cifras, conservando ceros iniciales."""
    return f"{secrets.randbelow(1_000_000):06d}"


def code_digest(*, challenge_id: int, user_id: int, target_email: str, code: str) -> str:
    """HMAC-SHA256 contextual; el código de baja entropía nunca se almacena en claro."""
    secret = (settings.BACKUP_EMAIL_CODE_SECRET or settings.SECRET_KEY).encode("utf-8")
    payload = f"{PURPOSE}:{challenge_id}:{user_id}:{target_email.lower()}:{code}".encode("utf-8")
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()
