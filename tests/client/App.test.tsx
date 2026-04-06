import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../client/App";
import type { Label, Project, TicketDetail } from "../../shared/types";
import * as api from "../../client/api";

interface MockStore {
  labels: Label[];
  projects: Project[];
  tickets: TicketDetail[];
}

let store: MockStore;

const defaultProject: Project = {
  id: 1,
  name: "Default Project",
  slug: "default",
  createdAt: "2026-04-07T00:00:00.000Z",
  updatedAt: "2026-04-07T00:00:00.000Z"
};

function withDefaultProject(
  ticket: Omit<TicketDetail, "projectId" | "projectSlug" | "projectName">
): TicketDetail {
  return {
    ...ticket,
    projectId: defaultProject.id,
    projectSlug: defaultProject.slug,
    projectName: defaultProject.name
  };
}

function createTicketSummary(ticket: TicketDetail) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    projectId: ticket.projectId,
    projectSlug: ticket.projectSlug,
    projectName: ticket.projectName,
    labelIds: ticket.labelIds
  };
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return {};
    }
  } as DOMRect;
}

function mockBoardGeometry() {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  const columnX: Record<string, number> = {
    backlog: 0,
    todo: 40,
    in_progress: 80,
    done: 120
  };

  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      const column = this.getAttribute("data-board-column");
      if (column) {
        return createRect(columnX[column] ?? 0, 0, 30, 320);
      }

      const ticketStatus = this.getAttribute("data-ticket-status");
      if (ticketStatus && this.hasAttribute("data-ticket-card")) {
        return createRect((columnX[ticketStatus] ?? 0) + 2, 60, 26, 110);
      }

      if (ticketStatus && this.hasAttribute("data-ticket-drag-handle")) {
        return createRect((columnX[ticketStatus] ?? 0) + 4, 64, 18, 18);
      }

      return originalGetBoundingClientRect.call(this);
    });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();

  store = {
    projects: [defaultProject],
    labels: [
      { id: 1, name: "Platform", color: "#5B8CFF" },
      { id: 2, name: "Design", color: "#F97316" }
    ],
    tickets: [
      withDefaultProject({
        id: 1,
        ticketNumber: "APP-1",
        title: "Initial ticket",
        description: "Existing work item",
        status: "todo",
        priority: "medium",
        createdAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
        labelIds: [1],
        source: "manual",
        externalRef: null,
        notes: [
          {
            id: 1,
            ticketId: 1,
            body: "Existing note for the ticket.",
            authorName: "Local user",
            authorType: "user",
            createdAt: "2026-04-07T00:30:00.000Z"
          }
        ]
      })
    ]
  };

  vi.spyOn(api, "fetchProjects").mockImplementation(async () => [...store.projects]);
  vi.spyOn(api, "fetchLabels").mockImplementation(async () => [...store.labels]);
  vi.spyOn(api, "fetchTickets").mockImplementation(async (query) => {
    const priorityRank = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      urgent: 4
    } as const;

    return [...store.tickets]
      .filter((ticket) => {
        if (query.project && ticket.projectSlug !== query.project) {
          return false;
        }
        if (query.status && ticket.status !== query.status) {
          return false;
        }
        if (query.priority && ticket.priority !== query.priority) {
          return false;
        }
        if (query.label && !ticket.labelIds.includes(query.label)) {
          return false;
        }
        if (
          query.q &&
          !`${ticket.title} ${ticket.description} ${ticket.ticketNumber}`
            .toLowerCase()
            .includes(query.q.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (query.sort === "priority_desc") {
          return priorityRank[right.priority] - priorityRank[left.priority];
        }

        if (query.sort === "priority_asc") {
          return priorityRank[left.priority] - priorityRank[right.priority];
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map(createTicketSummary);
  });
  vi.spyOn(api, "fetchTicket").mockImplementation(async (id, project) => {
    const ticket = store.tickets.find(
      (item) => item.id === id && (!project || item.projectSlug === project)
    );
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return { ...ticket };
  });
  vi.spyOn(api, "createTicket").mockImplementation(async (input) => {
    const project = store.projects.find((item) => item.slug === input.project) ?? defaultProject;
    const { project: _project, ...ticketInput } = input;
    const ticket: TicketDetail = {
      id: store.tickets.length + 1,
      ticketNumber: `APP-${store.tickets.length + 1}`,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
      source: "manual",
      externalRef: null,
      notes: [],
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
      ...ticketInput
    };
    store.tickets = [...store.tickets, ticket];
    return ticket;
  });
  vi.spyOn(api, "updateTicket").mockImplementation(async (id, input, project) => {
    const current = store.tickets.find(
      (ticket) => ticket.id === id && (!project || ticket.projectSlug === project)
    )!;
    const updated: TicketDetail = {
      ...current,
      ...input,
      updatedAt: "2026-04-08T02:00:00.000Z"
    };
    store.tickets = store.tickets.map((ticket) => (ticket.id === id ? updated : ticket));
    return updated;
  });
  vi.spyOn(api, "createProject").mockImplementation(async (input) => {
    const project = {
      id: store.projects.length + 1,
      name: input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-"),
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z"
    };
    store.projects = [...store.projects, project];
    return project;
  });
  vi.spyOn(api, "updateProject").mockImplementation(async (id, input) => {
    const current = store.projects.find((project) => project.id === id)!;
    const updated = {
      ...current,
      name: input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-"),
      updatedAt: "2026-04-08T04:00:00.000Z"
    };

    store.projects = store.projects.map((project) => (project.id === id ? updated : project));
    store.tickets = store.tickets.map((ticket) =>
      ticket.projectId === id
        ? {
            ...ticket,
            projectName: updated.name,
            projectSlug: updated.slug
          }
        : ticket
    );

    return updated;
  });
  vi.spyOn(api, "createTicketNote").mockImplementation(async (id, input, project) => {
    const ticket = store.tickets.find(
      (item) => item.id === id && (!project || item.projectSlug === project)
    );
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const note = {
      id: ticket.notes.length + 1,
      ticketId: id,
      body: input.body,
      authorName: input.authorName ?? "Local user",
      authorType: input.authorType ?? "user",
      createdAt: "2026-04-08T03:00:00.000Z"
    } as const;

    store.tickets = store.tickets.map((item) =>
      item.id === id
        ? {
            ...item,
            updatedAt: note.createdAt,
            notes: [...item.notes, note]
          }
        : item
    );

    return note;
  });
  vi.spyOn(api, "deleteTicket").mockImplementation(async (id, project) => {
    store.tickets = store.tickets.filter(
      (ticket) => ticket.id !== id || (project && ticket.projectSlug !== project)
    );
  });
  vi.spyOn(api, "createLabel").mockImplementation(async (input) => {
    const label = { id: store.labels.length + 1, ...input };
    store.labels = [...store.labels, label];
    return label;
  });
  vi.spyOn(api, "updateLabel").mockImplementation(async (id, input) => {
    const updated = { id, ...input };
    store.labels = store.labels.map((label) => (label.id === id ? updated : label));
    return updated;
  });
  vi.spyOn(api, "deleteLabel").mockImplementation(async (id) => {
    store.labels = store.labels.filter((label) => label.id !== id);
  });
});

describe("App", () => {
  it("keeps the ticket panel hidden until a ticket is selected and lets it close again", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    expect(screen.queryByLabelText("Ticket title")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));
    expect(await screen.findByLabelText("Ticket title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close ticket panel" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Ticket title")).not.toBeInTheDocument();
    });
  });

  it("clears the selected ticket when switching projects", async () => {
    store.projects.push({
      id: 2,
      name: "Docs",
      slug: "docs",
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z"
    });

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));
    expect(await screen.findByLabelText("Ticket title")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Active project"));
    await user.click(screen.getByRole("option", { name: "Docs" }));

    await waitFor(() => {
      expect(api.fetchTicket).not.toHaveBeenCalledWith(1, "docs");
      expect(screen.queryByText("Ticket not found")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Ticket title")).not.toBeInTheDocument();
    });
  });

  it("dismisses the error banner", async () => {
    vi.mocked(api.fetchTicket).mockRejectedValueOnce(new Error("Ticket not found"));

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss error" }));

    await waitFor(() => {
      expect(screen.queryByText("Ticket not found")).not.toBeInTheDocument();
    });
  });

  it("creates a ticket", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: "New Ticket" }));
    await user.type(screen.getByLabelText("Ticket title"), "Build ticket board");
    await user.type(screen.getByLabelText("Ticket description"), "Wire up CRUD workflow");
    await user.click(screen.getByRole("button", { name: "Create Ticket" }));

    await waitFor(() => {
      expect(api.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Build ticket board", project: "default" })
      );
      expect(
        screen.getByRole("heading", { name: "Build ticket board", level: 2 })
      ).toBeInTheDocument();
    });
  });

  it("creates a project from the configuration dialog", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: "Projects" }));
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(screen.getByLabelText("Project name"), "Docs");
    await user.type(screen.getByLabelText("Project slug"), "docs");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({ name: "Docs", slug: "docs" });
      expect(screen.getByText("0 visible items in Docs")).toBeInTheDocument();
    });
  });

  it("opens project configuration from the dropdown and renames the selected project", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByLabelText("Active project"));
    await user.click(screen.getByRole("option", { name: "Configure projects" }));

    const slugInput = await screen.findByLabelText("Project slug");
    expect(slugInput).toBeDisabled();

    await user.clear(screen.getByLabelText("Project name"));
    await user.type(screen.getByLabelText("Project name"), "Core Workspace");
    await user.click(screen.getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(api.updateProject).toHaveBeenCalledWith(1, {
        name: "Core Workspace",
        slug: "default"
      });
      expect(screen.getByText("1 visible items in Core Workspace")).toBeInTheDocument();
    });
  });

  it("edits status, priority, and labels", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));
    await user.click(screen.getByLabelText("Ticket status"));
    await user.click(screen.getByRole("option", { name: "In Progress" }));
    await user.click(screen.getByLabelText("Ticket priority"));
    await user.click(screen.getByRole("option", { name: "High" }));
    await user.click(screen.getByLabelText(/Design/));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: "in_progress",
          priority: "high",
          labelIds: [1, 2]
        }),
        "default"
      );
    });
  });

  it("renders ticket notes and allows adding a note", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));

    expect(await screen.findByText("Existing note for the ticket.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Ticket note"), "Handed off to QA.");
    await user.click(screen.getByRole("button", { name: "Add Note" }));

    await waitFor(() => {
      expect(api.createTicketNote).toHaveBeenCalledWith(1, { body: "Handed off to QA." }, "default");
      expect(screen.getByText("Handed off to QA.")).toBeInTheDocument();
    });
  });

  it("filters and searches the ticket list", async () => {
    store.tickets.push(withDefaultProject({
      id: 2,
      ticketNumber: "APP-2",
      title: "Polish landing page",
      description: "Design refresh",
      status: "done",
      priority: "low",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: [2],
      source: "manual",
      externalRef: null,
      notes: []
    }));

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.type(screen.getByLabelText("Search tickets"), "landing");

    await waitFor(() => {
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "landing" })
      );
      expect(
        screen.getByRole("button", { name: /Polish landing page/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(screen.getByRole("option", { name: "Done" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Polish landing page/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Initial ticket/i })
      ).not.toBeInTheDocument();
    });
  });

  it("filters tickets from the left rail by priority", async () => {
    store.tickets.push(withDefaultProject({
      id: 2,
      ticketNumber: "APP-2",
      title: "Urgent issue",
      description: "Escalated work",
      status: "todo",
      priority: "urgent",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: [],
      source: "manual",
      externalRef: null,
      notes: []
    }));

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Urgent issue/i });
    await user.click(screen.getByRole("button", { name: "Urgent" }));

    await waitFor(() => {
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: "urgent" })
      );
    });
  });

  it("groups status, priority, and labels inside quick filters", async () => {
    render(<App />);

    const quickFiltersHeading = await screen.findByRole("heading", { name: "Quick Filters" });
    const quickFiltersCard = quickFiltersHeading.closest("div.rounded-lg");

    expect(quickFiltersCard).not.toBeNull();
    expect(within(quickFiltersCard as HTMLElement).getByText("Status")).toBeInTheDocument();
    expect(within(quickFiltersCard as HTMLElement).getByText("Priority")).toBeInTheDocument();
    expect(within(quickFiltersCard as HTMLElement).getByText("Labels")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Labels" })).not.toBeInTheDocument();
  });

  it("shows counts for each quick status filter", async () => {
    store.tickets.push(withDefaultProject({
      id: 2,
      ticketNumber: "APP-2",
      title: "Backlog grooming",
      description: "Queue discovery work",
      status: "backlog",
      priority: "low",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: [],
      source: "manual",
      externalRef: null,
      notes: []
    }));

    render(<App />);

    expect(await screen.findByRole("button", { name: "All 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backlog 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done 0" })).toBeInTheDocument();
  });

  it("filters tickets from the left rail by label", async () => {
    store.tickets.push(withDefaultProject({
      id: 2,
      ticketNumber: "APP-2",
      title: "Design refresh",
      description: "Needs label-based filtering",
      status: "done",
      priority: "low",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: [2],
      source: "manual",
      externalRef: null,
      notes: []
    }));

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Design refresh/i });
    await user.click(screen.getAllByRole("button", { name: "Design" })[0]);

    await waitFor(() => {
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ label: 2 })
      );
    });
  });

  it("sorts tickets by priority", async () => {
    store.tickets.push(
      withDefaultProject({
        id: 2,
        ticketNumber: "APP-2",
        title: "Urgent regression",
        description: "Needs immediate attention",
        status: "todo",
        priority: "urgent",
        createdAt: "2026-04-07T01:00:00.000Z",
        updatedAt: "2026-04-07T01:00:00.000Z",
        labelIds: [],
        source: "manual",
        externalRef: null,
        notes: []
      }),
      withDefaultProject({
        id: 3,
        ticketNumber: "APP-3",
        title: "Low priority cleanup",
        description: "Can wait",
        status: "todo",
        priority: "low",
        createdAt: "2026-04-07T02:00:00.000Z",
        updatedAt: "2026-04-07T02:00:00.000Z",
        labelIds: [],
        source: "manual",
        externalRef: null,
        notes: []
      })
    );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Low priority cleanup/i });
    await user.click(screen.getByLabelText("Sort tickets"));
    await user.click(screen.getByRole("option", { name: "Priority: high to low" }));

    await waitFor(() => {
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "priority_desc" })
      );
    });

    const ticketButtons = screen.getAllByRole("button", {
      name: /Initial ticket|Urgent regression|Low priority cleanup/i
    });
    expect(ticketButtons[0]).toHaveTextContent("Urgent regression");
  });

  it("switches between list and board views and syncs the url query", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    expect(window.location.search).toBe("?view=list");

    await user.click(screen.getByRole("button", { name: "Board" }));

    expect(window.location.search).toBe("?view=board");
    expect(
      await screen.findByRole("heading", { name: "Todo" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(window.location.search).toBe("?view=list");
    expect(screen.getByRole("button", { name: /Initial ticket/i })).toBeInTheDocument();
  });

  it("reads board mode from the url and keeps grouping and filtering applied tickets", async () => {
    store.tickets.push(
      withDefaultProject({
        id: 2,
        ticketNumber: "APP-2",
        title: "Backlog grooming",
        description: "Queue discovery work",
        status: "backlog",
        priority: "low",
        createdAt: "2026-04-07T01:00:00.000Z",
        updatedAt: "2026-04-07T01:00:00.000Z",
        labelIds: [],
        source: "manual",
        externalRef: null,
        notes: []
      }),
      withDefaultProject({
        id: 3,
        ticketNumber: "APP-3",
        title: "Urgent regression",
        description: "Needs immediate attention",
        status: "todo",
        priority: "urgent",
        createdAt: "2026-04-07T02:00:00.000Z",
        updatedAt: "2026-04-07T02:00:00.000Z",
        labelIds: [],
        source: "manual",
        externalRef: null,
        notes: []
      }),
      withDefaultProject({
        id: 4,
        ticketNumber: "APP-4",
        title: "Shipped fix",
        description: "Already completed",
        status: "done",
        priority: "high",
        createdAt: "2026-04-07T03:00:00.000Z",
        updatedAt: "2026-04-07T03:00:00.000Z",
        labelIds: [],
        source: "manual",
        externalRef: null,
        notes: []
      })
    );

    window.history.replaceState({}, "", "/?view=board");
    const user = userEvent.setup();
    render(<App />);

    const todoColumn = await screen.findByRole("region", { name: "Todo" });
    expect(
      within(screen.getByRole("region", { name: "Backlog" })).getByRole("heading", {
        name: /^Backlog grooming$/i
      })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Done" })).getByRole("heading", {
        name: /^Shipped fix$/i
      })
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Sort tickets"));
    await user.click(screen.getByRole("option", { name: "Priority: high to low" }));

    await waitFor(() => {
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "priority_desc" })
      );
    });

    const todoButtons = within(todoColumn).getAllByRole("button", {
      name: /Initial ticket|Urgent regression/i
    });
    expect(todoButtons[0]).toHaveTextContent("Urgent regression");

    await user.type(screen.getByLabelText("Search tickets"), "regression");

    await waitFor(() => {
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "regression", sort: "priority_desc" })
      );
      expect(
        within(screen.getByRole("region", { name: "Todo" })).getByRole("heading", {
          name: /^Urgent regression$/i
        })
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("region", { name: "Todo" })).queryByRole("heading", {
          name: /^Initial ticket$/i
        })
      ).not.toBeInTheDocument();
    });
  });

  it("moves tickets across board columns with keyboard drag", async () => {
    mockBoardGeometry();
    window.history.replaceState({}, "", "/?view=board");

    const user = userEvent.setup();
    render(<App />);

    const dragHandle = await screen.findByRole("button", { name: /Drag Initial ticket/i });
    dragHandle.focus();

    await user.keyboard("[Space][ArrowRight][Space]");

    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(1, { status: "backlog" }, "default");
      expect(
        within(screen.getByRole("region", { name: "Backlog" })).getByRole("heading", {
          name: /^Initial ticket$/i
        })
      ).toBeInTheDocument();
    });
  });

  it("rolls board drag changes back when the patch fails", async () => {
    mockBoardGeometry();
    window.history.replaceState({}, "", "/?view=board");
    vi.mocked(api.updateTicket).mockRejectedValueOnce(new Error("Unable to persist change."));

    const user = userEvent.setup();
    render(<App />);

    const dragHandle = await screen.findByRole("button", { name: /Drag Initial ticket/i });
    dragHandle.focus();

    await user.keyboard("[Space][ArrowRight][Space]");

    await waitFor(() => {
      expect(screen.getByText("Unable to persist change.")).toBeInTheDocument();
      expect(
        within(screen.getByRole("region", { name: "Todo" })).getByRole("heading", {
          name: /^Initial ticket$/i
        })
      ).toBeInTheDocument();
    });
  });

  it("shows the board empty state for canceled tickets", async () => {
    store.tickets.push(withDefaultProject({
      id: 2,
      ticketNumber: "APP-2",
      title: "Archived task",
      description: "No longer active",
      status: "canceled",
      priority: "low",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: [],
      source: "manual",
      externalRef: null,
      notes: []
    }));

    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: "Board" }));
    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(screen.getByRole("option", { name: "Canceled" }));

    expect(
      await screen.findByText("Canceled tickets stay in the list view.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear status filter" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Canceled tickets stay in the list view.")
      ).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Todo" })).toBeInTheDocument();
    });
  });

  it("deletes a ticket", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteTicket).toHaveBeenCalledWith(1, "default");
      expect(screen.queryByRole("button", { name: /Initial ticket/i })).not.toBeInTheDocument();
    });
  });
});
