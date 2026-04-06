import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";
import { createRelayMcpClient } from "../../server/mcp/api";

describe("relay MCP API client", () => {
  let tempDir: string;
  let repository: ReturnType<typeof createApp>["repository"];
  let httpServer: HttpServer;
  let origin: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-mcp-api-"));
    const created = createApp({ dbPath: path.join(tempDir, "app.db") });
    repository = created.repository;
    httpServer = createServer(created.app);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine test server address.");
    }

    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    repository.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts an origin-only RELAY_API_URL", async () => {
    const client = createRelayMcpClient({ apiBaseUrl: origin });

    const labels = await client.listLabels();
    expect(labels.length).toBeGreaterThan(0);

    const created = await client.createTicket({
      title: "Origin-only API base",
      source: "mcp-api-test",
      externalRef: "origin-only"
    });

    expect(created.created).toBe(true);

    const listed = await client.listTickets({
      source: "mcp-api-test",
      externalRef: "origin-only"
    });

    expect(listed).toHaveLength(1);
    expect(listed[0].ticketNumber).toBe("APP-1");
  });

  it("accepts an /api RELAY_API_URL", async () => {
    const client = createRelayMcpClient({ apiBaseUrl: `${origin}/api` });

    const created = await client.createTicket({
      title: "API path base",
      source: "mcp-api-test",
      externalRef: "api-base"
    });

    expect(created.created).toBe(true);

    const ticket = await client.getTicket(created.ticket.id);
    expect(ticket.externalRef).toBe("api-base");
  });

  it("deletes tickets through the public API client", async () => {
    const client = createRelayMcpClient({ apiBaseUrl: origin });

    const created = await client.createTicket({
      title: "Delete from MCP client",
      source: "mcp-api-test",
      externalRef: "delete-case"
    });

    await client.deleteTicket(created.ticket.id);

    await expect(client.getTicket(created.ticket.id)).rejects.toThrow("Ticket not found.");
  });
});
