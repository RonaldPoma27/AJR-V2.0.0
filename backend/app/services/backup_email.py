"""Casos de uso seguros para correo de respaldo.

El código se genera y verifica en backend; la base solo conserva un HMAC ligado al usuario,
la dirección y el desafío. Los límites se calculan desde PostgreSQL, no desde memoria de proceso.
"""
import asyncio
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_event
from app.core.config import settings
from app.core.email import EmailDeliveryError, send_backup_email_code, send_backup_email_notice
from app.core.exceptions import AppError
from app.core.security import verify_password
from app.crud import backup_email as crud_backup_email
from app.models import User
from app.models.backup_email import BackupEmail, BackupEmailChallenge
from app.schemas.backup_email import BackupEmailState
from app.services.backup_email_crypto import code_digest, generate_code


PURPOSE = "VERIFY_BACKUP_EMAIL"
HOUR = timedelta(hours=1)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lock_key(value: str) -> int:
    # PostgreSQL acepta un bigint firmado para pg_advisory_xact_lock.
    raw = hashlib.blake2b(value.encode("utf-8"), digest_size=8, person=b"ajr-bkup").digest()
    return int.from_bytes(raw, byteorder="big", signed=True)


async def _acquire_locks(db: AsyncSession, keys: list[str]) -> None:
    """Serializa los contadores y operaciones por usuario/destino/IP entre workers."""
    for key in sorted(set(keys)):
        await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _lock_key(key)})


async def lock_backup_email_identity(db: AsyncSession, email: str) -> None:
    """Serializa cambios de correo principal con reservas de direcciones de respaldo."""
    await _acquire_locks(db, [f"backup-email:email:{email.strip().lower()}"])


async def _lock_user(db: AsyncSession, user_id: int) -> User:
    user = await db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise AppError(401, "No se pudieron validar las credenciales")
    return user


async def _require_password(user: User, current_password: str) -> None:
    if not await verify_password(current_password, user.hashed_password):
        raise AppError(400, "La contraseña actual no es correcta.")


async def _recent_count(db: AsyncSession, *, column, value: object, cutoff: datetime) -> int:
    stmt = select(func.count(BackupEmailChallenge.id)).where(
        column == value,
        BackupEmailChallenge.created_at >= cutoff,
        BackupEmailChallenge.purpose == PURPOSE,
    )
    return int(await db.scalar(stmt) or 0)


async def _check_request_limits(
    db: AsyncSession, *, user_id: int, target_email: str, request_ip: str, now: datetime
) -> None:
    cutoff = now - HOUR
    user_count = await _recent_count(
        db, column=BackupEmailChallenge.user_id, value=user_id, cutoff=cutoff
    )
    email_count = await _recent_count(
        db, column=BackupEmailChallenge.target_email, value=target_email, cutoff=cutoff
    )
    ip_count = await _recent_count(
        db, column=BackupEmailChallenge.request_ip, value=request_ip, cutoff=cutoff
    )
    if user_count >= settings.BACKUP_EMAIL_MAX_REQUESTS_USER_PER_HOUR:
        raise AppError(
            429,
            "Alcanzaste el límite de solicitudes para tu cuenta. Probá de nuevo más tarde.",
            headers={"Retry-After": "3600"},
        )
    if email_count >= settings.BACKUP_EMAIL_MAX_REQUESTS_EMAIL_PER_HOUR:
        raise AppError(
            429,
            "Ese correo recibió demasiados códigos recientemente. Probá de nuevo más tarde.",
            headers={"Retry-After": "3600"},
        )
    if ip_count >= settings.BACKUP_EMAIL_MAX_REQUESTS_IP_PER_HOUR:
        raise AppError(
            429,
            "Se alcanzó el límite de solicitudes desde esta conexión. Probá de nuevo más tarde.",
            headers={"Retry-After": "3600"},
        )

    latest = await db.scalar(
        select(BackupEmailChallenge)
        .where(
            BackupEmailChallenge.user_id == user_id,
            BackupEmailChallenge.target_email == target_email,
            BackupEmailChallenge.purpose == PURPOSE,
        )
        .order_by(BackupEmailChallenge.created_at.desc(), BackupEmailChallenge.id.desc())
        .limit(1)
    )
    if latest is not None:
        elapsed = max(0, int((now - latest.created_at).total_seconds()))
        cooldown = settings.BACKUP_EMAIL_RESEND_COOLDOWN_SECONDS
        if elapsed < cooldown:
            retry_after = cooldown - elapsed
            raise AppError(
                429,
                "Esperá un momento antes de solicitar o reenviar otro código.",
                headers={"Retry-After": str(retry_after)},
            )


