import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRepository, initializeDatabase } from "../../server/db";

describe("database repository", () => {
  let tempDir: string;
  let repository: ReturnType<typeof createRepository>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-db-"));
    repository = createRepository(initializeDatabase(path.join(tempDir, "app.db")));
  });

  afterEach(() => {
    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates schema and seeds labels", () => {
    const labels = repository.listLabels();
    expect(labels).toHaveLength(3);
    expect(labels.map((label) => label.name)).toContain("Platform");
    expect(repository.listProjects()).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: "default" })])
    );
  });

  it("persists ticket-label joins", () => {
    const labels = repository.listLabels();
    const requestedLabelIds = [labels[0].id, labels[1].id];
    const created = repository.createTicket({
      title: "Ship new board",
      description: "Ticket persistence should carry labels",
      status: "todo",
      priority: "high",
      labelIds: requestedLabelIds
    });

    expect(created.ticketNumber).toBe("APP-1");
    expect([...created.labelIds].sort((left, right) => left - right)).toEqual(
      [...requestedLabelIds].sort((left, right) => left - right)
    );

    const listed = repository.listTickets({ label: labels[1].id });
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
  });

  it("migrates legacy databases before creating the public-api index", () => {
    repository.close();

    const dbPath = path.join(tempDir, "legacy.db");
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')),
        priority TEXT NOT NULL CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
      );

      CREATE TABLE ticket_labels (
        ticket_id INTEGER NOT NULL,
        label_id INTEGER NOT NULL,
        PRIMARY KEY (ticket_id, label_id)
      );
    `);
    legacyDb.close();

    repository = createRepository(initializeDatabase(dbPath));

    const created = repository.createTicket({
      title: "Migrated ticket",
      description: "",
      status: "backlog",
      priority: "medium",
      labelIds: []
    });

    expect(created.ticketNumber).toBe("APP-1");
    expect(repository.getTicketDetail(created.id)?.source).toBe("app");
    expect(repository.getTicketDetail(created.id)?.projectSlug).toBe("default");

    const project = repository.createProject({ name: "Docs", slug: "docs" });
    const projectTicket = repository.createTicket(
      {
        title: "Migrated project ticket",
        description: "",
        status: "backlog",
        priority: "medium",
        labelIds: []
      },
      { project: project.slug }
    );

    expect(projectTicket.ticketNumber).toBe("APP-1");
  });

  it("creates projects and scopes ticket queries by project", () => {
    const project = repository.createProject({ name: "Docs", slug: "docs" });

    const defaultTicket = repository.createTicket({
      title: "Default project ticket",
      description: "",
      status: "todo",
      priority: "medium",
      labelIds: []
    });
    const docsTicket = repository.createTicket(
      {
        title: "Docs ticket",
        description: "",
        status: "todo",
        priority: "medium",
        labelIds: []
      },
      { project: project.slug }
    );

    expect(defaultTicket.ticketNumber).toBe("APP-1");
    expect(docsTicket.ticketNumber).toBe("APP-1");
    expect(repository.listTickets({ project: "default" }).map((ticket) => ticket.id)).toEqual([
      defaultTicket.id
    ]);
    expect(repository.listTickets({ project: "docs" }).map((ticket) => ticket.id)).toEqual([
      docsTicket.id
    ]);
  });

  it("rejects duplicate project slugs", () => {
    repository.createProject({ name: "Docs", slug: "docs" });
    expect(() => repository.createProject({ name: "Docs Again", slug: "docs" })).toThrow(
      "Project slug already exists."
    );
  });

  it("updates project names and slugs without losing ticket associations", () => {
    const project = repository.createProject({ name: "Docs", slug: "docs" });
    const ticket = repository.createTicket(
      {
        title: "Docs ticket",
        description: "",
        status: "todo",
        priority: "medium",
        labelIds: []
      },
      { project: "docs" }
    );

    const updated = repository.updateProject(project.id, { name: "Guides", slug: "guides" });

    expect(updated).toEqual(expect.objectContaining({ id: project.id, name: "Guides", slug: "guides" }));
    expect(repository.getProjectBySlug("docs")).toBeNull();
    expect(repository.listTickets({ project: "guides" }).map((item) => item.id)).toEqual([ticket.id]);
  });

  it("sorts listed tickets by priority when requested", () => {
    repository.createTicket({
      title: "Medium priority task",
      description: "",
      status: "todo",
      priority: "medium",
      labelIds: []
    });
    repository.createTicket({
      title: "Urgent priority task",
      description: "",
      status: "todo",
      priority: "urgent",
      labelIds: []
    });
    repository.createTicket({
      title: "Low priority task",
      description: "",
      status: "todo",
      priority: "low",
      labelIds: []
    });

    expect(repository.listTickets({ sort: "priority_desc" }).map((ticket) => ticket.priority)).toEqual([
      "urgent",
      "medium",
      "low"
    ]);
    expect(repository.listTickets({ sort: "priority_asc" }).map((ticket) => ticket.priority)).toEqual([
      "low",
      "medium",
      "urgent"
    ]);
  });
});
