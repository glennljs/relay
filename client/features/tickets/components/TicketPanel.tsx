import type { FormEvent } from "react";
import { Trash2, X } from "lucide-react";
import type {
  Label as TicketLabel,
  Project,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  TicketSummary
} from "../../../../shared/types";
import { ticketPriorities, ticketStatuses } from "../../../../shared/types";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "../../../lib/utils";
import { noteAuthorTone, priorityLabels, statusLabels } from "../constants";
import type { TicketDraft } from "../types";
import { formatDateTime } from "../utils";

export function TicketPanel({
  selectedId,
  selectedTicket,
  selectedSummary,
  activeProject,
  panelLoading,
  draft,
  labels,
  noteDraft,
  saving,
  noteSaving,
  onDraftChange,
  onToggleDraftLabel,
  onNoteDraftChange,
  onSubmit,
  onDelete,
  onNoteSubmit,
  onClose
}: {
  selectedId: number | "new" | null;
  selectedTicket: TicketDetail | null;
  selectedSummary: TicketSummary | null;
  activeProject: Project | null;
  panelLoading: boolean;
  draft: TicketDraft;
  labels: TicketLabel[];
  noteDraft: string;
  saving: boolean;
  noteSaving: boolean;
  onDraftChange: (draft: TicketDraft) => void;
  onToggleDraftLabel: (labelId: number) => void;
  onNoteDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onDelete: () => Promise<void>;
  onNoteSubmit: (event: FormEvent) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>
              {selectedId === "new" ? "New ticket" : selectedTicket?.title ?? "Ticket details"}
            </CardTitle>
            <CardDescription>
              {selectedId === "new"
                ? activeProject
                  ? `Add a new task to ${activeProject.name}.`
                  : "Add a new task to the queue."
                : selectedTicket
                  ? `${selectedSummary?.ticketNumber ?? "Ticket"} in ${selectedTicket.projectName}`
                  : selectedSummary?.ticketNumber ?? "Choose a ticket from the list."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {typeof selectedId === "number" ? (
              <Button disabled={saving} onClick={() => void onDelete()} size="sm" variant="outline">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button
              aria-label="Close ticket panel"
              onClick={onClose}
              size="sm"
              type="button"
              variant="ghost"
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
          <div className="space-y-6">
            {activeProject ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                  {selectedTicket?.projectName ?? activeProject.name}
                </span>
                <span>@{selectedTicket?.projectSlug ?? activeProject.slug}</span>
              </div>
            ) : null}
            <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="ticket-title">Title</Label>
                <Input
                  aria-label="Ticket title"
                  id="ticket-title"
                  onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
                  placeholder="Refine onboarding flow"
                  required
                  value={draft.title}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-description">Description</Label>
                <Textarea
                  aria-label="Ticket description"
                  id="ticket-description"
                  onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
                  placeholder="Add context or acceptance notes."
                  rows={8}
                  value={draft.description}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    onValueChange={(value) =>
                      onDraftChange({ ...draft, status: value as TicketStatus })
                    }
                    value={draft.status}
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
                    onValueChange={(value) =>
                      onDraftChange({ ...draft, priority: value as TicketPriority })
                    }
                    value={draft.priority}
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
                      className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                      key={label.id}
                    >
                      <Checkbox
                        checked={draft.labelIds.includes(label.id)}
                        onCheckedChange={() => onToggleDraftLabel(label.id)}
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                      <span>{label.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <div className="text-xs text-slate-500">
                  {selectedTicket ? `Created ${formatDateTime(selectedTicket.createdAt)}` : " "}
                </div>
                <Button disabled={saving} type="submit">
                  {saving ? "Saving..." : selectedId === "new" ? "Create Ticket" : "Save Changes"}
                </Button>
              </div>
            </form>

            {typeof selectedId === "number" && selectedTicket ? (
              <section className="space-y-4 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
                    <p className="text-xs text-slate-500">
                      {selectedTicket.notes.length > 0
                        ? `${selectedTicket.notes.length} updates on this ticket`
                        : "Capture progress, handoff context, or audit history."}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {selectedTicket.notes.length}
                  </span>
                </div>

                <form
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  onSubmit={(event) => void onNoteSubmit(event)}
                >
                  <div className="space-y-2">
                    <Label htmlFor="ticket-note">New note</Label>
                    <Textarea
                      aria-label="Ticket note"
                      id="ticket-note"
                      onChange={(event) => onNoteDraftChange(event.target.value)}
                      placeholder="Add progress, context, or a handoff note."
                      rows={4}
                      value={noteDraft}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Notes are posted as <span className="font-medium text-slate-700">Local user</span>.
                    </p>
                    <Button disabled={noteSaving || noteDraft.trim().length === 0} type="submit">
                      {noteSaving ? "Posting..." : "Add Note"}
                    </Button>
                  </div>
                </form>

                {selectedTicket.notes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    No notes yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTicket.notes.map((note) => (
                      <article
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5"
                        key={note.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{note.authorName}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em]",
                              noteAuthorTone[note.authorType]
                            )}
                          >
                            {note.authorType}
                          </span>
                          <span className="text-xs text-slate-400">{formatDateTime(note.createdAt)}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {note.body}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
