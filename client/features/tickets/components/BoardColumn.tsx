import { useDroppable } from "@dnd-kit/core";
import type { Label as TicketLabel, TicketSummary } from "../../../../shared/types";
import { cn } from "../../../lib/utils";
import type { BoardColumnStatus } from "../types";
import { statusLabels } from "../constants";
import { BoardTicketCard } from "./BoardTicketCard";

export function BoardColumn({
  status,
  tickets,
  selectedId,
  labelMap,
  onSelect
}: {
  status: BoardColumnStatus;
  tickets: TicketSummary[];
  selectedId: number | "new" | null;
  labelMap: Record<number, TicketLabel>;
  onSelect: (ticketId: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: status
  });

  return (
    <section
      aria-labelledby={`board-column-${status}`}
      className="flex min-h-[480px] w-[280px] flex-col rounded-2xl border border-slate-200 bg-slate-100/70"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900" id={`board-column-${status}`}>
          {statusLabels[status]}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
          {tickets.length}
        </span>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 p-3 transition-colors",
          isOver && "bg-slate-200/70"
        )}
        data-board-column={status}
        ref={setNodeRef}
      >
        {tickets.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 text-center text-sm text-slate-400">
            Drop a ticket here
          </div>
        ) : (
          tickets.map((ticket) => (
            <BoardTicketCard
              isSelected={selectedId === ticket.id}
              key={ticket.id}
              labelMap={labelMap}
              onSelect={onSelect}
              ticket={ticket}
            />
          ))
        )}
      </div>
    </section>
  );
}