async def _email_rows(db: AsyncSession, user_id: int, *, for_update: bool = False) -> list[BackupEmail]:
    return await crud_backup_email.list_for_user(db, user_id, for_update=for_update)


async def read_state(db: AsyncSession, user_id: int) -> BackupEmailState:
    rows = await _email_rows(db, user_id)
    verified = next((row for row in rows if row.status == "VERIFIED"), None)
    pending = next((row for row in rows if row.status == "PENDING"), None)
    challenge = await crud_backup_email.get_pending_challenge(db, user_id) if pending else None
    status = "verified" if verified else ("pending" if pending else "not_configured")
    return BackupEmailState(
        status=status,
        email=verified.email if verified else None,
        verified_at=verified.verified_at if verified else None,
        pending_email=pending.email if pending else None,
        pending_expires_at=challenge.expires_at if challenge else None,
    )


async def _validate_destination(db: AsyncSession, user: User, target_email: str) -> list[BackupEmail]:
    target = target_email.strip().lower()
    if target == user.email.strip().lower():
        raise AppError(400, "El correo de respaldo debe ser distinto del correo principal.")

    main_owner = await db.scalar(
        select(User.id).where(func.lower(User.email) == target).limit(1)
    )
    if main_owner is not None:
        raise AppError(409, "Ese correo ya se utiliza como correo principal de una cuenta.")

    rows = await _email_rows(db, user.id, for_update=True)
    collision = await db.scalar(
        select(BackupEmail.id)
        .where(
            BackupEmail.email == target,
            BackupEmail.status == "VERIFIED",
            BackupEmail.user_id != user.id,
        )
        .limit(1)
    )
    if collision is not None:
        raise AppError(409, "Ese correo ya está configurado como respaldo en otra cuenta.")
    own_verified = next((row for row in rows if row.status == "VERIFIED"), None)
    own_pending = next((row for row in rows if row.status == "PENDING"), None)
    if own_verified and own_verified.email.lower() == target:
        raise AppError(409, "Ese correo ya está verificado como correo de respaldo.")
    if own_pending and own_pending.email.lower() == target:
        raise AppError(409, "Ese correo ya tiene una verificación pendiente. Podés reenviar el código.")
    return rows


async def _make_challenge(
    db: AsyncSession, *, user_id: int, target_email: str, request_ip: str, now: datetime
) -> tuple[BackupEmailChallenge, str]:
    code = generate_code()
    challenge = BackupEmailChallenge(
        user_id=user_id,
        target_email=target_email,
        purpose=PURPOSE,
        code_hmac="0" * 64,
        expires_at=now + timedelta(minutes=settings.BACKUP_EMAIL_CODE_TTL_MINUTES),
        attempts=0,
        request_ip=request_ip[:64],
    )
    db.add(challenge)
    await db.flush()
    challenge.code_hmac = code_digest(
        challenge_id=challenge.id, user_id=user_id, target_email=target_email, code=code
    )
    await db.flush()
    return challenge, code


