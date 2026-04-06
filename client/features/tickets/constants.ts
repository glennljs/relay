import type { BadgeProps } from "../../components/ui/badge";
import type { TicketPriority, TicketSortOption, TicketStatus } from "../../../shared/types";
import type { BoardColumnStatus } from "./types";

export const boardColumnStatuses: readonly BoardColumnStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done"
] as const;

export const noteAuthorTone: Record<"user" | "agent" | "system", string> = {
  user: "bg-sky-100 text-sky-800",
  agent: "bg-amber-100 text-amber-900",
  system: "bg-slate-200 text-slate-700"
};

export const statusLabels: Record<TicketStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled"
};

export const priorityLabels: Record<TicketPriority, string> = {
  none: "No Priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent"
};

export const ticketSortLabels: Record<TicketSortOption, string> = {
  updated_desc: "Recently updated",
  priority_desc: "Priority: high to low",
  priority_asc: "Priority: low to high"
};

export const priorityVariantMap: Record<TicketPriority, BadgeProps["variant"]> = {
  none: "outline",
  low: "secondary",
  medium: "secondary",
  high: "default",
  urgent: "destructive"
};

export const quickFilterPresets: Array<{ label: string; value: TicketStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Backlog", value: "backlog" },
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" }
];

export const priorityQuickFilterPresets: Array<{ label: string; value: TicketPriority | "" }> = [
  { label: "All priorities", value: "" },
  { label: "Urgent", value: "urgent" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "No Priority", value: "none" }
];

export const priorityRank: Record<TicketPriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

export const activeProjectStorageKey = "relay.activeProjectSlug";
export const defaultProjectSlug = "default";
export const projectManagerActionValue = "__project_manager__";
export const newProjectConfigValue = "__new_project__";
