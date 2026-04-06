import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type Server as HttpServer } from "node:http";
import { Client, StdioClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";

function getStringEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

describe("relay MCP server", () => {
  let tempDir: string;
  let repository: ReturnType<typeof createApp>["repository"];
  let httpServer: HttpServer;
  let apiBaseUrl: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-mcp-"));
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

    apiBaseUrl = `http://127.0.0.1:${address.port}/api/public/v1`;
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

  it("exposes Relay ticket tools over MCP stdio", async () => {
    repository.createProject({ name: "Second Project", slug: "second-project" });

    const client = new Client({
      name: "relay-mcp-test",
      version: "0.1.0"
    });

    const transport = new StdioClientTransport({
      command: path.join(process.cwd(), "node_modules", ".bin", "tsx"),
      args: ["server/mcp/index.ts"],
      cwd: process.cwd(),
      env: {
        ...getStringEnv(),
        RELAY_API_URL: apiBaseUrl
      },
      stderr: "pipe"
    });

    await client.connect(transport);

    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "relay_list_projects",
          "relay_list_labels",
          "relay_list_tickets",
          "relay_get_ticket",
          "relay_create_ticket",
          "relay_update_ticket",
          "relay_add_ticket_note",
          "relay_delete_ticket"
        ])
      );

      const projectsResult = await client.callTool({
        name: "relay_list_projects",
        arguments: {}
      });

      const projects = projectsResult.structuredContent as {
        projects: Array<{ slug: string }>;
      };

      expect(projects.projects).toEqual(
        expect.arrayContaining([expect.objectContaining({ slug: "default" })])
      );

      const createResult = await client.callTool({
        name: "relay_create_ticket",
        arguments: {
          project: "default",
          title: "Agent opened ticket",
          description: "Created through the MCP server.",
          source: "mcp-test",
          externalRef: "case-1",
          note: "Initial agent note.",
          actorName: "Test Agent"
        }
      });

      const created = createResult.structuredContent as {
        created: boolean;
        ticket: { id: number; ticketNumber: string; notes: Array<{ body: string }> };
      };

      expect(created.created).toBe(true);
      expect(created.ticket.ticketNumber).toBe("APP-1");
      expect(created.ticket.notes).toHaveLength(1);

      const secondCreateResult = await client.callTool({
        name: "relay_create_ticket",
        arguments: {
          project: "second-project",
          title: "Agent opened second project ticket",
          description: "Created through the MCP server.",
          source: "mcp-test",
          externalRef: "case-2",
          note: "Initial note for the second project.",
          actorName: "Test Agent"
        }
      });

      const secondCreated = secondCreateResult.structuredContent as {
        created: boolean;
        ticket: { id: number; ticketNumber: string };
      };

      expect(secondCreated.created).toBe(true);
      expect(secondCreated.ticket.ticketNumber).toBe("APP-1");

      const updateResult = await client.callTool({
        name: "relay_update_ticket",
        arguments: {
          id: created.ticket.id,
          project: "default",
          status: "in_progress",
          note: "Working on it.",
          actorName: "Test Agent"
        }
      });

      const updated = updateResult.structuredContent as {
        ticket: { status: string; notes: Array<{ body: string }> };
      };

      expect(updated.ticket.status).toBe("in_progress");
      expect(updated.ticket.notes).toHaveLength(2);

      const listResult = await client.callTool({
        name: "relay_list_tickets",
        arguments: {
          project: "default",
          source: "mcp-test",
          externalRef: "case-1"
        }
      });

      const listed = listResult.structuredContent as {
        tickets: Array<{ ticketNumber: string }>;
      };

      expect(listed.tickets).toHaveLength(1);
      expect(listed.tickets[0].ticketNumber).toBe("APP-1");

      const deleteResult = await client.callTool({
        name: "relay_delete_ticket",
        arguments: {
          id: created.ticket.id,
          project: "default"
        }
      });

      expect(deleteResult.structuredContent).toEqual({
        deleted: true,
        id: created.ticket.id
      });

      const emptyListResult = await client.callTool({
        name: "relay_list_tickets",
        arguments: {
          project: "default",
          source: "mcp-test",
          externalRef: "case-1"
        }
      });

      const emptyListed = emptyListResult.structuredContent as {
        tickets: Array<{ ticketNumber: string }>;
      };

      expect(emptyListed.tickets).toHaveLength(0);
    } finally {
      await client.close();
    }
  });
});