async def _send_code_or_rollback(
    db: AsyncSession,
    *,
    user_id: int,
    target_email: str,
    request_ip: str,
    code: str,
    now: datetime,
) -> None:
    lock_keys = [f"backup-email:user:{user_id}", f"backup-email:email:{target_email}", f"backup-email:ip:{request_ip}"]
    try:
        await asyncio.to_thread(
            send_backup_email_code,
            target_email,
            code,
            expires_minutes=settings.BACKUP_EMAIL_CODE_TTL_MINUTES,
        )
    except EmailDeliveryError:
        await db.rollback()
        # Conserva un marcador no verificable para que los límites persistentes también cuenten
        # intentos de envío fallidos. No contiene ni el código ni su HMAC real.
        try:
            await _acquire_locks(db, lock_keys)
            db.add(
                BackupEmailChallenge(
                    user_id=user_id,
                    target_email=target_email,
                    purpose=PURPOSE,
                    code_hmac="0" * 64,
                    expires_at=now,
                    attempts=settings.BACKUP_EMAIL_MAX_ATTEMPTS,
                    consumed_at=now,
                    invalidated_at=now,
                    request_ip=request_ip[:64],
                )
            )
            await db.commit()
        except Exception:  # noqa: BLE001 - el error original sigue siendo el error funcional.
            await db.rollback()
        raise AppError(
            503,
            "No se pudo enviar el código de verificación. Revisá la configuración SMTP e intentá más tarde.",
        ) from None


async def _audit(
    action: str, *, user: User, request_ip: str, method: str, path: str, detail: str
) -> None:
    # Se registra el evento sin la dirección de respaldo, el código ni el HMAC.
    await log_event(
        action,
        user_id=user.id,
        # No persistir direcciones de correo en el detalle del evento de seguridad.
        email=None,
        role=user.role.value,
        ip=request_ip,
        method=method,
        path=path,
        entity="backup_emails",
        entity_id=str(user.id),
        entity_label="Correo de respaldo",
        detail=detail,
    )


async def _notify_primary(primary_email: str, action: str) -> None:
    # Estas notificaciones son informativas y no deben revertir un cambio ya confirmado.
    await asyncio.to_thread(send_backup_email_notice, primary_email, action=action)


async def request_backup_email(
    db: AsyncSession,
    *,
    user_id: int,
    target_email: str,
    current_password: str,
    request_ip: str,
    method: str,
    path: str,
) -> BackupEmailState:
    target_email = target_email.strip().lower()
    await _acquire_locks(db, [f"backup-email:user:{user_id}", f"backup-email:email:{target_email}", f"backup-email:ip:{request_ip}"])
    user = await _lock_user(db, user_id)
    await _require_password(user, current_password)
    now = _now()
    await _check_request_limits(db, user_id=user.id, target_email=target_email, request_ip=request_ip, now=now)
    rows = await _validate_destination(db, user, target_email)

    # Los desafíos antiguos se mantienen durante la ventana de rate limit y luego se purgan.
    retention_cutoff = now - timedelta(hours=settings.BACKUP_EMAIL_CHALLENGE_RETENTION_HOURS)
    await crud_backup_email.purge_old_challenges(db, retention_cutoff)
    await crud_backup_email.invalidate_open_challenges(db, user.id, now)
    pending = next((row for row in rows if row.status == "PENDING"), None)
    if pending is not None:
        await db.delete(pending)  # el backup verificado anterior permanece intacto
        await db.flush()

    db.add(BackupEmail(user_id=user.id, email=target_email, status="PENDING", verified_at=None))
    await db.flush()
    _, code = await _make_challenge(
        db, user_id=user.id, target_email=target_email, request_ip=request_ip, now=now
    )
    # Se mantiene la transacción y los locks mientras se envía. Si SMTP falla, el estado previo
    # (incluido el correo verificado anterior) se conserva mediante rollback.
    await _send_code_or_rollback(db, user_id=user.id, target_email=target_email, request_ip=request_ip, code=code, now=now)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "Ese correo ya no está disponible. Probá con otra dirección.") from None

    await _audit(
        "backup_email_requested",
        user=user,
        request_ip=request_ip,
        method=method,
        path=path,
        detail="Se solicitó verificar un correo de respaldo.",
    )
    return await read_state(db, user.id)


