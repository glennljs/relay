import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Tag,
  Ticket as TicketIcon,
  Trash2,
  X
} from "lucide-react";
import {
  createLabel,
  createTicket,
  deleteLabel,
  deleteTicket,
  fetchLabels,
  fetchTicket,
  fetchTickets,
  updateLabel,
  updateTicket
} from "./api";
import {
  ticketSortOptions,
  ticketPriorities,
  ticketStatuses,
  type Label as TicketLabel,
  type LabelInput,
  type Ticket,
  type TicketInput,
  type TicketPriority,
  type TicketSortOption,
  type TicketStatus,
  type TicketSummary
} from "../shared/types";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Checkbox } from "./components/ui/checkbox";
import { cn } from "./lib/utils";

interface TicketFilters {
  status: TicketStatus | "";
  priority: TicketPriority | "";
  sort: TicketSortOption;
  label: number | null;
  q: string;
}

interface TicketDraft extends TicketInput {}

const statusLabels: Record<TicketStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled"
};

const priorityLabels: Record<TicketPriority, string> = {
  none: "No Priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent"
};

const ticketSortLabels: Record<TicketSortOption, string> = {
  updated_desc: "Recently updated",
  priority_desc: "Priority: high to low",
  priority_asc: "Priority: low to high"
};

const priorityVariantMap: Record<
  TicketPriority,
  "outline" | "secondary" | "default" | "destructive"
> = {
  none: "outline",
  low: "secondary",
  medium: "secondary",
  high: "default",
  urgent: "destructive"
};

const quickFilterPresets: Array<{ label: string; value: TicketStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Backlog", value: "backlog" },
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" }
];

const priorityQuickFilterPresets: Array<{ label: string; value: TicketPriority | "" }> = [
  { label: "All priorities", value: "" },
  { label: "Urgent", value: "urgent" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "No Priority", value: "none" }
];

