import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { z, ZodError } from "zod";
import { createRepository, initializeDatabase } from "./db.js";
import { ticketActorTypes, ticketPriorities, ticketSortOptions, ticketStatuses } from "../shared/types.js";

const ticketFilterSchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  sort: z.enum(ticketSortOptions).optional(),
  label: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).optional()
});

const publicTicketFilterSchema = ticketFilterSchema.extend({
  source: z.string().trim().min(1).max(80).optional(),
  externalRef: z.string().trim().min(1).max(200).optional()
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const labelInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/)
});

const ticketInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(5000).default(""),
  status: z.enum(ticketStatuses),
  priority: z.enum(ticketPriorities),
  labelIds: z.array(z.number().int().positive()).default([])
});

const publicTicketCreateSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(5000).default(""),
  status: z.enum(ticketStatuses).default("backlog"),
  priority: z.enum(ticketPriorities).default("medium"),
  labelIds: z.array(z.number().int().positive()).default([]),
  source: z.string().trim().min(1).max(80).default("agent"),
  externalRef: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().min(1).max(4000).optional(),
  actorName: z.string().trim().min(1).max(80).default("Agent")
});

const publicTicketPatchSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  labelIds: z.array(z.number().int().positive()).optional(),
  note: z.string().trim().min(1).max(4000).optional(),
  actorName: z.string().trim().min(1).max(80).default("Agent")
});

const publicTicketNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  authorName: z.string().trim().min(1).max(80).default("Agent"),
  authorType: z.enum(ticketActorTypes).default("agent")
});

function createPublicOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Relay Tasks Public Agent API",
      version: "1.0.0",
      description: "API for agents to create, update, search, annotate, and delete tickets."
    },
    paths: {
      "/api/public/v1/tickets": {
        get: {
          summary: "List tickets",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ticketStatuses } },
            { name: "priority", in: "query", schema: { type: "string", enum: ticketPriorities } },
            { name: "sort", in: "query", schema: { type: "string", enum: ticketSortOptions } },
            { name: "label", in: "query", schema: { type: "integer" } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "source", in: "query", schema: { type: "string" } },
            { name: "externalRef", in: "query", schema: { type: "string" } }
          ]
        },
        post: {
          summary: "Create a ticket",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicTicketCreate" }
              }
            }
          }
        }
      },
      "/api/public/v1/tickets/{id}": {
        get: {
          summary: "Fetch a ticket with notes",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }]
        },
        patch: {
          summary: "Update a ticket or append an agent note",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicTicketPatch" }
              }
            }
          }
        },
        delete: {
          summary: "Delete a ticket",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }]
        }
      },
      "/api/public/v1/tickets/{id}/notes": {
        post: {
          summary: "Append a note to a ticket",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TicketNoteCreate" }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        PublicTicketCreate: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ticketStatuses },
            priority: { type: "string", enum: ticketPriorities },
            labelIds: { type: "array", items: { type: "integer" } },
            source: { type: "string" },
            externalRef: { type: "string" },
            note: { type: "string" },
            actorName: { type: "string" }
          }
        },
        PublicTicketPatch: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ticketStatuses },
            priority: { type: "string", enum: ticketPriorities },
            labelIds: { type: "array", items: { type: "integer" } },
            note: { type: "string" },
            actorName: { type: "string" }
          }
        },
        TicketNoteCreate: {
          type: "object",
          required: ["body"],
          properties: {
            body: { type: "string" },
            authorName: { type: "string" },
            authorType: { type: "string", enum: ticketActorTypes }
          }
        }
      }
    }
  };
}

export interface AppOptions {
  dbPath: string;
  clientDistPath?: string;
}

