import type { TicketInput, TicketPriority, TicketSortOption, TicketStatus } from "../../../shared/types";

export interface TicketFilters {
  status: TicketStatus | "";
  priority: TicketPriority | "";
  sort: TicketSortOption;
  label: number | null;
  q: string;
}

export type TicketDraft = TicketInput;
export type TicketViewMode = "list" | "board";
export type BoardColumnStatus = Exclude<TicketStatus, "canceled">;
