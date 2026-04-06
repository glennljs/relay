import { X } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { AppHeader } from "./features/tickets/components/AppHeader";
import { LabelManagerDialog } from "./features/tickets/components/LabelManagerDialog";
import { ProjectManagerDialog } from "./features/tickets/components/ProjectManagerDialog";
import { QuickFiltersCard } from "./features/tickets/components/QuickFiltersCard";
import { TicketPanel } from "./features/tickets/components/TicketPanel";
import { TicketsCard } from "./features/tickets/components/TicketsCard";
import { useTicketWorkspace } from "./features/tickets/use-ticket-workspace";
import { cn } from "./lib/utils";

export function App() {
  const workspace = useTicketWorkspace();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6">
        <AppHeader
          activeProjectSlug={workspace.activeProjectSlug}
          onManageLabels={() => workspace.setManagingLabels(true)}
          onNewTicket={() => workspace.setSelectedId("new")}
          onOpenProjectManager={workspace.openProjectManager}
          onProjectChange={workspace.handleProjectPickerChange}
          projects={workspace.projects}
        />

        {workspace.errorMessage ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start justify-between gap-4 p-4 text-sm text-red-700">
              <div>{workspace.errorMessage}</div>
              <Button
                aria-label="Dismiss error"
                className="shrink-0"
                onClick={workspace.dismissError}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div
          className={cn(
            "grid gap-6",
            workspace.panelOpen
              ? "xl:grid-cols-[280px_minmax(0,1fr)_420px]"
              : "xl:grid-cols-[280px_minmax(0,1fr)]"
          )}
        >
          <div className="space-y-4">
            <QuickFiltersCard
              filters={workspace.filters}
              labels={workspace.labels}
              onUpdateFilters={workspace.updateFilters}
              statusCounts={workspace.statusCounts}
              tickets={workspace.tickets}
            />
          </div>

          <TicketsCard
            activeDragTicket={workspace.activeDragTicket}
            activeProject={workspace.activeProject}
            boardColumns={workspace.boardColumns}
            boardShowingCanceledEmptyState={workspace.boardShowingCanceledEmptyState}
            boardTickets={workspace.boardTickets}
            filters={workspace.filters}
            labelMap={workspace.labelMap}
            listLoading={workspace.listLoading}
            onDragCancel={workspace.clearActiveDrag}
            onDragEnd={workspace.handleDragEnd}
            onDragStart={workspace.handleDragStart}
            onSelectTicket={workspace.setSelectedId}
            onUpdateFilters={workspace.updateFilters}
            onViewModeChange={workspace.setViewMode}
            selectedId={workspace.selectedId}
            viewMode={workspace.viewMode}
            visibleTicketCount={workspace.visibleTicketCount}
            visibleTickets={workspace.visibleTickets}
          />

          {workspace.panelOpen ? (
            <TicketPanel
              activeProject={workspace.activeProject}
              draft={workspace.draft}
              labels={workspace.labels}
              noteDraft={workspace.noteDraft}
              noteSaving={workspace.noteSaving}
              onClose={workspace.closePanel}
              onDelete={workspace.handleDeleteTicket}
              onDraftChange={workspace.setDraft}
              onNoteDraftChange={workspace.setNoteDraft}
              onNoteSubmit={workspace.handleNoteSubmit}
              onSubmit={workspace.handleTicketSubmit}
              onToggleDraftLabel={workspace.toggleDraftLabel}
              panelLoading={workspace.panelLoading}
              saving={workspace.saving}
              selectedId={workspace.selectedId}
              selectedSummary={workspace.selectedSummary}
              selectedTicket={workspace.selectedTicket}
            />
          ) : null}
        </div>
      </div>

      <ProjectManagerDialog
        activeProjectSlug={workspace.activeProjectSlug}
        editingProject={workspace.editingProject}
        isEditingDefaultProject={workspace.isEditingDefaultProject}
        onOpenChange={workspace.handleProjectDialogOpenChange}
        onProjectFormChange={workspace.setProjectForm}
        onSelectProject={workspace.selectProjectEditor}
        onSetActiveProject={workspace.setActiveProjectSlug}
        onStartCreate={workspace.startProjectCreate}
        onSubmit={workspace.handleProjectSubmit}
        open={workspace.managingProjects}
        projectForm={workspace.projectForm}
        projectSaving={workspace.projectSaving}
        projects={workspace.projects}
      />

      <LabelManagerDialog
        editingLabelId={workspace.editingLabelId}
        labelForm={workspace.labelForm}
        labels={workspace.labels}
        onDelete={workspace.handleDeleteLabel}
        onLabelFormChange={workspace.setLabelForm}
        onOpenChange={workspace.handleLabelDialogOpenChange}
        onStartEdit={workspace.startEditingLabel}
        onSubmit={workspace.handleLabelSubmit}
        open={workspace.managingLabels}
      />
    </div>
  );
}
