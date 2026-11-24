from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ProjectStatus = Literal["ACTIVE", "ARCHIVED"]
ProjectRole = Literal["SCRUM_MASTER", "PRODUCT_OWNER", "DEVELOPER", "OBSERVER"]
ItemType = Literal["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]
ItemStatus = Literal["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]
AssignedRole = Literal["SCRUM_MASTER", "PRODUCT_OWNER", "DEVELOPER"]
SprintStatus = Literal["PLANNED", "ACTIVE", "COMPLETED"]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    key: str = Field(min_length=2, max_length=10, pattern=r"^[A-Za-z][A-Za-z0-9]{1,9}$")
    name: str = Field(min_length=2, max_length=140)
    description: str = Field(default="", max_length=5000)
    sprint_length_weeks: int = Field(default=2, ge=1, le=4)

    @field_validator("key")
    @classmethod
    def uppercase_key(cls, value: str) -> str:
        return value.upper()


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=140)
    description: str | None = Field(default=None, max_length=5000)
    status: ProjectStatus | None = None
    sprint_length_weeks: int | None = Field(default=None, ge=1, le=4)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ProjectRead(BaseModel):
    id: int
    key: str
    name: str
    description: str
    status: ProjectStatus
    sprint_length_weeks: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    my_role: ProjectRole | Literal["ADMIN"]
    total_items: int = 0
    completed_items: int = 0
    active_sprint_name: str | None = None


class MemberCreate(BaseModel):
    user_id: int = Field(gt=0)
    role: ProjectRole


class MemberRead(BaseModel):
    id: int
    project_id: int
    user_id: int
    email: str
    full_name: str | None = None
    role: ProjectRole
    joined_at: datetime


class StaffOption(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    global_role: Literal["ADMIN", "TECHNICIAN"]


class WorkItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=10000)
    acceptance_criteria: str = Field(default="", max_length=10000)
    item_type: ItemType = "STORY"
    status: ItemStatus = "TODO"
    priority: Priority = "MEDIUM"
    assigned_role: AssignedRole | None = None
    estimate_points: int | None = Field(default=None, ge=0, le=1000)
    order_index: int = Field(default=0, ge=0, le=1000000)
    epic_id: int | None = Field(default=None, gt=0)
    assignee_id: int | None = Field(default=None, gt=0)
    sprint_id: int | None = Field(default=None, gt=0)
    due_date: date | None = None


class WorkItemUpdate(BaseModel):
    expected_updated_at: datetime | None = None
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=10000)
    acceptance_criteria: str | None = Field(default=None, max_length=10000)
    item_type: ItemType | None = None
    status: ItemStatus | None = None
    priority: Priority | None = None
    assigned_role: AssignedRole | None = None
    estimate_points: int | None = Field(default=None, ge=0, le=1000)
    order_index: int | None = Field(default=None, ge=0, le=1000000)
    epic_id: int | None = Field(default=None, gt=0)
    assignee_id: int | None = Field(default=None, gt=0)
    sprint_id: int | None = Field(default=None, gt=0)
    due_date: date | None = None

    @model_validator(mode="after")
    def required_columns(self):
        for field in ("title", "description", "acceptance_criteria", "item_type", "status", "priority", "order_index"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} no admite null")
        return self

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class WorkItemReorder(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=5000)

    @field_validator("item_ids")
    @classmethod
    def unique_item_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("La lista de tarjetas no puede contener identificadores duplicados.")
        if any(item_id <= 0 for item_id in value):
            raise ValueError("Los identificadores de las tarjetas deben ser positivos.")
        return value


class WorkItemRead(BaseModel):
    id: int
    project_id: int
    key: str
    title: str
    description: str
    acceptance_criteria: str
    item_type: ItemType
    status: ItemStatus
    priority: Priority
    assigned_role: AssignedRole | None = None
    estimate_points: int | None
    order_index: int
    epic_id: int | None
    epic_key: str | None = None
    epic_title: str | None = None
    assignee_id: int | None
    assignee_name: str | None = None
    assignee_email: str | None = None
    sprint_id: int | None
    sprint_name: str | None = None
    due_date: date | None
    created_by_id: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class SprintCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=120)
    goal: str = Field(default="", max_length=3000)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_date < self.start_date:
            raise ValueError("La fecha de finalización debe ser igual o posterior a la de inicio.")
        duration_days = (self.end_date - self.start_date).days + 1
        if duration_days not in {7, 14, 21, 28}:
            raise ValueError("Un sprint debe durar exactamente 1, 2, 3 o 4 semanas (7, 14, 21 o 28 días).")
        return self


class SprintRead(BaseModel):
    id: int
    project_id: int
    name: str
    goal: str
    start_date: date
    end_date: date
    status: SprintStatus
    created_by_id: int
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    total_items: int = 0
    completed_items: int = 0
    total_points: int = 0
    completed_points: int = 0


class SprintComplete(BaseModel):
    item_ids: list[int] | None = Field(default=None, max_length=5000)
    carry_over: bool = True
    next_sprint_id: int | None = Field(default=None, gt=0)


class ImportPreviewRow(BaseModel):
    row_number: int
    title: str
    item_type: str
    description: str = ""
    epic: str = ""
    priority: str = "MEDIUM"
    status: str = "TODO"
    points: int | None = None
    assigned_role: str = ""
    assignee_email: str = ""
    sprint: str = ""
    acceptance_criteria: str = ""
    due_date: date | None = None
    errors: list[str] = Field(default_factory=list)


class ImportPreview(BaseModel):
    digest: str
    duplicates: int = 0
    filename: str
    total_rows: int
    valid_rows: int
    error_rows: int
    rows: list[ImportPreviewRow]
    truncated: bool = False


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str] = []


class WorkItemHistoryRead(BaseModel):
    id: int
    work_item_id: int
    actor_id: int
    actor_name: str | None = None
    field_name: str
    old_value: str | None
    new_value: str | None
    created_at: datetime


class WorkItemCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class WorkItemCommentRead(BaseModel):
    id: int
    work_item_id: int
    author_id: int
    author_name: str | None = None
    author_email: str
    content: str
    created_at: datetime
    updated_at: datetime


class GoogleSheetImportRequest(BaseModel):
    url: str = Field(min_length=20, max_length=1000)
