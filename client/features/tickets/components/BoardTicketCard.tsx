import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Label as TicketLabel, TicketSummary } from "../../../../shared/types";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";
import { formatDateTime } from "../utils";
import { priorityLabels, priorityVariantMap } from "../constants";
import { LabelChipGroup } from "./LabelChipGroup";

export function BoardTicketCard({
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: {
      status: ticket.status
    }
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform)
      }
    : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/5 transition",
        isSelected && "border-slate-900 ring-1 ring-slate-900",
        isDragging && "opacity-60"
      )}
      data-ticket-card=""
      data-ticket-status={ticket.status}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-2 p-4">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => onSelect(ticket.id)}
          type="button"
        >
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
        </button>
        <button
          aria-label={`Drag ${ticket.title}`}
          className="mt-0.5 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 touch-none"
          data-ticket-drag-handle=""
          data-ticket-status={ticket.status}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
