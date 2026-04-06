import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createRelayMcpClient } from "./api.js";
import { ticketActorTypes, ticketPriorities, ticketSortOptions, ticketStatuses } from "../../shared/types.js";

const relay = createRelayMcpClient({
  apiBaseUrl: process.env.RELAY_API_URL
});

function textResult(text: string, structuredContent?: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: structuredContent as Record<string, unknown> | undefined
  };
}

function summarizeTicket(ticketNumber: string, title: string, status: string, priority: string) {
  return `${ticketNumber}: ${title} [${status}, ${priority}]`;
}

export function createRelayMcpServer() {
  const server = new McpServer(
    {
      name: "relay-tasks",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  server.registerTool(
    "relay_list_projects",
    {
      title: "List Relay Projects",
      description: "List the projects available in the Relay Tasks app.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        projects: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            slug: z.string(),
            createdAt: z.string(),
            updatedAt: z.string()
          })
        )
      })
    },
    async () => {
      const projects = await relay.listProjects();
      const summary =
        projects.length > 0
          ? projects.map((project) => `${project.slug}: ${project.name}`).join("\n")
          : "No projects found.";

      return textResult(summary, { projects });
    }
  );

  server.registerTool(
    "relay_list_labels",
    {
      title: "List Relay Labels",
      description: "List the labels available in the Relay Tasks app.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        labels: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            color: z.string()
          })
        )
      })
    },
    async () => {
      const labels = await relay.listLabels();
      const summary =
        labels.length > 0
          ? labels.map((label) => `${label.id}: ${label.name} (${label.color})`).join("\n")
          : "No labels found.";

      return textResult(summary, { labels });
    }
  );

  server.registerTool(
    "relay_list_tickets",
    {
      title: "List Relay Tickets",
      description: "Search or filter tickets in the Relay Tasks app.",
      inputSchema: z.object({
        project: z.string().trim().min(1).optional(),
        status: z.enum(ticketStatuses).optional(),
        priority: z.enum(ticketPriorities).optional(),
        sort: z.enum(ticketSortOptions).optional(),
        label: z.number().int().positive().optional(),
        q: z.string().trim().min(1).optional(),
        source: z.string().trim().min(1).optional(),
        externalRef: z.string().trim().min(1).optional()
      }),
      outputSchema: z.object({
        tickets: z.array(
          z.object({
            id: z.number(),
            ticketNumber: z.string(),
            title: z.string(),
            status: z.enum(ticketStatuses),
            priority: z.enum(ticketPriorities),
            createdAt: z.string(),
            updatedAt: z.string(),
            projectId: z.number(),
            projectSlug: z.string(),
            projectName: z.string(),
            labelIds: z.array(z.number())
          })
        )
      })
    },
    async (input) => {
      const tickets = await relay.listTickets(input);
      const summary =
        tickets.length > 0
          ? tickets
              .map((ticket) =>
                `${summarizeTicket(ticket.ticketNumber, ticket.title, ticket.status, ticket.priority)} @${ticket.projectSlug}`
              )
              .join("\n")
          : "No tickets found.";

      return textResult(summary, { tickets });
    }
  );

  server.registerTool(
    "relay_get_ticket",
    {
      title: "Get Relay Ticket",
      description: "Fetch a ticket with its notes from the Relay Tasks app.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        project: z.string().trim().min(1).optional()
      }),
      outputSchema: z.object({
        ticket: z.object({
          id: z.number(),
          ticketNumber: z.string(),
          title: z.string(),
          description: z.string(),
          status: z.enum(ticketStatuses),
          priority: z.enum(ticketPriorities),
          createdAt: z.string(),
          updatedAt: z.string(),
          projectId: z.number(),
          projectSlug: z.string(),
          projectName: z.string(),
          labelIds: z.array(z.number()),
          source: z.string(),
          externalRef: z.string().nullable(),
          notes: z.array(
            z.object({
              id: z.number(),
              ticketId: z.number(),
              body: z.string(),
              authorName: z.string(),
              authorType: z.enum(ticketActorTypes),
              createdAt: z.string()
            })
          )
        })
      })
    },
    async (input) => {
      const ticket = await relay.getTicket(input);
      const noteSummary = ticket.notes.length > 0 ? `${ticket.notes.length} notes` : "no notes";

      return textResult(
        `${summarizeTicket(ticket.ticketNumber, ticket.title, ticket.status, ticket.priority)} @${ticket.projectSlug}; ${noteSummary}`,
        { ticket }
      );
    }
  );

  server.registerTool(
    "relay_create_ticket",
    {
      title: "Create Relay Ticket",
      description:
        "Create a ticket in Relay Tasks. When project, source, and externalRef are provided, creation is idempotent within that project.",
      inputSchema: z.object({
        project: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(140),
        description: z.string().trim().max(5000).optional(),
        status: z.enum(ticketStatuses).optional(),
        priority: z.enum(ticketPriorities).optional(),
        labelIds: z.array(z.number().int().positive()).optional(),
        source: z.string().trim().min(1).max(80).optional(),
        externalRef: z.string().trim().min(1).max(200).optional(),
        note: z.string().trim().min(1).max(4000).optional(),
        actorName: z.string().trim().min(1).max(80).optional()
      }),
      outputSchema: z.object({
        created: z.boolean(),
        ticket: z.object({
          id: z.number(),
          ticketNumber: z.string(),
          title: z.string(),
          description: z.string(),
          status: z.enum(ticketStatuses),
          priority: z.enum(ticketPriorities),
          createdAt: z.string(),
          updatedAt: z.string(),
          projectId: z.number(),
          projectSlug: z.string(),
          projectName: z.string(),
          labelIds: z.array(z.number()),
          source: z.string(),
          externalRef: z.string().nullable(),
          notes: z.array(
            z.object({
              id: z.number(),
              ticketId: z.number(),
              body: z.string(),
              authorName: z.string(),
              authorType: z.enum(ticketActorTypes),
              createdAt: z.string()
            })
          )
        })
      })
    },
    async (input) => {
      const result = await relay.createTicket(input);
      const verb = result.created ? "Created" : "Reused";

      return textResult(
        `${verb} ${summarizeTicket(
          result.ticket.ticketNumber,
          result.ticket.title,
          result.ticket.status,
          result.ticket.priority
        )} @${result.ticket.projectSlug}`,
        result
      );
    }
  );

  server.registerTool(
    "relay_update_ticket",
    {
      title: "Update Relay Ticket",
      description:
        "Update ticket fields and optionally append an agent note in the Relay Tasks app.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        project: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1).max(140).optional(),
        description: z.string().trim().max(5000).optional(),
        status: z.enum(ticketStatuses).optional(),
        priority: z.enum(ticketPriorities).optional(),
        labelIds: z.array(z.number().int().positive()).optional(),
        note: z.string().trim().min(1).max(4000).optional(),
        actorName: z.string().trim().min(1).max(80).optional()
      }),
      outputSchema: z.object({
        ticket: z.object({
          id: z.number(),
          ticketNumber: z.string(),
          title: z.string(),
          description: z.string(),
          status: z.enum(ticketStatuses),
          priority: z.enum(ticketPriorities),
          createdAt: z.string(),
          updatedAt: z.string(),
          projectId: z.number(),
          projectSlug: z.string(),
          projectName: z.string(),
          labelIds: z.array(z.number()),
          source: z.string(),
          externalRef: z.string().nullable(),
          notes: z.array(
            z.object({
              id: z.number(),
              ticketId: z.number(),
              body: z.string(),
              authorName: z.string(),
              authorType: z.enum(ticketActorTypes),
              createdAt: z.string()
            })
          )
        })
      })
    },
    async (input) => {
      const ticket = await relay.updateTicket(input);

      return textResult(
        `Updated ${summarizeTicket(ticket.ticketNumber, ticket.title, ticket.status, ticket.priority)} @${ticket.projectSlug}`,
        { ticket }
      );
    }
  );

  server.registerTool(
    "relay_add_ticket_note",
    {
      title: "Add Relay Ticket Note",
      description: "Append a note to a ticket in the Relay Tasks app.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        project: z.string().trim().min(1).optional(),
        body: z.string().trim().min(1).max(4000),
        authorName: z.string().trim().min(1).max(80).optional(),
        authorType: z.enum(ticketActorTypes).optional()
      }),
      outputSchema: z.object({
        note: z.object({
          id: z.number(),
          ticketId: z.number(),
          body: z.string(),
          authorName: z.string(),
          authorType: z.enum(ticketActorTypes),
          createdAt: z.string()
        })
      })
    },
    async (input) => {
      const note = await relay.addTicketNote(input);
      return textResult(`Added note to ticket ${note.ticketId}`, { note });
    }
  );

  server.registerTool(
    "relay_delete_ticket",
    {
      title: "Delete Relay Ticket",
      description: "Delete a ticket from the Relay Tasks app.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        project: z.string().trim().min(1).optional()
      }),
      outputSchema: z.object({
        deleted: z.boolean(),
        id: z.number()
      })
    },
    async (input) => {
      await relay.deleteTicket(input);
      return textResult(`Deleted ticket ${input.id}`, { deleted: true, id: input.id });
    }
  );

  return server;
}

async function main() {
  const server = createRelayMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Relay Tasks MCP running on stdio for ${relay.apiBaseUrl}`);
}

main().catch((error) => {
  console.error("Fatal error in Relay Tasks MCP:", error);
  process.exit(1);
});
