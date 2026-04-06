import type {
  Label,
  LabelInput,
  Project,
  ProjectInput,
  TicketDetail,
  TicketInput,
  TicketPatchInput,
  TicketNote,
  TicketNoteInput,
  TicketQuery,
  TicketSummary
} from "../shared/types";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; issues?: string[] }
      | null;
    throw new Error(payload?.message ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function createQueryString(query: TicketQuery) {
  const params = new URLSearchParams();

  if (query.project) {
    params.set("project", query.project);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.priority) {
    params.set("priority", query.priority);
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }
  if (query.label) {
    params.set("label", String(query.label));
  }
  if (query.q) {
    params.set("q", query.q);
  }

  const value = params.toString();
  return value ? `?${value}` : "";
}

function createProjectGuard(project?: string) {
  if (!project) {
    return "";
  }

  const params = new URLSearchParams({ project });
  return `?${params.toString()}`;
}

export function fetchProjects() {
  return request<Project[]>("/api/projects");
}

export function createProject(input: ProjectInput) {
  return request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateProject(id: number, input: ProjectInput) {
  return request<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function fetchLabels() {
  return request<Label[]>("/api/labels");
}

export function createLabel(input: LabelInput) {
  return request<Label>("/api/labels", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateLabel(id: number, input: LabelInput) {
  return request<Label>(`/api/labels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteLabel(id: number) {
  return request<void>(`/api/labels/${id}`, {
    method: "DELETE"
  });
}

export function fetchTickets(query: TicketQuery) {
  return request<TicketSummary[]>(`/api/tickets${createQueryString(query)}`);
}

export function fetchTicket(id: number, project?: string) {
  return request<TicketDetail>(`/api/tickets/${id}${createProjectGuard(project)}`);
}

export function createTicket(input: TicketInput & { project: string }) {
  return request<TicketDetail>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateTicket(id: number, input: TicketPatchInput, project?: string) {
  return request<TicketDetail>(`/api/tickets/${id}${createProjectGuard(project)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteTicket(id: number, project?: string) {
  return request<void>(`/api/tickets/${id}${createProjectGuard(project)}`, {
    method: "DELETE"
  });
}

export function createTicketNote(id: number, input: TicketNoteInput, project?: string) {
  return request<TicketNote>(`/api/tickets/${id}/notes${createProjectGuard(project)}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
