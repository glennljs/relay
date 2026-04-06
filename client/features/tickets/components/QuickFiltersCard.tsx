import type { Label as TicketLabel, TicketStatus, TicketSummary } from "../../../../shared/types";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";
import { priorityQuickFilterPresets, quickFilterPresets } from "../constants";
import type { TicketFilters } from "../types";

export function QuickFiltersCard({
  filters,
  tickets,
  statusCounts,
  labels,
  onUpdateFilters
}: {
  filters: TicketFilters;
  tickets: TicketSummary[];
  statusCounts: Record<TicketStatus, number>;
  labels: TicketLabel[];
  onUpdateFilters: (partial: Partial<TicketFilters>) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Quick Filters</CardTitle>
        <CardDescription>Jump by status, priority, or label.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Status
          </div>
          {quickFilterPresets.map((preset) => {
            const isActive = filters.status === preset.value;
            const count = preset.value === "" ? tickets.length : statusCounts[preset.value];

            return (
              <button
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                key={preset.label}
                onClick={() => onUpdateFilters({ status: preset.value })}
                type="button"
              >
                <span>{preset.label}</span>
                <Badge
                  className={cn(isActive && "border-white/60 bg-white/5 text-white")}
                  variant="outline"
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Priority
          </div>
          <div className="space-y-2">
            {priorityQuickFilterPresets.map((preset) => (
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  filters.priority === preset.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                key={preset.label}
                onClick={() => onUpdateFilters({ priority: preset.value })}
                type="button"
              >
                {preset.value ? (
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      preset.value === "urgent" && "bg-red-500",
                      preset.value === "high" && "bg-slate-900",
                      preset.value === "medium" && "bg-amber-500",
                      preset.value === "low" && "bg-sky-500",
                      preset.value === "none" && "bg-slate-300"
                    )}
                  />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border border-slate-300" />
                )}
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Labels
          </div>
          <div className="space-y-2">
            <button
              className={cn(
                "flex w-full items-center rounded-md border px-3 py-2 text-sm transition-colors",
                filters.label === null
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
              onClick={() => onUpdateFilters({ label: null })}
              type="button"
            >
              All labels
            </button>
            {labels.map((label) => (
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  filters.label === label.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                key={label.id}
                onClick={() => onUpdateFilters({ label: label.id })}
                type="button"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                {label.name}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
