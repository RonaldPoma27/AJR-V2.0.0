from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class BackupEmail(Base):
    __tablename__ = "backup_emails"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class BackupEmailChallenge(Base):
    # One replaceable challenge per account; old digests are never retained.
    __tablename__ = "backup_email_challenges"
    __table_args__ = (CheckConstraint("attempts >= 0", name="nonnegative_attempts"),)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    purpose: Mapped[str] = mapped_column(String(30), default="backup_email_verify")
    nonce: Mapped[str] = mapped_column(String(32))
    code_digest: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)


class BackupEmailRateEvent(Base):
    __tablename__ = "backup_email_rate_events"
    __table_args__ = (Index("ix_backup_rate_key_time", "key", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
