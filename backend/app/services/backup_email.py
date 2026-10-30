"""Account security flow. No password reset or authentication bypass is provided."""
import asyncio
import hashlib
import hmac
import secrets
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.core.email import send_security_email
from app.core.exceptions import AppError
from app.core.security import verify_password
from app.crud import backup_email as crud
from app.models.audit import AuditLog
from app.models.backup_email import BackupEmail, BackupEmailChallenge, BackupEmailRateEvent
from app.models.base import utcnow
from app.schemas.backup_email import BackupEmailState


def digest(value):
    return hmac.new(settings.SECRET_KEY.encode(), ("ajr-backup-v1:" + value).encode(), hashlib.sha256).hexdigest()


def code_digest(user_id, email, nonce, code):
    return digest(f"verify:{user_id}:{email}:{nonce}:{code}")


async def limit(db, user_id, ip, destination=None):
    """Sliding hour in PostgreSQL, serialized across workers; failures consume quota too."""
    scopes = [] if destination is not None else [(f"user:{user_id}", settings.BACKUP_MAX_OPERATIONS_USER),
              (f"ip:{ip}", settings.BACKUP_MAX_OPERATIONS_IP)]
    if destination is not None:
        scopes += [(f"send-user:{user_id}", settings.BACKUP_MAX_SENDS_USER),
                   (f"send-ip:{ip}", settings.BACKUP_MAX_SENDS_IP),
                   (f"destination:{destination}", settings.BACKUP_MAX_SENDS_DESTINATION)]
    now = utcnow()
    keys = sorted((digest(scope), maximum) for scope, maximum in scopes)
    for key, _ in keys:
        await crud.lock_key(db, "backup-limit:" + key)
    for key, maximum in keys:
        count = await db.scalar(select(func.count()).select_from(BackupEmailRateEvent).where(
            BackupEmailRateEvent.key == key, BackupEmailRateEvent.created_at > now - timedelta(hours=1)))
        if count >= maximum:
            await db.rollback()
            raise HTTPException(429, "backup_rate_limited", headers={"Retry-After": "3600"})
    db.add_all([BackupEmailRateEvent(key=key, created_at=now) for key, _ in keys])
    await db.commit()


async def state(db, user_id):
    active = await crud.active(db, user_id)
    pending = await crud.challenge(db, user_id)
    return BackupEmailState(
        status="verified" if active else "pending" if pending else "not_configured",
        email=active.email if active else None,
        verified_at=active.verified_at if active else None,
        pending_email=pending.email if pending else None,
        expires_at=pending.expires_at if pending else None,
        resend_available_at=pending.sent_at + timedelta(seconds=settings.BACKUP_RESEND_SECONDS) if pending else None,
        attempts_remaining=max(0, settings.BACKUP_MAX_ATTEMPTS - pending.attempts) if pending else None,
        challenge_expired=pending.expires_at <= utcnow() if pending else False,
    )


async def reauthenticate(user, password):
    if not await verify_password(password, user.hashed_password):
        raise AppError(403, "backup_password_incorrect")


def audit(db, user, action):
    # All roles, same transaction, no email, IP, code, digest or password snapshots.
    db.add(AuditLog(user_id=user.id, action=action, entity="backup_emails"))


