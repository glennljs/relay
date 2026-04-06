import type { Label as TicketLabel, TicketSummary } from "../../../../shared/types";
import { Badge } from "../../../components/ui/badge";
import { formatDateTime } from "../utils";
import { priorityLabels, priorityVariantMap } from "../constants";
import { LabelChipGroup } from "./LabelChipGroup";

export function BoardTicketOverlay({
  ticket,
  labelMap
}: {
  ticket: TicketSummary;
  labelMap: Record<number, TicketLabel>;
}) {
  return (
    <div className="w-[280px] rounded-xl border border-slate-300 bg-white p-4 shadow-xl shadow-slate-950/15">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {ticket.ticketNumber}
      </div>
      <h2 className="mt-1 text-sm font-semibold leading-5 text-slate-900">{ticket.title}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant={priorityVariantMap[ticket.priority]}>
          {priorityLabels[ticket.priority]}
        </Badge>
        <span>{ticket.projectName}</span>
        <span>Updated {formatDateTime(ticket.updatedAt)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <LabelChipGroup labelIds={ticket.labelIds} labelMap={labelMap} />
      </div>
    </div>
  );
}
