import type { Label as TicketLabel, TicketSummary } from "../../../../shared/types";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";
import { formatDateTime } from "../utils";
import { priorityLabels, priorityVariantMap, statusLabels } from "../constants";
import { LabelChipGroup } from "./LabelChipGroup";

export function TicketListRow({
  ticket,
  isSelected,
  labelMap,
  onSelect
}: {
  ticket: TicketSummary;
  isSelected: boolean;
  labelMap: Record<number, TicketLabel>;
  onSelect: (ticketId: number) => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50",
        isSelected && "bg-slate-100"
      )}
      onClick={() => onSelect(ticket.id)}
      type="button"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {ticket.ticketNumber}
          </div>
          <h2 className="truncate text-sm font-medium text-slate-900">{ticket.title}</h2>
        </div>
        <Badge variant={priorityVariantMap[ticket.priority]}>
          {priorityLabels[ticket.priority]}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="outline">{statusLabels[ticket.status]}</Badge>
        <span>{ticket.projectName}</span>
        <span>Updated {formatDateTime(ticket.updatedAt)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <LabelChipGroup labelIds={ticket.labelIds} labelMap={labelMap} />
      </div>
    </button>
  );
}
