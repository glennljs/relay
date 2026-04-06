import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";

describe("local persistence smoke", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-smoke-"));
    dbPath = path.join(tempDir, "app.db");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("retains created tickets across app reloads", async () => {
    const firstApp = createApp({ dbPath });
    const labelId = firstApp.repository.listLabels()[0].id;

    const created = await request(firstApp.app)
      .post("/api/tickets")
      .send({
        title: "Persist after restart",
        description: "Ensure SQLite survives a reboot",
        status: "todo",
        priority: "urgent",
        labelIds: [labelId]
      })
      .expect(201);

    firstApp.repository.close();

    const secondApp = createApp({ dbPath });
    const listed = await request(secondApp.app).get("/api/tickets").expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].ticketNumber).toBe(created.body.ticketNumber);
    secondApp.repository.close();
  });
});
