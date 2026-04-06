import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";

describe("public agent API", () => {
  let tempDir: string;
  let app: ReturnType<typeof createApp>["app"];
  let repository: ReturnType<typeof createApp>["repository"];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-public-api-"));
    const created = createApp({
      dbPath: path.join(tempDir, "app.db")
    });
    app = created.app;
    repository = created.repository;
  });

  afterEach(() => {
    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("lists tickets without authentication", async () => {
    await request(app).get("/api/public/v1/tickets").expect(200);
  });

  it("lists available projects for agents", async () => {
    const response = await request(app).get("/api/public/v1/projects").expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: "default" })])
    );
  });

  it("creates tickets idempotently and records agent notes", async () => {
    const labelId = repository.listLabels()[0].id;

    const created = await request(app)
      .post("/api/public/v1/tickets")
      .send({
        project: "default",
        title: "Investigate sync failure",
        description: "Agents should be able to open tickets from external systems.",
        priority: "high",
        labelIds: [labelId],
        source: "github-actions",
        externalRef: "run-4421",
        note: "Opened automatically from CI.",
        actorName: "CI Agent"
      })
      .expect(201);

    expect(created.body.created).toBe(true);
    expect(created.body.ticket.ticketNumber).toBe("APP-1");
    expect(created.body.ticket.source).toBe("github-actions");
    expect(created.body.ticket.externalRef).toBe("run-4421");
    expect(created.body.ticket.notes).toHaveLength(1);
    expect(created.body.ticket.notes[0].authorName).toBe("CI Agent");

    repository.createProject({ name: "Second Project", slug: "second-project" });

    const secondProjectTicket = await request(app)
      .post("/api/public/v1/tickets")
      .send({
        project: "second-project",
        title: "Investigate sync failure elsewhere",
        description: "",
        priority: "high",
        labelIds: [labelId],
        source: "github-actions",
        externalRef: "run-4422",
        actorName: "CI Agent"
      })
      .expect(201);

    expect(secondProjectTicket.body.ticket.ticketNumber).toBe("APP-1");

    const repeated = await request(app)
      .post("/api/public/v1/tickets")
      .send({
        project: "default",
        title: "Investigate sync failure",
        source: "github-actions",
        externalRef: "run-4421"
      })
      .expect(200);

    expect(repeated.body.created).toBe(false);
    expect(repeated.body.ticket.id).toBe(created.body.ticket.id);

    const listed = await request(app)
      .get("/api/public/v1/tickets")
      .query({ project: "default", source: "github-actions", externalRef: "run-4421" })
      .expect(200);

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.ticket.id);
  });

  it("supports note-only and field updates for agents", async () => {
    const created = repository.createTicket({
      title: "Review flaky test",
      description: "Existing ticket for agent handling.",
      status: "todo",
      priority: "medium",
      labelIds: []
    });

    const noteOnly = await request(app)
      .patch(`/api/public/v1/tickets/${created.id}?project=default`)
      .send({
        note: "Picked up for investigation.",
        actorName: "Triage Bot"
      })
      .expect(200);

    expect(noteOnly.body.notes).toHaveLength(1);
    expect(noteOnly.body.notes[0].body).toContain("Picked up");

    const updated = await request(app)
      .patch(`/api/public/v1/tickets/${created.id}?project=default`)
      .send({
        status: "in_progress",
        priority: "high",
        note: "Root cause isolated.",
        actorName: "Triage Bot"
      })
      .expect(200);

    expect(updated.body.status).toBe("in_progress");
    expect(updated.body.priority).toBe("high");
    expect(updated.body.notes).toHaveLength(2);
  });

  it("supports deleting tickets for agents", async () => {
    const created = repository.createTicket({
      title: "Delete through public API",
      description: "",
      status: "backlog",
      priority: "low",
      labelIds: []
    });

    await request(app).delete(`/api/public/v1/tickets/${created.id}?project=default`).expect(204);
    await request(app).get(`/api/public/v1/tickets/${created.id}?project=default`).expect(404);
  });

  it("scopes idempotency by project", async () => {
    repository.createProject({ name: "Second Project", slug: "second-project" });

    const first = await request(app)
      .post("/api/public/v1/tickets")
      .send({
        project: "default",
        title: "Shared external reference",
        source: "ci",
        externalRef: "run-100"
      })
      .expect(201);

    const second = await request(app)
      .post("/api/public/v1/tickets")
      .send({
        project: "second-project",
        title: "Shared external reference",
        source: "ci",
        externalRef: "run-100"
      })
      .expect(201);

    expect(first.body.ticket.id).not.toBe(second.body.ticket.id);
    expect(first.body.ticket.projectSlug).toBe("default");
    expect(second.body.ticket.projectSlug).toBe("second-project");
  });

  it("rejects unknown projects and requires project on public create", async () => {
    await request(app)
      .post("/api/public/v1/tickets")
      .send({
        title: "Missing project"
      })
      .expect(400);

    await request(app)
      .get("/api/public/v1/tickets")
      .query({ project: "unknown-project" })
      .expect(400);
  });

  it("exposes an OpenAPI document when authenticated", async () => {
    const response = await request(app)
      .get("/api/public/v1/openapi.json")
      .expect(200);

    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths["/api/public/v1/tickets"]).toBeTruthy();
    expect(response.body.paths["/api/public/v1/tickets/{id}"].delete).toBeTruthy();
  });
});
