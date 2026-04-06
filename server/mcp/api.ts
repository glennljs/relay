import {
  type Label,
  type Project,
  type TicketActorType,
  type TicketDetail,
  type TicketNote,
  type TicketPriority,
  type TicketSortOption,
  type TicketStatus,
  type TicketSummary
} from "../../shared/types.js";

export interface RelayMcpClientOptions {
  apiBaseUrl?: string;
}

export interface RelayTicketFilters {
  project?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  sort?: TicketSortOption;
  label?: number;
  q?: string;
  source?: string;
  externalRef?: string;
}

export interface RelayCreateTicketInput {
  project: string;
  title: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  labelIds?: number[];
  source?: string;
  externalRef?: string;
  note?: string;
  actorName?: string;
}

export interface RelayUpdateTicketInput {
  id: number;
  project?: string;
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  labelIds?: number[];
  note?: string;
  actorName?: string;
}

export interface RelayGetTicketInput {
  id: number;
  project?: string;
}

export interface RelayAddTicketNoteInput {
  id: number;
  project?: string;
  body: string;
  authorName?: string;
  authorType?: TicketActorType;
}

export interface RelayDeleteTicketInput {
  id: number;
  project?: string;
}

export interface RelayCreateTicketResult {
  created: boolean;
  ticket: TicketDetail;
}

function normalizeApiBaseUrl(value?: string) {
  const rawValue = value?.trim() || "http://127.0.0.1:3000/api/public/v1";
  const url = new URL(rawValue);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/" || pathname === "") {
    url.pathname = "/api/public/v1";
  } else if (pathname === "/api") {
    url.pathname = "/api/public/v1";
  } else if (pathname === "/api/public") {
    url.pathname = "/api/public/v1";
  } else if (!pathname.startsWith("/api/public/v1")) {
    url.pathname = `${pathname}/api/public/v1`.replace(/\/{2,}/g, "/");
  } else {
    url.pathname = pathname;
  }

  return url.toString().replace(/\/$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${baseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

async function requestJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      payload?.message ?? `Relay API request failed with ${response.status} for ${url.toString()}.`
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    throw new Error(
      `Relay API returned ${contentType || "non-JSON content"} for ${url.toString()}: ${body.slice(0, 120)}`
    );
  }

  return (await response.json()) as T;
}

async function requestVoid(url: URL, init?: RequestInit): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      payload?.message ?? `Relay API request failed with ${response.status} for ${url.toString()}.`
    );
  }
}

export function createRelayMcpClient(options: RelayMcpClientOptions = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  const appBaseUrl = new URL(apiBaseUrl);
  appBaseUrl.pathname = appBaseUrl.pathname.replace(/\/public\/v1$/, "");

  return {
    get apiBaseUrl() {
      return apiBaseUrl;
    },

    async listProjects(): Promise<Project[]> {
      return requestJson<Project[]>(buildUrl(apiBaseUrl, "/projects"));
    },

    async listLabels(): Promise<Label[]> {
      return requestJson<Label[]>(buildUrl(appBaseUrl.toString().replace(/\/$/, ""), "/labels"));
    },

    async listTickets(filters: RelayTicketFilters = {}): Promise<TicketSummary[]> {
      return requestJson<TicketSummary[]>(
        buildUrl(apiBaseUrl, "/tickets", {
          project: filters.project,
          status: filters.status,
          priority: filters.priority,
          sort: filters.sort,
          label: filters.label,
          q: filters.q,
          source: filters.source,
          externalRef: filters.externalRef
        })
      );
    },

    async getTicket(input: number | RelayGetTicketInput): Promise<TicketDetail> {
      const ticket = typeof input === "number" ? { id: input } : input;
      return requestJson<TicketDetail>(
        buildUrl(apiBaseUrl, `/tickets/${ticket.id}`, { project: ticket.project })
      );
    },

    async createTicket(input: RelayCreateTicketInput): Promise<RelayCreateTicketResult> {
      return requestJson<RelayCreateTicketResult>(buildUrl(apiBaseUrl, "/tickets"), {
        method: "POST",
        body: JSON.stringify(input)
      });
    },

    async updateTicket(input: RelayUpdateTicketInput): Promise<TicketDetail> {
      const { id, project, ...payload } = input;
      return requestJson<TicketDetail>(buildUrl(apiBaseUrl, `/tickets/${id}`, { project }), {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    },

    async addTicketNote(input: RelayAddTicketNoteInput): Promise<TicketNote> {
      const { id, project, ...payload } = input;
      return requestJson<TicketNote>(
        buildUrl(apiBaseUrl, `/tickets/${id}/notes`, { project }),
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
    },

    async deleteTicket(input: number | RelayDeleteTicketInput): Promise<void> {
      const ticket = typeof input === "number" ? { id: input } : input;
      await requestVoid(buildUrl(apiBaseUrl, `/tickets/${ticket.id}`, { project: ticket.project }), {
        method: "DELETE"
      });
    }
  };
}
