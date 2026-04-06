export const ticketStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled"
] as const;

export const ticketPriorities = [
  "none",
  "low",
  "medium",
  "high",
  "urgent"
] as const;

export const ticketSortOptions = [
  "updated_desc",
  "priority_desc",
  "priority_asc"
] as const;

export const ticketActorTypes = ["user", "agent", "system"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];
export type TicketSortOption = (typeof ticketSortOptions)[number];
export type TicketActorType = (typeof ticketActorTypes)[number];

export interface Project {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  slug?: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  updatedAt: string;
  createdAt: string;
  projectId: number;
  projectSlug: string;
  projectName: string;
  labelIds: number[];
}

export interface Ticket extends TicketSummary {
  description: string;
}

export interface TicketNote {
  id: number;
  ticketId: number;
  body: string;
  authorName: string;
  authorType: TicketActorType;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  source: string;
  externalRef: string | null;
  notes: TicketNote[];
}

export interface TicketNoteInput {
  body: string;
  authorName?: string;
  authorType?: TicketActorType;
}

export interface TicketInput {
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  labelIds: number[];
}

export interface TicketPatchInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  labelIds?: number[];
}

export interface LabelInput {
  name: string;
  color: string;
}

export interface TicketQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  sort?: TicketSortOption;
  label?: number;
  q?: string;
  project?: string;
  source?: string;
  externalRef?: string;
}
