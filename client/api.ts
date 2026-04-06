import type { Label, LabelInput, Ticket, TicketInput, TicketQuery, TicketSummary } from "../shared/types";

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

export function fetchTicket(id: number) {
  return request<Ticket>(`/api/tickets/${id}`);
}

export function createTicket(input: TicketInput) {
  return request<Ticket>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateTicket(id: number, input: TicketInput) {
  return request<Ticket>(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteTicket(id: number) {
  return request<void>(`/api/tickets/${id}`, {
    method: "DELETE"
  });
}