async def request_code(db, user_id, ip, payload, *, resend=False):
    # First quota bounds password guessing; sending quota is consumed after authentication.
    await limit(db, user_id, ip)
    user = await crud.lock_user(db, user_id)
    await reauthenticate(user, payload.current_password)
    pending = await crud.challenge(db, user_id)
    if resend and pending is None:
        raise AppError(409, "backup_no_challenge")
    email = pending.email if resend else str(payload.email)
    now = utcnow()
    if pending and (now - pending.sent_at).total_seconds() < settings.BACKUP_RESEND_SECONDS:
        raise HTTPException(429, "backup_cooldown", headers={"Retry-After": str(settings.BACKUP_RESEND_SECONDS)})
    # Commit limiter separately so SMTP failures cannot undo abuse counters. Re-lock/recheck.
    await limit(db, user_id, ip, email)
    user = await crud.lock_user(db, user_id)
    await reauthenticate(user, payload.current_password)
    pending = await crud.challenge(db, user_id)
    if resend and (pending is None or pending.email != email):
        raise AppError(409, "backup_no_challenge")
    now = utcnow()
    if pending and (now - pending.sent_at).total_seconds() < settings.BACKUP_RESEND_SECONDS:
        raise HTTPException(429, "backup_cooldown", headers={"Retry-After": str(settings.BACKUP_RESEND_SECONDS)})
    await crud.check_address(db, email)
    code = f"{secrets.randbelow(1_000_000):06d}"
    while pending and hmac.compare_digest(pending.code_digest, code_digest(user_id, pending.email, pending.nonce, code)):
        code = f"{secrets.randbelow(1_000_000):06d}"
    nonce = secrets.token_hex(16)
    values = dict(email=email, purpose="backup_email_verify", nonce=nonce,
                  code_digest=code_digest(user_id, email, nonce, code), attempts=0,
                  sent_at=now, expires_at=now + timedelta(seconds=settings.BACKUP_CODE_TTL_SECONDS))
    if pending:
        for key, value in values.items():
            setattr(pending, key, value)
    else:
        db.add(BackupEmailChallenge(user_id=user_id, **values))
    audit(db, user, "backup_code_sent")
    await db.flush()
    en = payload.language == "en"
    subject = "Verify your backup email" if en else "Verificá tu correo de respaldo"
    message = (f"Your AJR DATA code is {code}. Valid for {settings.BACKUP_CODE_TTL_SECONDS // 60} minutes. Never share it."
               if en else f"Tu código de AJR DATA es {code}. Válido por {settings.BACKUP_CODE_TTL_SECONDS // 60} minutos. No lo compartas.")
    try:
        await asyncio.to_thread(send_security_email, email, subject, message)
    except Exception:
        await db.rollback()
        raise AppError(503, "backup_mail_unavailable") from None
    await db.commit()
    return await state(db, user_id)


async def notify(user, language):
    en = language == "en"
    try:
        await asyncio.to_thread(send_security_email, user.email,
            "AJR DATA account security" if en else "Seguridad de tu cuenta AJR DATA",
            "Your backup email settings changed. If this was not you, contact support."
            if en else "Cambió la configuración de tu correo de respaldo. Si no fuiste vos, contactá a soporte.")
        return True
    except Exception:
        return False  # Mutation already committed; UI must distinguish failed notice from failure.


async def verify(db, user_id, ip, payload):
    await limit(db, user_id, ip)
    user = await crud.lock_user(db, user_id)
    pending = await crud.challenge(db, user_id)
    if pending is None:
        raise AppError(409, "backup_no_challenge")
    if pending.expires_at <= utcnow():
        raise AppError(400, "backup_code_expired")
    if pending.attempts >= settings.BACKUP_MAX_ATTEMPTS:
        raise AppError(429, "backup_attempts_exhausted")
    expected = code_digest(user_id, pending.email, pending.nonce, payload.code)
    if pending.purpose != "backup_email_verify" or not hmac.compare_digest(pending.code_digest, expected):
        pending.attempts += 1
        audit(db, user, "backup_verify_failed")
        exhausted = pending.attempts >= settings.BACKUP_MAX_ATTEMPTS
        await db.commit()  # Failed attempts must survive HTTP errors.
        raise AppError(429 if exhausted else 400, "backup_attempts_exhausted" if exhausted else "backup_code_invalid")
    await crud.check_address(db, pending.email)
    active = await crud.active(db, user_id)
    if active:
        active.email, active.verified_at = pending.email, utcnow()
    else:
        db.add(BackupEmail(user_id=user_id, email=pending.email, verified_at=utcnow()))
    await db.delete(pending)
    audit(db, user, "backup_email_verified")
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "backup_address_unavailable") from None
    result = await state(db, user_id)
    result.notification_sent = await notify(user, payload.language)
    return result


async def remove(db, user_id, ip, payload):
    await limit(db, user_id, ip)
    user = await crud.lock_user(db, user_id)
    await reauthenticate(user, payload.current_password)
    active = await crud.active(db, user_id)
    pending = await crud.challenge(db, user_id)
    changed = bool(active or pending)
    if active:
        await db.delete(active)
    if pending:
        await db.delete(pending)
    if changed:
        audit(db, user, "backup_email_removed")
    await db.commit()
    result = await state(db, user_id)
    if changed:
        result.notification_sent = await notify(user, payload.language)
    return result
