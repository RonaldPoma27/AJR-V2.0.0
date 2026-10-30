import { apiClient } from "./client";

export type ProjectRole =
  "ADMIN" | "SCRUM_MASTER" | "PRODUCT_OWNER" | "DEVELOPER" | "OBSERVER";
export type AgileAssignedRole = Exclude<ProjectRole, "ADMIN" | "OBSERVER">;
export type ItemType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";
export type ItemStatus =
  "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
export type ItemPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export interface AgileProject {
  id: number;
  key: string;
  name: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED";
  sprint_length_weeks: number;
  owner_id: number;
  created_at: string;
  updated_at: string;
  my_role: ProjectRole;
  total_items: number;
  completed_items: number;
  active_sprint_name: string | null;
}

export interface AgileMember {
  id: number;
  project_id: number;
  user_id: number;
  email: string;
  full_name: string | null;
  role: Exclude<ProjectRole, "ADMIN">;
  joined_at: string;
}

export interface StaffOption {
  id: number;
  email: string;
  full_name: string | null;
  global_role: "ADMIN" | "TECHNICIAN";
}

export interface AgileItem {
  id: number;
  project_id: number;
  key: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  item_type: ItemType;
  status: ItemStatus;
  priority: ItemPriority;
  assigned_role: AgileAssignedRole | null;
  estimate_points: number | null;
  order_index: number;
  epic_id: number | null;
  epic_key: string | null;
  epic_title: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_email: string | null;
  sprint_id: number | null;
  sprint_name: string | null;
  due_date: string | null;
  created_by_id: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AgileSprint {
  id: number;
  project_id: number;
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_by_id: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  total_items: number;
  completed_items: number;
  total_points: number;
  completed_points: number;
}

export interface AgileItemInput {
  expected_updated_at?: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  item_type: ItemType;
  status: ItemStatus;
  priority: ItemPriority;
  assigned_role: AgileAssignedRole | null;
  estimate_points: number | null;
  order_index?: number;
  epic_id: number | null;
  assignee_id: number | null;
  sprint_id: number | null;
  due_date: string | null;
}

export interface ImportPreview {
  digest: string;
  duplicates: number;
  filename: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  rows: Array<{
    row_number: number;
    title: string;
    item_type: string;
    description: string;
    epic: string;
    priority: string;
    status: string;
    points: number | null;
    assigned_role: string;
    assignee_email: string;
    sprint: string;
    acceptance_criteria: string;
    errors: string[];
  }>;
  truncated: boolean;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface AgileComment {
  id: number;
  work_item_id: number;
  author_id: number;
  author_name: string | null;
  author_email: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AgileHistory {
  id: number;
  work_item_id: number;
  actor_id: number;
  actor_name: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const base = (projectId: number) => `/agile/projects/${projectId}`;

export async function fetchAgileProjects() {
  const projects: AgileProject[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = (
      await apiClient.get<AgileProject[]>("/agile/projects", {
        params: { limit: 100, offset },
      })
    ).data;
    projects.push(...page);
    if (page.length < 100) return projects;
  }
}
export async function createAgileProject(payload: {
  key: string;
  name: string;
  description: string;
  sprint_length_weeks: number;
}) {
  return (await apiClient.post<AgileProject>("/agile/projects", payload)).data;
}
export async function updateAgileProject(
  projectId: number,
  payload: Partial<
    Pick<
      AgileProject,
      "name" | "description" | "status" | "sprint_length_weeks"
    >
  >,
) {
  return (await apiClient.patch<AgileProject>(base(projectId), payload)).data;
}
export async function fetchAgileItems(projectId: number) {
  const items: AgileItem[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = (
      await apiClient.get<AgileItem[]>(`${base(projectId)}/items`, {
        params: { limit: 500, offset },
      })
    ).data;
    items.push(...page);
    if (page.length < 500) return items;
  }
}
export async function reorderAgileBacklog(
  projectId: number,
  item_ids: number[],
) {
  return (
    await apiClient.post<AgileItem[]>(`${base(projectId)}/backlog/reorder`, {
      item_ids,
    })
  ).data;
}
export async function createAgileItem(
  projectId: number,
  payload: AgileItemInput,
) {
  return (await apiClient.post<AgileItem>(`${base(projectId)}/items`, payload))
    .data;
}
export async function updateAgileItem(
  projectId: number,
  itemId: number,
  payload: Partial<AgileItemInput>,
) {
  return (
    await apiClient.patch<AgileItem>(
      `${base(projectId)}/items/${itemId}`,
      payload,
    )
  ).data;
}
export async function archiveAgileItem(projectId: number, itemId: number) {
  await apiClient.delete(`${base(projectId)}/items/${itemId}`);
}
export async function fetchAgileSprints(projectId: number) {
  return (await apiClient.get<AgileSprint[]>(`${base(projectId)}/sprints`))
    .data;
}
export async function createAgileSprint(
  projectId: number,
  payload: { name: string; goal: string; start_date: string; end_date: string },
) {
  return (
    await apiClient.post<AgileSprint>(`${base(projectId)}/sprints`, payload)
  ).data;
}
export async function startAgileSprint(projectId: number, sprintId: number) {
  return (
    await apiClient.post<AgileSprint>(
      `${base(projectId)}/sprints/${sprintId}/start`,
    )
  ).data;
}
export async function completeAgileSprint(
  projectId: number,
  sprintId: number,
  carry_over: boolean,
  next_sprint_id?: number | null,
  item_ids?: number[],
) {
  return (
    await apiClient.post<{
      completed_sprint: AgileSprint;
      next_sprint: AgileSprint | null;
      completed_items: number;
      carried_over: number;
      returned_to_backlog: number;
    }>(`${base(projectId)}/sprints/${sprintId}/complete`, {
      carry_over,
      next_sprint_id: next_sprint_id ?? null,
      item_ids,
    })
  ).data;
}
export async function fetchAgileMembers(projectId: number) {
  return (await apiClient.get<AgileMember[]>(`${base(projectId)}/members`))
    .data;
}
export async function fetchAgileStaff() {
  return (await apiClient.get<StaffOption[]>("/agile/users")).data;
}
export async function upsertAgileMember(
  projectId: number,
  user_id: number,
  role: AgileMember["role"],
) {
  return (
    await apiClient.post<AgileMember>(`${base(projectId)}/members`, {
      user_id,
      role,
    })
  ).data;
}
export async function removeAgileMember(projectId: number, memberId: number) {
  await apiClient.delete(`${base(projectId)}/members/${memberId}`);
}
export async function previewAgileImport(
  projectId: number,
  file: File,
  mapping: Record<string, number> = {},
) {
  const form = new FormData();
  form.append("file", file);
  return (
    await apiClient.post<ImportPreview>(
      `${base(projectId)}/imports/preview`,
      form,
      { params: { column_mapping: JSON.stringify(mapping) } },
    )
  ).data;
}
export async function commitAgileImport(
  projectId: number,
  file: File,
  duplicate_strategy: "skip" | "update",
  digest: string,
  mapping: Record<string, number> = {},
) {
  const form = new FormData();
  form.append("file", file);
  return (
    await apiClient.post<ImportResult>(
      `${base(projectId)}/imports/commit`,
      form,
      {
        params: {
          duplicate_strategy,
          expected_digest: digest,
          column_mapping: JSON.stringify(mapping),
        },
      },
    )
  ).data;
}
export async function fetchAgileComments(projectId: number, itemId: number) {
  return (
    await apiClient.get<AgileComment[]>(
      `${base(projectId)}/items/${itemId}/comments`,
    )
  ).data;
}
export async function addAgileComment(
  projectId: number,
  itemId: number,
  content: string,
) {
  return (
    await apiClient.post<AgileComment>(
      `${base(projectId)}/items/${itemId}/comments`,
      { content },
    )
  ).data;
}
export async function fetchAgileHistory(projectId: number, itemId: number) {
  return (
    await apiClient.get<AgileHistory[]>(
      `${base(projectId)}/items/${itemId}/history`,
    )
  ).data;
}

export async function previewAgileGoogleImport(
  projectId: number,
  url: string,
  mapping: Record<string, number> = {},
) {
  return (
    await apiClient.post<ImportPreview>(
      `${base(projectId)}/imports/google/preview`,
      { url },
      { params: { column_mapping: JSON.stringify(mapping) } },
    )
  ).data;
}
export async function commitAgileGoogleImport(
  projectId: number,
  url: string,
  duplicate_strategy: "skip" | "update",
  digest: string,
  mapping: Record<string, number> = {},
) {
  return (
    await apiClient.post<ImportResult>(
      `${base(projectId)}/imports/google/commit`,
      { url },
      {
        params: {
          duplicate_strategy,
          expected_digest: digest,
          column_mapping: JSON.stringify(mapping),
        },
      },
    )
  ).data;
}

export async function editAgileSprint(
  projectId: number,
  sprintId: number,
  payload: { name: string; goal: string; start_date: string; end_date: string },
) {
  return (
    await apiClient.patch<AgileSprint>(
      `${base(projectId)}/sprints/${sprintId}`,
      payload,
    )
  ).data;
}