async def resend_backup_email_code(
    db: AsyncSession,
    *,
    user_id: int,
    current_password: str,
    request_ip: str,
    method: str,
    path: str,
) -> BackupEmailState:
    initial_pending = await db.scalar(
        select(BackupEmail).where(BackupEmail.user_id == user_id, BackupEmail.status == "PENDING")
    )
    if initial_pending is None:
        raise AppError(409, "No hay un correo pendiente de verificación.")
    target_email = initial_pending.email
    await _acquire_locks(db, [f"backup-email:user:{user_id}", f"backup-email:email:{target_email}", f"backup-email:ip:{request_ip}"])
    user = await _lock_user(db, user_id)
    await _require_password(user, current_password)
    rows = await _email_rows(db, user.id, for_update=True)
    pending = next((row for row in rows if row.status == "PENDING"), None)
    if pending is None or pending.email != target_email:
        raise AppError(409, "El correo pendiente cambió. Actualizá el estado e intentá de nuevo.")

    now = _now()
    if target_email == user.email.strip().lower():
        raise AppError(409, "El correo de respaldo debe ser distinto del correo principal.")
    main_owner = await db.scalar(select(User.id).where(func.lower(User.email) == target_email).limit(1))
    other_backup_owner = await db.scalar(
        select(BackupEmail.id)
        .where(
            BackupEmail.email == target_email,
            BackupEmail.status == "VERIFIED",
            BackupEmail.user_id != user.id,
        )
        .limit(1)
    )
    if main_owner is not None or other_backup_owner is not None:
        raise AppError(409, "Ese correo ya no está disponible. Probá con otra dirección.")
    await _check_request_limits(db, user_id=user.id, target_email=target_email, request_ip=request_ip, now=now)
    await crud_backup_email.invalidate_open_challenges(db, user.id, now)
    await db.flush()
    _, code = await _make_challenge(
        db, user_id=user.id, target_email=target_email, request_ip=request_ip, now=now
    )
    await _send_code_or_rollback(db, user_id=user.id, target_email=target_email, request_ip=request_ip, code=code, now=now)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "No se pudo actualizar el desafío. Probá de nuevo.") from None

    await _audit(
        "backup_email_resent",
        user=user,
        request_ip=request_ip,
        method=method,
        path=path,
        detail="Se reenvió un código de verificación de correo de respaldo.",
    )
    return await read_state(db, user.id)


