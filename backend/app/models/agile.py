from datetime import date, datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AgileProject(TimestampMixin, Base):
    __tablename__ = "agile_projects"
    __table_args__ = (
        UniqueConstraint("key", name="uq_agile_projects_key"),
        CheckConstraint("sprint_length_weeks BETWEEN 1 AND 4", name="valid_sprint_length"),
        CheckConstraint("status IN ('ACTIVE', 'ARCHIVED')", name="valid_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE", server_default="ACTIVE")
    sprint_length_weeks: Mapped[int] = mapped_column(Integer, nullable=False, default=2, server_default="2")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)


class AgileMembership(Base):
    __tablename__ = "agile_memberships"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_agile_memberships_project_user"),
        CheckConstraint("role IN ('SCRUM_MASTER', 'PRODUCT_OWNER', 'DEVELOPER', 'OBSERVER')", name="valid_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("agile_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgileSprint(TimestampMixin, Base):
    __tablename__ = "agile_sprints"
    __table_args__ = (
        CheckConstraint("status IN ('PLANNED', 'ACTIVE', 'COMPLETED')", name="valid_status"),
        CheckConstraint("end_date >= start_date", name="valid_date_range"),
        Index("ix_agile_sprints_project_dates", "project_id", "start_date", "end_date"),
        Index("uq_agile_sprints_one_active_per_project", "project_id", unique=True, postgresql_where=text("status = 'ACTIVE'")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("agile_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PLANNED", server_default="PLANNED")
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgileWorkItem(TimestampMixin, Base):
    __tablename__ = "agile_work_items"
    __table_args__ = (
        UniqueConstraint("project_id", "key", name="uq_agile_work_items_project_key"),
        CheckConstraint("item_type IN ('EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK')", name="valid_item_type"),
        CheckConstraint("status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED')", name="valid_status"),
        CheckConstraint("priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')", name="valid_priority"),
        CheckConstraint("assigned_role IS NULL OR assigned_role IN ('SCRUM_MASTER', 'PRODUCT_OWNER', 'DEVELOPER')", name="valid_assigned_role"),
        CheckConstraint("estimate_points IS NULL OR estimate_points >= 0", name="nonnegative_estimate"),
        Index("ix_agile_work_items_project_status", "project_id", "status"),
        Index("ix_agile_work_items_project_sprint", "project_id", "sprint_id"),
        Index("ix_agile_work_items_project_epic", "project_id", "project_epic_id"),
        Index("ix_agile_work_items_project_type", "project_id", "item_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("agile_projects.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(24), nullable=False, default="PENDING")
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    acceptance_criteria: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    item_type: Mapped[str] = mapped_column(String(16), nullable=False, default="STORY", server_default="STORY")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="TODO", server_default="TODO")
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="MEDIUM", server_default="MEDIUM")
    assigned_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estimate_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    project_epic_id: Mapped[int | None] = mapped_column(ForeignKey("agile_work_items.id", ondelete="SET NULL"), nullable=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sprint_id: Mapped[int | None] = mapped_column(ForeignKey("agile_sprints.id", ondelete="SET NULL"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgileSprintItem(Base):
    """Preserva en qué sprints participó una HU/tarea aunque luego se traslade."""
    __tablename__ = "agile_sprint_items"
    __table_args__ = (UniqueConstraint("sprint_id", "work_item_id", name="uq_agile_sprint_items_sprint_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    sprint_id: Mapped[int] = mapped_column(ForeignKey("agile_sprints.id", ondelete="CASCADE"), nullable=False, index=True)
    work_item_id: Mapped[int] = mapped_column(ForeignKey("agile_work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    outcome: Mapped[str | None] = mapped_column(String(24), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgileWorkItemHistory(Base):
    __tablename__ = "agile_work_item_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("agile_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    work_item_id: Mapped[int] = mapped_column(ForeignKey("agile_work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    field_name: Mapped[str] = mapped_column(String(40), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class AgileWorkItemComment(Base):
    __tablename__ = "agile_work_item_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("agile_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    work_item_id: Mapped[int] = mapped_column(ForeignKey("agile_work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
