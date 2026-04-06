import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { Search, Ticket as TicketIcon } from "lucide-react";
import type { Label as TicketLabel, Project, TicketPriority, TicketSortOption, TicketStatus, TicketSummary } from "../../../../shared/types";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../../components/ui/select";
import { cn } from "../../../lib/utils";
import {
  boardColumnStatuses,
  priorityLabels,
  statusLabels,
  ticketSortLabels
} from "../constants";
import type { BoardColumnStatus, TicketFilters, TicketViewMode } from "../types";
import { BoardColumn } from "./BoardColumn";
import { BoardTicketOverlay } from "./BoardTicketOverlay";
import { TicketListRow } from "./TicketListRow";
import { ticketPriorities, ticketSortOptions, ticketStatuses } from "../../../../shared/types";

export function TicketsCard({
  activeProject,
  listLoading,
  filters,
  viewMode,
  visibleTicketCount,
  visibleTickets,
  boardShowingCanceledEmptyState,
  boardTickets,
  boardColumns,
  activeDragTicket,
  selectedId,
  labelMap,
  onUpdateFilters,
  onViewModeChange,
  onSelectTicket,
  onDragStart,
  onDragEnd,
  onDragCancel
}: {
  activeProject: Project | null;
  listLoading: boolean;
  filters: TicketFilters;
  viewMode: TicketViewMode;
  visibleTicketCount: number;
  visibleTickets: TicketSummary[];
  boardShowingCanceledEmptyState: boolean;
  boardTickets: TicketSummary[];
  boardColumns: Record<BoardColumnStatus, TicketSummary[]>;
  activeDragTicket: TicketSummary | null;
  selectedId: number | "new" | null;
  labelMap: Record<number, TicketLabel>;
  onUpdateFilters: (partial: Partial<TicketFilters>) => void;
  onViewModeChange: (value: TicketViewMode) => void;
  onSelectTicket: (ticketId: number) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor)
  );

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Tickets</CardTitle>
              <CardDescription>
                {activeProject
                  ? `${visibleTicketCount} visible items in ${activeProject.name}`
                  : "Select or create a project to begin."}
              </CardDescription>
            </div>
            <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
              <Button
                onClick={() => onViewModeChange("list")}
                size="sm"
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
              >
                List
              </Button>
              <Button
                onClick={() => onViewModeChange("board")}
                size="sm"
                type="button"
                variant={viewMode === "board" ? "default" : "ghost"}
              >
                Board
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-[1.6_1_260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Search tickets"
                className="pl-9"
                onChange={(event) => onUpdateFilters({ q: event.target.value })}
                placeholder="Search tickets"
                value={filters.q}
              />
            </div>
            <Select
              onValueChange={(value) =>
                onUpdateFilters({ status: value === "all" ? "" : (value as TicketStatus) })
              }
              value={filters.status || "all"}
            >
              <SelectTrigger aria-label="Filter by status" className="min-w-[160px] flex-1">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ticketStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) =>
                onUpdateFilters({
                  priority: value === "all" ? "" : (value as TicketPriority)
                })
              }
              value={filters.priority || "all"}
            >
              <SelectTrigger aria-label="Filter by priority" className="min-w-[160px] flex-1">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {ticketPriorities.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priorityLabels[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => onUpdateFilters({ sort: value as TicketSortOption })}
              value={filters.sort}
            >
              <SelectTrigger aria-label="Sort tickets" className="min-w-[180px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ticketSortOptions.map((sortOption) => (
                  <SelectItem key={sortOption} value={sortOption}>
                    {ticketSortLabels[sortOption]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("p-0", viewMode === "board" && "min-h-[540px]")}>
        {!activeProject ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
            <TicketIcon className="h-5 w-5 text-slate-300" />
            <div className="text-sm font-medium text-slate-700">No active project selected.</div>
            <div className="text-sm text-slate-500">Create a project or pick one from the header.</div>
          </div>
        ) : listLoading ? (
          <div className="flex min-h-60 items-center justify-center text-sm text-slate-500">
            Loading tickets...
          </div>
        ) : viewMode === "list" ? (
          visibleTickets.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-center">
              <TicketIcon className="h-5 w-5 text-slate-300" />
              <div className="text-sm font-medium text-slate-700">No tickets match these filters.</div>
              <div className="text-sm text-slate-500">Create a ticket or widen the search.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleTickets.map((ticket) => (
                <TicketListRow
                  isSelected={selectedId === ticket.id}
                  key={ticket.id}
                  labelMap={labelMap}
                  onSelect={onSelectTicket}
                  ticket={ticket}
                />
              ))}
            </div>
          )
        ) : boardShowingCanceledEmptyState ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
            <TicketIcon className="h-6 w-6 text-slate-300" />
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">
                Canceled tickets stay in the list view.
              </div>
              <div className="text-sm text-slate-500">
                Clear the canceled status filter or switch back to the list to view them.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => onUpdateFilters({ status: "" })} type="button" variant="outline">
                Clear status filter
              </Button>
              <Button onClick={() => onViewModeChange("list")} type="button">
                Switch to list
              </Button>
            </div>
          </div>
        ) : boardTickets.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-center">
            <TicketIcon className="h-5 w-5 text-slate-300" />
            <div className="text-sm font-medium text-slate-700">No tickets match these filters.</div>
            <div className="text-sm text-slate-500">Create a ticket or widen the search.</div>
          </div>
        ) : (
          <DndContext
            collisionDetection={closestCorners}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            sensors={sensors}
          >
            <div className="overflow-x-auto p-4">
              <div className="flex min-w-max gap-4">
                {boardColumnStatuses.map((status) => (
                  <BoardColumn
                    key={status}
                    labelMap={labelMap}
                    onSelect={onSelectTicket}
                    selectedId={selectedId}
                    status={status}
                    tickets={boardColumns[status]}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeDragTicket ? (
                <BoardTicketOverlay labelMap={labelMap} ticket={activeDragTicket} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