async def verify_backup_email_code(
    db: AsyncSession,
    *,
    user_id: int,
    code: str,
    request_ip: str,
    method: str,
    path: str,
) -> BackupEmailState:
    # Leer primero el destino candidato y después tomar los mismos bloqueos ordenados que usa
    # el cambio del correo principal. Esto evita una carrera que permitiría activar como respaldo
    # una dirección que acaba de convertirse en correo principal, y mantiene un orden de locks
    # consistente (email -> user) para prevenir interbloqueos.
    initial_pending = await db.scalar(
        select(BackupEmail).where(BackupEmail.user_id == user_id, BackupEmail.status == "PENDING")
    )
    if initial_pending is None:
        raise AppError(409, "No hay un correo pendiente de verificación.")
    target_email = initial_pending.email
    await _acquire_locks(
        db,
        [f"backup-email:email:{target_email}", f"backup-email:user:{user_id}"],
    )
    user = await _lock_user(db, user_id)
    rows = await _email_rows(db, user.id, for_update=True)
    pending = next((row for row in rows if row.status == "PENDING"), None)
    if pending is None or pending.email != target_email:
        raise AppError(409, "El correo pendiente cambió. Actualizá el estado e intentá de nuevo.")
    challenge = await crud_backup_email.get_pending_challenge(db, user.id, for_update=True)
    if challenge is None or challenge.target_email != pending.email:
        raise AppError(409, "No hay un código válido pendiente. Solicitá uno nuevo.")

    now = _now()
    if challenge.expires_at <= now:
        challenge.invalidated_at = now
        await db.commit()
        raise AppError(400, "El código venció. Solicitá uno nuevo.")
    if challenge.attempts >= settings.BACKUP_EMAIL_MAX_ATTEMPTS:
        challenge.invalidated_at = now
        await db.commit()
        raise AppError(429, "Se agotaron los intentos. Solicitá un código nuevo.")

    expected = code_digest(
        challenge_id=challenge.id,
        user_id=user.id,
        target_email=challenge.target_email,
        code=code,
    )
    if not hmac.compare_digest(challenge.code_hmac, expected):
        challenge.attempts += 1
        if challenge.attempts >= settings.BACKUP_EMAIL_MAX_ATTEMPTS:
            challenge.invalidated_at = now
            await db.commit()
            raise AppError(429, "Se agotaron los intentos. Solicitá un código nuevo.")
        await db.commit()  # persiste intentos incluso cuando el endpoint responde error
        raise AppError(400, "El código de verificación no es correcto.")

    # Revalidar la política de unicidad antes de activar el método.
    main_owner = await db.scalar(
        select(User.id).where(func.lower(User.email) == pending.email.lower()).limit(1)
    )
    if main_owner is not None:
        challenge.invalidated_at = now
        await db.commit()
        raise AppError(409, "Ese correo ahora coincide con un correo principal. Solicitá otro.")
    backup_owner = await db.scalar(
        select(BackupEmail.id)
        .where(
            BackupEmail.email == pending.email,
            BackupEmail.status == "VERIFIED",
            BackupEmail.user_id != user.id,
        )
        .limit(1)
    )
    if backup_owner is not None:
        challenge.invalidated_at = now
        await db.commit()
        raise AppError(409, "Ese correo ya no está disponible. Solicitá otro.")

    verified = next((row for row in rows if row.status == "VERIFIED"), None)
    action = "changed" if verified else "verified"
    if verified is not None:
        await db.delete(verified)
        await db.flush()  # libera el índice parcial antes de promocionar la fila pendiente
    pending.status = "VERIFIED"
    pending.verified_at = now
    challenge.consumed_at = now
    await crud_backup_email.invalidate_open_challenges(db, user.id, now)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "No se pudo verificar ese correo porque dejó de estar disponible.") from None

    await _audit(
        "backup_email_changed" if action == "changed" else "backup_email_verified",
        user=user,
        request_ip=request_ip,
        method=method,
        path=path,
        detail="Se confirmó un cambio del correo de respaldo." if action == "changed" else "Se verificó un correo de respaldo.",
    )
    await _notify_primary(user.email, action)
    return await read_state(db, user.id)


async def delete_backup_email(
    db: AsyncSession,
    *,
    user_id: int,
    current_password: str,
    request_ip: str,
    method: str,
    path: str,
) -> BackupEmailState:
    initial_rows = await _email_rows(db, user_id)
    if not initial_rows:
        raise AppError(409, "No hay un correo de respaldo para eliminar.")
    lock_keys = [f"backup-email:user:{user_id}"]
    lock_keys.extend(f"backup-email:email:{row.email}" for row in initial_rows)
    await _acquire_locks(db, lock_keys)
    user = await _lock_user(db, user_id)
    await _require_password(user, current_password)
    rows = await _email_rows(db, user.id, for_update=True)
    if not rows:
        raise AppError(409, "No hay un correo de respaldo para eliminar.")

    now = _now()
    await crud_backup_email.invalidate_open_challenges(db, user.id, now)
    for row in rows:
        await db.delete(row)
    await db.commit()

    await _audit(
        "backup_email_deleted",
        user=user,
        request_ip=request_ip,
        method=method,
        path=path,
        detail="Se eliminó el correo de respaldo y se invalidaron sus desafíos pendientes.",
    )
    await _notify_primary(user.email, "deleted")
    return await read_state(db, user.id)
