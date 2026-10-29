"""Direcciones de correo de respaldo y desafíos de verificación."""
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin


class BackupEmail(CreatedAtMixin, Base):
    """Una dirección pendiente y, opcionalmente, una verificada por usuario.

    Los índices parciales de PostgreSQL permiten conservar la dirección verificada mientras se
    verifica una nueva. Solo las direcciones verificadas son únicas globalmente: una solicitud
    pendiente no puede reservar indefinidamente un correo que todavía no demostró controlar.
    """

    __tablename__ = "backup_emails"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'VERIFIED')", name="valid_status"),
        Index(
            "uq_backup_emails_one_pending_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "uq_backup_emails_one_verified_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'VERIFIED'"),
        ),
        Index("ix_backup_emails_user_status", "user_id", "status"),
        # Una solicitud pendiente no reserva globalmente la dirección: evita que un tercero
        # bloquee indefinidamente un correo sin demostrar control de la bandeja.
        Index(
            "uq_backup_emails_verified_email",
            "email",
            unique=True,
            postgresql_where=text("status = 'VERIFIED'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="PENDING", server_default="PENDING"
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BackupEmailChallenge(CreatedAtMixin, Base):
    """Desafío de uso único. Solo guarda HMAC del código, nunca el código en claro."""

    __tablename__ = "backup_email_challenges"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="nonnegative_attempts"),
        Index("ix_backup_email_challenges_user_created", "user_id", "created_at"),
        Index("ix_backup_email_challenges_target_created", "target_email", "created_at"),
        Index("ix_backup_email_challenges_ip_created", "request_ip", "created_at"),
        Index(
            "ix_backup_email_challenges_user_active",
            "user_id",
            "purpose",
            "consumed_at",
            "invalidated_at",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_email: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(
        String(32), nullable=False, default="VERIFY_BACKUP_EMAIL", server_default="VERIFY_BACKUP_EMAIL"
    )
    code_hmac: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    request_ip: Mapped[str] = mapped_column(String(64), nullable=False)
