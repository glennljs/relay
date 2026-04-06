import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";

describe("API", () => {
  let tempDir: string;
  let app: ReturnType<typeof createApp>["app"];
  let repository: ReturnType<typeof createApp>["repository"];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-api-"));
    const created = createApp({ dbPath: path.join(tempDir, "app.db") });
    app = created.app;
    repository = created.repository;
  });

  afterEach(() => {
    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("supports label and ticket CRUD with filters", async () => {
    const labelResponse = await request(app)
      .post("/api/labels")
      .send({ name: "Docs", color: "#A855F7" })
      .expect(201);

    const ticketResponse = await request(app)
      .post("/api/tickets")
      .send({
        title: "Document setup",
        description: "Add README instructions",
        status: "todo",
        priority: "medium",
        labelIds: [labelResponse.body.id]
      })
      .expect(201);

    expect(ticketResponse.body.ticketNumber).toBe("APP-1");

    const filtered = await request(app)
      .get("/api/tickets")
      .query({ label: labelResponse.body.id, q: "README" })
      .expect(200);

    expect(filtered.body).toHaveLength(1);

    await request(app)
      .patch(`/api/tickets/${ticketResponse.body.id}`)
      .send({
        title: "Document local setup",
        description: "Add README instructions",
        status: "in_progress",
        priority: "high",
        labelIds: [labelResponse.body.id]
      })
      .expect(200);

    const updated = await request(app).get(`/api/tickets/${ticketResponse.body.id}`).expect(200);
    expect(updated.body.status).toBe("in_progress");
    expect(updated.body.notes).toEqual([]);

    await request(app).delete(`/api/tickets/${ticketResponse.body.id}`).expect(204);
    await request(app).get(`/api/tickets/${ticketResponse.body.id}`).expect(404);
  });

  it("returns ticket notes and accepts note creation from the app API", async () => {
    const ticket = await request(app)
      .post("/api/tickets")
      .send({
        title: "Track note activity",
        description: "",
        status: "todo",
        priority: "medium",
        labelIds: []
      })
      .expect(201);

    const createdNote = await request(app)
      .post(`/api/tickets/${ticket.body.id}/notes`)
      .send({ body: "Following up with implementation details." })
      .expect(201);

    expect(createdNote.body.authorName).toBe("Local user");
    expect(createdNote.body.authorType).toBe("user");

    const detail = await request(app).get(`/api/tickets/${ticket.body.id}`).expect(200);
    expect(detail.body.notes).toHaveLength(1);
    expect(detail.body.notes[0].body).toContain("implementation details");
    expect(detail.body.updatedAt).toBe(createdNote.body.createdAt);
  });

  it("supports partial ticket updates through the app API", async () => {
    const ticket = await request(app)
      .post("/api/tickets")
      .send({
        title: "Patch current status only",
        description: "Keep the rest of the fields untouched.",
        status: "todo",
        priority: "medium",
        labelIds: []
      })
      .expect(201);

    const updated = await request(app)
      .patch(`/api/tickets/${ticket.body.id}`)
      .send({ status: "in_progress" })
      .expect(200);

    expect(updated.body.status).toBe("in_progress");
    expect(updated.body.title).toBe("Patch current status only");
    expect(updated.body.priority).toBe("medium");
    expect(updated.body.description).toBe("Keep the rest of the fields untouched.");
  });

  it("rejects invalid enum values", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send({
        title: "Broken request",
        description: "",
        status: "blocked",
        priority: "medium",
        labelIds: []
      })
      .expect(400);

    expect(response.body.message).toBe("Invalid request payload.");
  });

  it("returns tickets sorted by priority", async () => {
    await request(app)
      .post("/api/tickets")
      .send({
        title: "Medium task",
        description: "",
        status: "todo",
        priority: "medium",
        labelIds: []
      })
      .expect(201);

    await request(app)
      .post("/api/tickets")
      .send({
        title: "Urgent task",
        description: "",
        status: "todo",
        priority: "urgent",
        labelIds: []
      })
      .expect(201);

    const response = await request(app)
      .get("/api/tickets")
      .query({ sort: "priority_desc" })
      .expect(200);

    expect(response.body.map((ticket: { priority: string }) => ticket.priority)).toEqual([
      "urgent",
      "medium"
    ]);
  });

  it("creates projects and scopes internal ticket queries by project", async () => {
    const defaultTicket = await request(app)
      .post("/api/tickets")
      .send({
        title: "Default work",
        description: "",
        status: "todo",
        priority: "medium",
        labelIds: []
      })
      .expect(201);

    expect(defaultTicket.body.ticketNumber).toBe("APP-1");

    const projectResponse = await request(app)
      .post("/api/projects")
      .send({ name: "Docs", slug: "docs" })
      .expect(201);

    expect(projectResponse.body.slug).toBe("docs");

    const created = await request(app)
      .post("/api/tickets")
      .send({
        project: "docs",
        title: "Docs work",
        description: "",
        status: "todo",
        priority: "medium",
        labelIds: []
      })
      .expect(201);

    expect(created.body.projectSlug).toBe("docs");
    expect(created.body.ticketNumber).toBe("APP-1");

    const defaultList = await request(app)
      .get("/api/tickets")
      .query({ project: "default" })
      .expect(200);

    const docsList = await request(app)
      .get("/api/tickets")
      .query({ project: "docs" })
      .expect(200);

    expect(defaultList.body).toHaveLength(1);
    expect(docsList.body).toHaveLength(1);
    expect(docsList.body[0].id).toBe(created.body.id);
  });

  it("updates project names and slugs", async () => {
    const created = await request(app)
      .post("/api/projects")
      .send({ name: "Docs", slug: "docs" })
      .expect(201);

    const updated = await request(app)
      .patch(`/api/projects/${created.body.id}`)
      .send({ name: "Guides", slug: "guides" })
      .expect(200);

    expect(updated.body.name).toBe("Guides");
    expect(updated.body.slug).toBe("guides");
    expect(repository.getProjectBySlug("docs")).toBeNull();
    expect(repository.getProjectBySlug("guides")).toEqual(
      expect.objectContaining({ id: created.body.id, name: "Guides" })
    );
  });

  it("rejects unknown project filters", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ project: "unknown-project" })
      .expect(400);

    expect(response.body.message).toBe("Project not found.");
  });
});
