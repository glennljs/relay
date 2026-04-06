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

    await request(app).delete(`/api/tickets/${ticketResponse.body.id}`).expect(204);
    await request(app).get(`/api/tickets/${ticketResponse.body.id}`).expect(404);
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
});