function createEmptyDraft(): TicketDraft {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    labelIds: []
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function sortLabels(labels: TicketLabel[]) {
  return [...labels].sort((a, b) => a.name.localeCompare(b.name));
}

function deriveSelectedSummary(tickets: TicketSummary[], ticketId: number | null) {
  return tickets.find((ticket) => ticket.id === ticketId) ?? null;
}

function TicketMetaBadge({
  color,
  name
}: {
  color: string;
  name: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export function App() {
  const [filters, setFilters] = useState<TicketFilters>({
    status: "",
    priority: "",
    sort: "updated_desc",
    label: null,
    q: ""
  });
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [labels, setLabels] = useState<TicketLabel[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draft, setDraft] = useState<TicketDraft>(createEmptyDraft);
  const [listLoading, setListLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [managingLabels, setManagingLabels] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [labelForm, setLabelForm] = useState<LabelInput>({ name: "", color: "#64748B" });
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);

  const selectedSummary =
    typeof selectedId === "number" ? deriveSelectedSummary(tickets, selectedId) : null;
  const panelOpen = selectedId !== null;

  const labelMap = useMemo(
    () =>
      labels.reduce<Record<number, TicketLabel>>((memo, label) => {
        memo[label.id] = label;
        return memo;
      }, {}),
    [labels]
  );

  async function loadLabels() {
    const nextLabels = await fetchLabels();
    setLabels(sortLabels(nextLabels));
  }

  async function loadTickets(nextFilters: TicketFilters) {
    setListLoading(true);
    try {
      const nextTickets = await fetchTickets({
        status: nextFilters.status || undefined,
        priority: nextFilters.priority || undefined,
        sort: nextFilters.sort,
        label: nextFilters.label ?? undefined,
        q: nextFilters.q || undefined
      });
      setTickets(nextTickets);
      if (nextTickets.length === 0 && selectedId !== "new") {
        setSelectedId(null);
      } else if (
        typeof selectedId === "number" &&
        !nextTickets.some((ticket) => ticket.id === selectedId)
      ) {
        setSelectedId(null);
      }
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void loadLabels();
  }, []);

  useEffect(() => {
    void loadTickets(filters).catch((error: Error) => {
      setErrorMessage(error.message);
      setListLoading(false);
    });
  }, [filters.status, filters.priority, filters.sort, filters.label, filters.q]);

  useEffect(() => {
    if (selectedId === "new") {
      setSelectedTicket(null);
      setDraft(createEmptyDraft());
      return;
    }

    if (typeof selectedId !== "number") {
      setSelectedTicket(null);
      return;
    }

    setPanelLoading(true);
    fetchTicket(selectedId)
      .then((ticket) => {
        setSelectedTicket(ticket);
        setDraft({
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          labelIds: ticket.labelIds
        });
      })
      .catch((error: Error) => {
        setErrorMessage(error.message);
      })
      .finally(() => {
        setPanelLoading(false);
      });
  }, [selectedId]);

  function updateFilters(partial: Partial<TicketFilters>) {
    setFilters((current) => ({
      ...current,
      ...partial
    }));
  }

  function closePanel() {
    setSelectedId(null);
    setSelectedTicket(null);
    setDraft(createEmptyDraft());
  }

  async function refreshAfterMutation(nextSelectedId?: number | "new" | null) {
    const target = nextSelectedId ?? selectedId;
    await loadTickets(filters);

    if (typeof target === "number") {
      setSelectedId(target);
    } else if (target === "new") {
      setSelectedId("new");
    }
  }

  async function handleTicketSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      if (selectedId === "new") {
        const created = await createTicket(draft);
        await refreshAfterMutation(created.id);
      } else if (typeof selectedId === "number") {
        await updateTicket(selectedId, draft);
        await refreshAfterMutation(selectedId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTicket() {
    if (typeof selectedId !== "number") {
      return;
    }

    if (!window.confirm("Delete this ticket?")) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      await deleteTicket(selectedId);
      closePanel();
      await loadTickets(filters);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLabelSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (editingLabelId) {
        await updateLabel(editingLabelId, labelForm);
      } else {
        await createLabel(labelForm);
      }

      setLabelForm({ name: "", color: "#64748B" });
      setEditingLabelId(null);
      await loadLabels();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save label.");
    }
  }

  async function handleDeleteLabel(id: number) {
    if (!window.confirm("Delete this label?")) {
      return;
    }

    try {
      await deleteLabel(id);
      if (filters.label === id) {
        updateFilters({ label: null });
      }
      setDraft((current) => ({
        ...current,
        labelIds: current.labelIds.filter((labelId) => labelId !== id)
      }));
      await loadLabels();
      await loadTickets(filters);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete label.");
    }
  }

  function toggleDraftLabel(id: number) {
    setDraft((current) => ({
      ...current,
      labelIds: current.labelIds.includes(id)
        ? current.labelIds.filter((labelId) => labelId !== id)
        : [...current.labelIds, id]
    }));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-500">Internal issue tracker</div>
            <h1 className="text-2xl font-semibold tracking-tight">Relay Tasks</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setManagingLabels(true)}>
              <Tag className="h-4 w-4" />
              Manage Labels
            </Button>
            <Button onClick={() => setSelectedId("new")}>
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>
        </header>

        {errorMessage ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <div
          className={cn(
            "grid gap-6",
            panelOpen
              ? "xl:grid-cols-[280px_minmax(0,1fr)_420px]"
              : "xl:grid-cols-[280px_minmax(0,1fr)]"
          )}
        >
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick filters</CardTitle>
                <CardDescription>Jump by status or priority.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickFilterPresets.map((preset) => (
                  <button
                    key={preset.label}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                      filters.status === preset.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                    onClick={() => updateFilters({ status: preset.value })}
                  >
                    <span>{preset.label}</span>
                    {preset.value === "" ? (
                      <Badge variant="outline">{tickets.length}</Badge>
                    ) : null}
                  </button>
                ))}
                <div className="my-3 border-t border-slate-200 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Priority
                  </div>
                  <div className="space-y-2">
                    {priorityQuickFilterPresets.map((preset) => (
                      <button
                        key={preset.label}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                          filters.priority === preset.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                        onClick={() => updateFilters({ priority: preset.value })}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Labels</CardTitle>
                <CardDescription>Filter the current list by label.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  className={cn(
                    "flex w-full items-center rounded-md border px-3 py-2 text-sm transition-colors",
                    filters.label === null
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => updateFilters({ label: null })}
                >
                  All labels
                </button>
                {labels.map((label) => (
                  <button
                    key={label.id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      filters.label === label.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                    onClick={() => updateFilters({ label: label.id })}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader className="gap-4 border-b border-slate-200 pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <CardTitle>Tickets</CardTitle>
                    <CardDescription>{tickets.length} visible items</CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-[1.6_1_260px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      aria-label="Search tickets"
                      className="pl-9"
                      placeholder="Search tickets"
                      value={filters.q}
                      onChange={(event) => updateFilters({ q: event.target.value })}
                    />
                  </div>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(value) =>
                      updateFilters({ status: value === "all" ? "" : (value as TicketStatus) })
                    }
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
                    value={filters.priority || "all"}
                    onValueChange={(value) =>
                      updateFilters({
                        priority: value === "all" ? "" : (value as TicketPriority)
                      })
                    }
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
                    value={filters.sort}
                    onValueChange={(value) =>
                      updateFilters({ sort: value as TicketSortOption })
                    }
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
            <CardContent className="p-0">
              {listLoading ? (
                <div className="flex min-h-60 items-center justify-center text-sm text-slate-500">
                  Loading tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-center">
                  <TicketIcon className="h-5 w-5 text-slate-300" />
                  <div className="text-sm font-medium text-slate-700">No tickets match these filters.</div>
                  <div className="text-sm text-slate-500">Create a ticket or widen the search.</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      className={cn(
                        "flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50",
                        selectedId === ticket.id && "bg-slate-100"
                      )}
                      onClick={() => setSelectedId(ticket.id)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {ticket.ticketNumber}
                          </div>
                          <h2 className="truncate text-sm font-medium text-slate-900">
                            {ticket.title}
                          </h2>
                        </div>
                        <Badge variant={priorityVariantMap[ticket.priority]}>
                          {priorityLabels[ticket.priority]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge variant="outline">{statusLabels[ticket.status]}</Badge>
                        <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ticket.labelIds.length === 0 ? (
                          <span className="text-xs text-slate-400">No labels</span>
                        ) : (
                          ticket.labelIds.map((labelId) => {
                            const label = labelMap[labelId];
                            return label ? (
                              <TicketMetaBadge
                                key={label.id}
                                color={label.color}
                                name={label.name}
                              />
                            ) : null;
                          })
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {panelOpen ? (
            <Card>
              <CardHeader className="border-b border-slate-200 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      {selectedId === "new"
                        ? "New ticket"
                        : selectedTicket?.title ?? "Ticket details"}
                    </CardTitle>
                    <CardDescription>
                      {selectedId === "new"
                        ? "Add a new task to the queue."
                        : selectedSummary?.ticketNumber ?? "Choose a ticket from the list."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {typeof selectedId === "number" ? (
                      <Button variant="outline" size="sm" onClick={handleDeleteTicket} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closePanel}
                      aria-label="Close ticket panel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {panelLoading ? (
                  <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">
                    Loading ticket...
                  </div>
                ) : (
                  <form className="space-y-5" onSubmit={handleTicketSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-title">Title</Label>
                      <Input
                        id="ticket-title"
                        aria-label="Ticket title"
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                        placeholder="Refine onboarding flow"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticket-description">Description</Label>
                      <Textarea
                        id="ticket-description"
                        aria-label="Ticket description"
                        value={draft.description}
                        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                        placeholder="Add context or acceptance notes."
                        rows={8}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={draft.status}
                          onValueChange={(value) =>
                            setDraft({ ...draft, status: value as TicketStatus })
                          }
                        >
                          <SelectTrigger aria-label="Ticket status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ticketStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {statusLabels[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select
                          value={draft.priority}
                          onValueChange={(value) =>
                            setDraft({ ...draft, priority: value as TicketPriority })
                          }
                        >
                          <SelectTrigger aria-label="Ticket priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ticketPriorities.map((priority) => (
                              <SelectItem key={priority} value={priority}>
                                {priorityLabels[priority]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Labels</Label>
                      <div className="grid gap-2">
                        {labels.map((label) => (
                          <label
                            key={label.id}
                            className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                          >
                            <Checkbox
                              checked={draft.labelIds.includes(label.id)}
                              onCheckedChange={() => toggleDraftLabel(label.id)}
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: label.color }}
                            />
                            <span>{label.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                      <div className="text-xs text-slate-500">
                        {selectedTicket ? `Created ${formatDateTime(selectedTicket.createdAt)}` : " "}
                      </div>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : selectedId === "new" ? "Create Ticket" : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog
        open={managingLabels}
        onOpenChange={(open) => {
          setManagingLabels(open);
          if (!open) {
            setEditingLabelId(null);
            setLabelForm({ name: "", color: "#64748B" });
          }
        }}
      >
        <DialogContent aria-describedby="label-manager-description">
          <DialogHeader>
            <DialogTitle>Manage labels</DialogTitle>
            <DialogDescription id="label-manager-description">
              Create and edit label names used for internal ticket grouping.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px_auto]" onSubmit={handleLabelSubmit}>
            <div className="space-y-2">
              <Label htmlFor="label-name">Name</Label>
              <Input
                id="label-name"
                aria-label="Label name"
                value={labelForm.name}
                onChange={(event) =>
                  setLabelForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Documentation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label-color">Color</Label>
              <Input
                id="label-color"
                aria-label="Label color"
                className="h-9"
                type="color"
                value={labelForm.color}
                onChange={(event) =>
                  setLabelForm((current) => ({ ...current, color: event.target.value }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" type="submit">
                {editingLabelId ? "Update Label" : "Add Label"}
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {labels.map((label) => (
              <div
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3"
                key={label.id}
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                  <span>{label.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingLabelId(label.id);
                      setLabelForm({ name: label.name, color: label.color });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDeleteLabel(label.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
