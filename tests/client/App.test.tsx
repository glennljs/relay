import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../client/App";
import type { Label, Ticket } from "../../shared/types";
import * as api from "../../client/api";

interface MockStore {
  labels: Label[];
  tickets: Ticket[];
}

let store: MockStore;

function createTicketSummary(ticket: Ticket) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    labelIds: ticket.labelIds
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));

  store = {
    labels: [
      { id: 1, name: "Platform", color: "#5B8CFF" },
      { id: 2, name: "Design", color: "#F97316" }
    ],
    tickets: [
      {
        id: 1,
        ticketNumber: "APP-1",
        title: "Initial ticket",
        description: "Existing work item",
        status: "todo",
        priority: "medium",
        createdAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
        labelIds: [1]
      }
    ]
  };

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
  vi.spyOn(api, "fetchTicket").mockImplementation(async (id) => {
    const ticket = store.tickets.find((item) => item.id === id);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return { ...ticket };
  });
  vi.spyOn(api, "createTicket").mockImplementation(async (input) => {
    const ticket: Ticket = {
      id: store.tickets.length + 1,
      ticketNumber: `APP-${store.tickets.length + 1}`,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
      ...input
    };
    store.tickets = [...store.tickets, ticket];
    return ticket;
  });
  vi.spyOn(api, "updateTicket").mockImplementation(async (id, input) => {
    const current = store.tickets.find((ticket) => ticket.id === id)!;
    const updated: Ticket = {
      ...current,
      ...input,
      updatedAt: "2026-04-08T02:00:00.000Z"
    };
    store.tickets = store.tickets.map((ticket) => (ticket.id === id ? updated : ticket));
    return updated;
  });
  vi.spyOn(api, "deleteTicket").mockImplementation(async (id) => {
    store.tickets = store.tickets.filter((ticket) => ticket.id !== id);
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
        expect.objectContaining({ title: "Build ticket board" })
      );
      expect(
        screen.getByRole("heading", { name: "Build ticket board", level: 2 })
      ).toBeInTheDocument();
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
        })
      );
    });
  });

  it("filters and searches the ticket list", async () => {
    store.tickets.push({
      id: 2,
      ticketNumber: "APP-2",
      title: "Polish landing page",
      description: "Design refresh",
      status: "done",
      priority: "low",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: [2]
    });

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
      expect(api.fetchTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "landing", status: "done" })
      );
    });
  });

  it("filters tickets from the left rail by priority", async () => {
    store.tickets.push({
      id: 2,
      ticketNumber: "APP-2",
      title: "Urgent issue",
      description: "Escalated work",
      status: "todo",
      priority: "urgent",
      createdAt: "2026-04-07T01:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      labelIds: []
    });

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

  it("sorts tickets by priority", async () => {
    store.tickets.push(
      {
        id: 2,
        ticketNumber: "APP-2",
        title: "Urgent regression",
        description: "Needs immediate attention",
        status: "todo",
        priority: "urgent",
        createdAt: "2026-04-07T01:00:00.000Z",
        updatedAt: "2026-04-07T01:00:00.000Z",
        labelIds: []
      },
      {
        id: 3,
        ticketNumber: "APP-3",
        title: "Low priority cleanup",
        description: "Can wait",
        status: "todo",
        priority: "low",
        createdAt: "2026-04-07T02:00:00.000Z",
        updatedAt: "2026-04-07T02:00:00.000Z",
        labelIds: []
      }
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

  it("deletes a ticket", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: /Initial ticket/i });
    await user.click(screen.getByRole("button", { name: /Initial ticket/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteTicket).toHaveBeenCalledWith(1);
      expect(screen.queryByRole("button", { name: /Initial ticket/i })).not.toBeInTheDocument();
    });
  });
});
