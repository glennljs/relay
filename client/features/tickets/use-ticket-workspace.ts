import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  createLabel,
  createProject,
  createTicket,
  createTicketNote,
  deleteLabel,
  deleteTicket,
  fetchLabels,
  fetchProjects,
  fetchTicket,
  fetchTickets,
  updateLabel,
  updateProject,
  updateTicket
} from "../../api";
import type {
  Label as TicketLabel,
  LabelInput,
  Project,
  ProjectInput,
  TicketDetail,
  TicketStatus,
  TicketSummary
} from "../../../shared/types";
import {
  defaultProjectSlug,
  newProjectConfigValue,
  projectManagerActionValue
} from "./constants";
import type { BoardColumnStatus, TicketDraft, TicketFilters } from "./types";
import {
  createBoardGroups,
  createDraftFromTicket,
  createEmptyDraft,
  createProjectDraft,
  deriveSelectedSummary,
  isBoardColumnStatus,
  readStoredProjectSlug,
  readViewModeFromLocation,
  sortLabels,
  sortTicketSummaries,
  syncViewModeToLocation,
  toTicketSummary
} from "./utils";

export function useTicketWorkspace() {
  const [filters, setFilters] = useState<TicketFilters>({
    status: "",
    priority: "",
    sort: "updated_desc",
    label: null,
    q: ""
  });
  const [viewMode, setViewMode] = useState(() => readViewModeFromLocation());
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectSlug, setActiveProjectSlug] = useState(() => readStoredProjectSlug());
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [labels, setLabels] = useState<TicketLabel[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [draft, setDraft] = useState<TicketDraft>(createEmptyDraft);
  const [noteDraft, setNoteDraft] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [managingLabels, setManagingLabels] = useState(false);
  const [managingProjects, setManagingProjects] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [labelForm, setLabelForm] = useState<LabelInput>({ name: "", color: "#64748B" });
  const [projectForm, setProjectForm] = useState<ProjectInput>(() => createProjectDraft());
  const [projectEditorSlug, setProjectEditorSlug] = useState<string>(newProjectConfigValue);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  const visibleTickets = useMemo(
    () => (filters.status ? tickets.filter((ticket) => ticket.status === filters.status) : tickets),
    [tickets, filters.status]
  );
  const selectedSummary =
    typeof selectedId === "number" ? deriveSelectedSummary(visibleTickets, selectedId) : null;
  const activeProject = useMemo(
    () => projects.find((project) => project.slug === activeProjectSlug) ?? null,
    [projects, activeProjectSlug]
  );
  const editingProject = useMemo(
    () =>
      projectEditorSlug === newProjectConfigValue
        ? null
        : projects.find((project) => project.slug === projectEditorSlug) ?? null,
    [projects, projectEditorSlug]
  );
  const isEditingDefaultProject = editingProject?.slug === defaultProjectSlug;
  const panelOpen = selectedId !== null;
  const boardTickets = useMemo(
    () => visibleTickets.filter((ticket) => isBoardColumnStatus(ticket.status)),
    [visibleTickets]
  );
  const boardColumns = useMemo(() => createBoardGroups(boardTickets), [boardTickets]);
  const boardShowingCanceledEmptyState = viewMode === "board" && filters.status === "canceled";
  const visibleTicketCount = viewMode === "board" ? boardTickets.length : visibleTickets.length;
  const activeDragTicket =
    activeDragId === null ? null : visibleTickets.find((ticket) => ticket.id === activeDragId) ?? null;
  const statusCounts = useMemo(
    () =>
      tickets.reduce<Record<TicketStatus, number>>(
        (memo, ticket) => {
          memo[ticket.status] += 1;
          return memo;
        },
        {
          backlog: 0,
          todo: 0,
          in_progress: 0,
          done: 0,
          canceled: 0
        }
      ),
    [tickets]
  );
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

  async function loadProjects() {
    const nextProjects = await fetchProjects();
    setProjects(nextProjects);
    setActiveProjectSlug((current) => {
      if (current && nextProjects.some((project) => project.slug === current)) {
        return current;
      }

      return nextProjects[0]?.slug ?? "";
    });
    return nextProjects;
  }

  async function loadTickets(nextFilters: TicketFilters) {
    if (!activeProjectSlug) {
      setTickets([]);
      setListLoading(false);
      return;
    }

    setListLoading(true);
    try {
      const nextTickets = await fetchTickets({
        project: activeProjectSlug,
        priority: nextFilters.priority || undefined,
        sort: nextFilters.sort,
        label: nextFilters.label ?? undefined,
        q: nextFilters.q || undefined
      });
      setTickets(nextTickets);
    } finally {
      setListLoading(false);
    }
  }

  async function loadTicketDetail(ticketId: number) {
    const ticket = await fetchTicket(ticketId, activeProjectSlug);
    setSelectedTicket(ticket);
    setDraft(createDraftFromTicket(ticket));
  }

  useEffect(() => {
    void loadLabels();
    void loadProjects().catch((error: Error) => {
      setErrorMessage(error.message);
    });
  }, []);

  useEffect(() => {
    if (!activeProjectSlug) {
      setTickets([]);
      setListLoading(false);
      return;
    }

    void loadTickets(filters).catch((error: Error) => {
      setErrorMessage(error.message);
      setListLoading(false);
    });
  }, [activeProjectSlug, filters.priority, filters.sort, filters.label, filters.q]);

  useEffect(() => {
    if (selectedId === "new") {
      return;
    }

    if (typeof selectedId === "number" && !visibleTickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleTickets]);

  useEffect(() => {
    syncViewModeToLocation(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeProjectSlug) {
      window.localStorage.setItem("relay.activeProjectSlug", activeProjectSlug);
    } else {
      window.localStorage.removeItem("relay.activeProjectSlug");
    }
  }, [activeProjectSlug]);

  useEffect(() => {
    const handlePopState = () => {
      setViewMode(readViewModeFromLocation());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    closePanel();
  }, [activeProjectSlug]);

  useEffect(() => {
    if (selectedId === "new") {
      setSelectedTicket(null);
      setDraft(createEmptyDraft());
      setNoteDraft("");
      return;
    }

    if (typeof selectedId !== "number") {
      setSelectedTicket(null);
      setNoteDraft("");
      return;
    }

    if (selectedSummary?.projectSlug !== activeProjectSlug) {
      closePanel();
      setErrorMessage(null);
      return;
    }

    setPanelLoading(true);
    setNoteDraft("");
    loadTicketDetail(selectedId)
      .catch((error: Error) => {
        setErrorMessage(error.message);
      })
      .finally(() => {
        setPanelLoading(false);
      });
  }, [selectedId, activeProjectSlug, selectedSummary?.projectSlug]);

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
    setNoteDraft("");
  }

  function dismissError() {
    setErrorMessage(null);
  }

  async function handleTicketSubmit(event: FormEvent) {
    event.preventDefault();

    if (!activeProjectSlug) {
      setErrorMessage("Create or select a project first.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      if (selectedId === "new") {
        const created = await createTicket({ ...draft, project: activeProjectSlug });
        setSelectedId(created.id);
        setSelectedTicket(created);
        setDraft(createDraftFromTicket(created));
        await loadTickets(filters);
      } else if (typeof selectedId === "number") {
        const updated = await updateTicket(selectedId, draft, activeProjectSlug);
        setSelectedTicket(updated);
        setDraft(createDraftFromTicket(updated));
        await loadTickets(filters);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleNoteSubmit(event: FormEvent) {
    event.preventDefault();

    if (typeof selectedId !== "number" || noteDraft.trim().length === 0 || !activeProjectSlug) {
      return;
    }

    setNoteSaving(true);
    setErrorMessage(null);

    try {
      const note = await createTicketNote(selectedId, { body: noteDraft }, activeProjectSlug);
      setSelectedTicket((current) =>
        current
          ? {
              ...current,
              updatedAt: note.createdAt,
              notes: [...current.notes, note]
            }
          : current
      );
      setNoteDraft("");
      await loadTickets(filters);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add note.");
    } finally {
      setNoteSaving(false);
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
      await deleteTicket(selectedId, activeProjectSlug);
      closePanel();
      await loadTickets(filters);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLabelSubmit(event: FormEvent) {
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

  async function handleProjectSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setProjectSaving(true);

    try {
      if (editingProject) {
        const updated = await updateProject(editingProject.id, {
          name: projectForm.name,
          slug: isEditingDefaultProject ? editingProject.slug : projectForm.slug?.trim() || undefined
        });
        await loadProjects();
        if (activeProjectSlug === editingProject.slug) {
          setActiveProjectSlug(updated.slug);
        }
        setProjectEditorSlug(updated.slug);
        setProjectForm(createProjectDraft(updated));
      } else {
        const created = await createProject({
          name: projectForm.name,
          slug: projectForm.slug?.trim() || undefined
        });
        await loadProjects();
        setActiveProjectSlug(created.slug);
        setProjectEditorSlug(created.slug);
        setProjectForm(createProjectDraft(created));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save project.");
    } finally {
      setProjectSaving(false);
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

  async function moveTicketToStatus(ticketId: number, nextStatus: BoardColumnStatus) {
    if (!activeProjectSlug) {
      return;
    }

    const currentTicket = tickets.find((ticket) => ticket.id === ticketId);

    if (!currentTicket || currentTicket.status === nextStatus) {
      return;
    }

    const optimisticUpdatedAt = new Date().toISOString();
    const previousTickets = tickets;
    const previousSelectedTicket = selectedTicket?.id === ticketId ? selectedTicket : null;
    const previousDraft = selectedId === ticketId ? draft : null;

    const optimisticTickets = sortTicketSummaries(
      previousTickets.flatMap((ticket) => {
        if (ticket.id !== ticketId) {
          return [ticket];
        }

        if (filters.status && filters.status !== nextStatus) {
          return [];
        }

        return [
          {
            ...ticket,
            status: nextStatus,
            updatedAt: optimisticUpdatedAt
          }
        ];
      }),
      filters.sort
    );

    setErrorMessage(null);
    setTickets(optimisticTickets);
    if (previousSelectedTicket) {
      setSelectedTicket({
        ...previousSelectedTicket,
        status: nextStatus,
        updatedAt: optimisticUpdatedAt
      });
    }
    if (previousDraft) {
      setDraft({
        ...previousDraft,
        status: nextStatus
      });
    }

    try {
      const updated = await updateTicket(ticketId, { status: nextStatus }, activeProjectSlug);
      if (selectedId === updated.id) {
        setSelectedTicket(updated);
        setDraft(createDraftFromTicket(updated));
      }

      const nextTickets = sortTicketSummaries(
        optimisticTickets.map((ticket) => (ticket.id === updated.id ? toTicketSummary(updated) : ticket)),
        filters.sort
      );
      setTickets(nextTickets);
      await loadTickets(filters);
    } catch (error) {
      setTickets(previousTickets);
      if (previousSelectedTicket) {
        setSelectedTicket(previousSelectedTicket);
      }
      if (previousDraft) {
        setDraft(previousDraft);
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to move ticket.");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const ticketId = Number(event.active.id);
    if (!Number.isNaN(ticketId)) {
      setActiveDragId(ticketId);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const ticketId = Number(event.active.id);
    const dropTarget = typeof event.over?.id === "string" ? event.over.id : "";

    setActiveDragId(null);

    if (Number.isNaN(ticketId) || !isBoardColumnStatus(dropTarget)) {
      return;
    }

    void moveTicketToStatus(ticketId, dropTarget);
  }

  function clearActiveDrag() {
    setActiveDragId(null);
  }

  function selectProjectEditor(project: Project) {
    setProjectEditorSlug(project.slug);
    setProjectForm(createProjectDraft(project));
  }

  function startProjectCreate() {
    setProjectEditorSlug(newProjectConfigValue);
    setProjectForm(createProjectDraft());
  }

  function openProjectManager(preferredSlug?: string) {
    const targetProject =
      (preferredSlug ? projects.find((project) => project.slug === preferredSlug) : null) ??
      activeProject ??
      projects[0] ??
      null;

    if (targetProject) {
      selectProjectEditor(targetProject);
    } else {
      startProjectCreate();
    }

    setManagingProjects(true);
  }

  function handleProjectPickerChange(value: string) {
    if (value === projectManagerActionValue) {
      openProjectManager(activeProjectSlug);
      return;
    }

    setActiveProjectSlug(value);
  }

  function handleProjectDialogOpenChange(open: boolean) {
    setManagingProjects(open);
    if (!open) {
      setProjectSaving(false);
      startProjectCreate();
    }
  }

  function handleLabelDialogOpenChange(open: boolean) {
    setManagingLabels(open);
    if (!open) {
      setEditingLabelId(null);
      setLabelForm({ name: "", color: "#64748B" });
    }
  }

  function startEditingLabel(label: TicketLabel) {
    setEditingLabelId(label.id);
    setLabelForm({ name: label.name, color: label.color });
  }

  return {
    filters,
    viewMode,
    projects,
    activeProjectSlug,
    tickets,
    labels,
    selectedId,
    selectedTicket,
    draft,
    noteDraft,
    listLoading,
    panelLoading,
    saving,
    projectSaving,
    noteSaving,
    managingLabels,
    managingProjects,
    errorMessage,
    labelForm,
    projectForm,
    editingLabelId,
    activeProject,
    editingProject,
    isEditingDefaultProject,
    panelOpen,
    visibleTickets,
    selectedSummary,
    boardTickets,
    boardColumns,
    boardShowingCanceledEmptyState,
    visibleTicketCount,
    activeDragTicket,
    statusCounts,
    labelMap,
    setSelectedId,
    setDraft,
    setNoteDraft,
    setLabelForm,
    setProjectForm,
    setActiveProjectSlug,
    setManagingLabels,
    dismissError,
    updateFilters,
    setViewMode,
    closePanel,
    handleTicketSubmit,
    handleDeleteTicket,
    handleNoteSubmit,
    toggleDraftLabel,
    handleProjectSubmit,
    handleLabelSubmit,
    handleDeleteLabel,
    handleDragStart,
    handleDragEnd,
    clearActiveDrag,
    startProjectCreate,
    selectProjectEditor,
    openProjectManager,
    handleProjectPickerChange,
    handleProjectDialogOpenChange,
    handleLabelDialogOpenChange,
    startEditingLabel
  };
}