export function createApp(options: AppOptions) {
  const db = initializeDatabase(options.dbPath);
  const repository = createRepository(db);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/labels", (_request, response) => {
    response.json(repository.listLabels());
  });

  app.post("/api/labels", (request, response) => {
    const label = repository.createLabel(labelInputSchema.parse(request.body));
    response.status(201).json(label);
  });

  app.patch("/api/labels/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const label = repository.updateLabel(id, labelInputSchema.parse(request.body));

    if (!label) {
      response.status(404).json({ message: "Label not found." });
      return;
    }

    response.json(label);
  });

  app.delete("/api/labels/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const deleted = repository.deleteLabel(id);

    if (!deleted) {
      response.status(404).json({ message: "Label not found." });
      return;
    }

    response.status(204).end();
  });

  app.get("/api/tickets", (request, response) => {
    const filters = ticketFilterSchema.parse(request.query);
    response.json(repository.listTickets(filters));
  });

  app.get("/api/tickets/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const ticket = repository.getTicket(id);

    if (!ticket) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    response.json(ticket);
  });

  app.post("/api/tickets", (request, response) => {
    const ticket = repository.createTicket(ticketInputSchema.parse(request.body));
    response.status(201).json(ticket);
  });

  app.patch("/api/tickets/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const ticket = repository.updateTicket(id, ticketInputSchema.parse(request.body));

    if (!ticket) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    response.json(ticket);
  });

  app.delete("/api/tickets/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const deleted = repository.deleteTicket(id);

    if (!deleted) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    response.status(204).end();
  });

  const publicApi = express.Router();

  publicApi.get("/openapi.json", (_request, response) => {
    response.json(createPublicOpenApiDocument());
  });

  publicApi.get("/tickets", (request, response) => {
    const filters = publicTicketFilterSchema.parse(request.query);
    response.json(repository.listTickets(filters));
  });

  publicApi.get("/tickets/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const ticket = repository.getTicketDetail(id);

    if (!ticket) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    response.json(ticket);
  });

  publicApi.post("/tickets", (request, response) => {
    const payload = publicTicketCreateSchema.parse(request.body);
    const result = repository.createOrGetTicketByExternalRef(
      {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        labelIds: payload.labelIds
      },
      {
        source: payload.source,
        externalRef: payload.externalRef
      }
    );

    if (payload.note && result.created) {
      repository.createTicketNote(result.ticket.id, {
        body: payload.note,
        authorName: payload.actorName,
        authorType: "agent"
      });
    }

    const ticket = repository.getTicketDetail(result.ticket.id)!;
    response.status(result.created ? 201 : 200).json({
      created: result.created,
      ticket
    });
  });

  publicApi.patch("/tickets/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const payload = publicTicketPatchSchema.parse(request.body);
    const hasTicketChanges =
      payload.title !== undefined ||
      payload.description !== undefined ||
      payload.status !== undefined ||
      payload.priority !== undefined ||
      payload.labelIds !== undefined;

    if (!hasTicketChanges && !payload.note) {
      response.status(400).json({
        message: "Provide at least one ticket field or a note."
      });
      return;
    }

    if (hasTicketChanges) {
      const updated = repository.patchTicket(id, {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        labelIds: payload.labelIds
      });

      if (!updated) {
        response.status(404).json({ message: "Ticket not found." });
        return;
      }
    } else if (!repository.getTicket(id)) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    if (payload.note) {
      repository.createTicketNote(id, {
        body: payload.note,
        authorName: payload.actorName,
        authorType: "agent"
      });
    }

    response.json(repository.getTicketDetail(id));
  });

  publicApi.delete("/tickets/:id", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const deleted = repository.deleteTicket(id);

    if (!deleted) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    response.status(204).end();
  });

  publicApi.post("/tickets/:id/notes", (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const note = repository.createTicketNote(id, publicTicketNoteSchema.parse(request.body));

    if (!note) {
      response.status(404).json({ message: "Ticket not found." });
      return;
    }

    response.status(201).json(note);
  });

  app.use("/api/public/v1", publicApi);

  if (options.clientDistPath && fs.existsSync(options.clientDistPath)) {
    app.use(express.static(options.clientDistPath));
    app.get("/{*path}", (_request, response) => {
      response.sendFile(path.join(options.clientDistPath!, "index.html"));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        message: "Invalid request payload.",
        issues: error.issues.map((issue) => issue.message)
      });
      return;
    }

    if (error instanceof Error && error.message.includes("labels")) {
      response.status(400).json({ message: error.message });
      return;
    }

    response.status(500).json({ message: "Unexpected server error." });
  });

  return { app, repository };
}
