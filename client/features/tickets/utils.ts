import type {
  Label as TicketLabel,
  Project,
  ProjectInput,
  TicketDetail,
  TicketInput,
  TicketSortOption,
  TicketStatus,
  TicketSummary
} from "../../../shared/types";
import { activeProjectStorageKey } from "./constants";
import { boardColumnStatuses, priorityRank } from "./constants";
import type { BoardColumnStatus, TicketDraft, TicketViewMode } from "./types";

export function createEmptyDraft(): TicketDraft {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    labelIds: []
  };
}

export function createDraftFromTicket(ticket: TicketInput): TicketDraft {
  return {
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    labelIds: ticket.labelIds
  };
}

export function createProjectDraft(project?: Project): ProjectInput {
  return {
    name: project?.name ?? "",
    slug: project?.slug ?? ""
  };
}

export function readViewModeFromLocation(): TicketViewMode {
  if (typeof window === "undefined") {
    return "list";
  }

  const value = new URLSearchParams(window.location.search).get("view");
  return value === "board" ? "board" : "list";
}

export function syncViewModeToLocation(viewMode: TicketViewMode) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", viewMode);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function readStoredProjectSlug() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(activeProjectStorageKey) ?? "";
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function sortLabels(labels: TicketLabel[]) {
  return [...labels].sort((a, b) => a.name.localeCompare(b.name));
}

export function deriveSelectedSummary(tickets: TicketSummary[], ticketId: number | null) {
  return tickets.find((ticket) => ticket.id === ticketId) ?? null;
}

export function isBoardColumnStatus(status: TicketStatus | string): status is BoardColumnStatus {
  return boardColumnStatuses.includes(status as BoardColumnStatus);
}

export function sortTicketSummaries(
  tickets: TicketSummary[],
  sort: TicketSortOption
): TicketSummary[] {
  return [...tickets].sort((left, right) => {
    if (sort === "priority_desc") {
      return (
        priorityRank[right.priority] - priorityRank[left.priority] ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.id - left.id
      );
    }

    if (sort === "priority_asc") {
      return (
        priorityRank[left.priority] - priorityRank[right.priority] ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.id - left.id
      );
    }

    return right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id;
  });
}

export function createBoardGroups(tickets: TicketSummary[]) {
  const groups: Record<BoardColumnStatus, TicketSummary[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    done: []
  };

  for (const ticket of tickets) {
    if (isBoardColumnStatus(ticket.status)) {
      groups[ticket.status].push(ticket);
    }
  }

  return groups;
}

export function toTicketSummary(ticket: TicketDetail): TicketSummary {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    projectId: ticket.projectId,
    projectSlug: ticket.projectSlug,
    projectName: ticket.projectName,
    labelIds: ticket.labelIds
  };
}
