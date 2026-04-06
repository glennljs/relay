import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";
import {
  ticketActorTypes,
  ticketPriorities,
  ticketStatuses,
  type Label,
  type LabelInput,
  type Ticket,
  type TicketActorType,
  type TicketDetail,
  type TicketInput,
  type TicketNote,
  type TicketPriority,
  type TicketQuery,
  type TicketSortOption,
  type TicketStatus,
  type TicketSummary
} from "../shared/types.js";

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

const ticketNoteInputSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  authorName: z.string().trim().min(1).max(80),
  authorType: z.enum(ticketActorTypes)
});

const defaultLabels: Array<Omit<Label, "id">> = [
  { name: "Platform", color: "#5B8CFF" },
  { name: "Product", color: "#14B8A6" },
  { name: "Design", color: "#F97316" }
];

type SQLiteDatabase = InstanceType<typeof Database>;

interface TicketRow {
  id: number;
  ticketNumber: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  source?: string;
  externalRef?: string | null;
  createdAt: string;
  updatedAt: string;
  labelIds: string;
}

interface TicketNoteRow {
  id: number;
  ticketId: number;
  body: string;
  authorName: string;
  authorType: TicketActorType;
  createdAt: string;
}

function toLabelIds(value: string): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .filter(Boolean)
    .map((item) => Number(item));
}

function mapTicketSummary(row: TicketRow): TicketSummary {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    title: row.title,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    labelIds: toLabelIds(row.labelIds)
  };
}

function mapTicket(row: TicketRow): Ticket {
  return {
    ...mapTicketSummary(row),
    description: row.description ?? ""
  };
}

function mapTicketNote(row: TicketNoteRow): TicketNote {
  return {
    id: row.id,
    ticketId: row.ticketId,
    body: row.body,
    authorName: row.authorName,
    authorType: row.authorType,
    createdAt: row.createdAt
  };
}

function mapTicketDetail(row: TicketRow, notes: TicketNote[]): TicketDetail {
  return {
    ...mapTicket(row),
    source: row.source ?? "app",
    externalRef: row.externalRef ?? null,
    notes
  };
}

function getTicketOrderByClause(sort: TicketSortOption | undefined) {
  if (sort === "priority_desc") {
    return `
      CASE t.priority
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC,
      t.updated_at DESC,
      t.id DESC
    `;
  }

  if (sort === "priority_asc") {
    return `
      CASE t.priority
        WHEN 'none' THEN 0
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'high' THEN 3
        ELSE 4
      END ASC,
      t.updated_at DESC,
      t.id DESC
    `;
  }

  return "t.updated_at DESC, t.id DESC";
}

function createSchema(db: SQLiteDatabase) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'app',
      external_ref TEXT,
      status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')),
      priority TEXT NOT NULL CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_labels (
      ticket_id INTEGER NOT NULL,
      label_id INTEGER NOT NULL,
      PRIMARY KEY (ticket_id, label_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ticket_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent', 'system')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );
  `);
}

function migrateSchema(db: SQLiteDatabase) {
  const columns = db.prepare("PRAGMA table_info(tickets)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("source")) {
    db.exec("ALTER TABLE tickets ADD COLUMN source TEXT NOT NULL DEFAULT 'app'");
  }

  if (!columnNames.has("external_ref")) {
    db.exec("ALTER TABLE tickets ADD COLUMN external_ref TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent', 'system')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_source_external_ref
    ON tickets(source, external_ref)
    WHERE external_ref IS NOT NULL;
  `);
}

function seedLabels(db: SQLiteDatabase) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM labels").get() as { count: number };

  if (count.count > 0) {
    return;
  }

  const insertLabel = db.prepare(
    "INSERT INTO labels (name, color) VALUES (@name, @color)"
  );
  const insertMany = db.transaction((labels: Array<Omit<Label, "id">>) => {
    for (const label of labels) {
      insertLabel.run(label);
    }
  });

  insertMany(defaultLabels);
}

function nowTimestamp() {
  return new Date().toISOString();
}

function ensureDirectory(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export function initializeDatabase(dbPath: string) {
  ensureDirectory(dbPath);
  const db = new Database(dbPath);
  createSchema(db);
  migrateSchema(db);
  seedLabels(db);
  return db;
}

export function createRepository(db: SQLiteDatabase) {
  const insertTicket = db.prepare(`
    INSERT INTO tickets (title, description, source, external_ref, status, priority, created_at, updated_at)
    VALUES (@title, @description, @source, @externalRef, @status, @priority, @createdAt, @updatedAt)
  `);

  const updateTicketRecord = db.prepare(`
    UPDATE tickets
    SET title = @title,
        description = @description,
        status = @status,
        priority = @priority,
        updated_at = @updatedAt
    WHERE id = @id
  `);

  const updateTicketNumber = db.prepare(
    "UPDATE tickets SET ticket_number = ? WHERE id = ?"
  );
  const insertTicketNote = db.prepare(`
    INSERT INTO ticket_notes (ticket_id, body, author_name, author_type, created_at)
    VALUES (@ticketId, @body, @authorName, @authorType, @createdAt)
  `);
  const removeTicketLabels = db.prepare("DELETE FROM ticket_labels WHERE ticket_id = ?");
  const insertTicketLabel = db.prepare(
    "INSERT INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)"
  );

  const replaceTicketLabels = db.transaction((ticketId: number, labelIds: number[]) => {
    removeTicketLabels.run(ticketId);
    for (const labelId of [...new Set(labelIds)]) {
      insertTicketLabel.run(ticketId, labelId);
    }
  });

  function assertLabelIdsExist(labelIds: number[]) {
    if (labelIds.length === 0) {
      return;
    }

    const placeholders = labelIds.map(() => "?").join(", ");
    const rows = db
      .prepare(`SELECT id FROM labels WHERE id IN (${placeholders})`)
      .all(...labelIds) as Array<{ id: number }>;

    if (rows.length !== new Set(labelIds).size) {
      throw new Error("One or more labels do not exist.");
    }
  }

  function listTicketNotes(ticketId: number): TicketNote[] {
    const rows = db
      .prepare(
        `
        SELECT
          id,
          ticket_id AS ticketId,
          body,
          author_name AS authorName,
          author_type AS authorType,
          created_at AS createdAt
        FROM ticket_notes
        WHERE ticket_id = ?
        ORDER BY created_at ASC, id ASC
      `
      )
      .all(ticketId) as TicketNoteRow[];

    return rows.map(mapTicketNote);
  }

  return {
    listLabels(): Label[] {
      return db
        .prepare("SELECT id, name, color FROM labels ORDER BY name COLLATE NOCASE ASC")
        .all() as Label[];
    },

    createLabel(input: LabelInput): Label {
      const data = labelInputSchema.parse(input);
      const result = db
        .prepare("INSERT INTO labels (name, color) VALUES (@name, @color)")
        .run(data);

      return db
        .prepare("SELECT id, name, color FROM labels WHERE id = ?")
        .get(result.lastInsertRowid) as Label;
    },

    updateLabel(id: number, input: LabelInput): Label | null {
      const data = labelInputSchema.parse(input);
      const result = db
        .prepare("UPDATE labels SET name = @name, color = @color WHERE id = @id")
        .run({ ...data, id });

      if (result.changes === 0) {
        return null;
      }

      return db.prepare("SELECT id, name, color FROM labels WHERE id = ?").get(id) as Label;
    },

    deleteLabel(id: number): boolean {
      const result = db.prepare("DELETE FROM labels WHERE id = ?").run(id);
      return result.changes > 0;
    },

    listTickets(query: TicketQuery = {}): TicketSummary[] {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query.status) {
        conditions.push("t.status = ?");
        params.push(query.status);
      }

      if (query.priority) {
        conditions.push("t.priority = ?");
        params.push(query.priority);
      }

      if (query.label) {
        conditions.push(
          "EXISTS (SELECT 1 FROM ticket_labels filter_tl WHERE filter_tl.ticket_id = t.id AND filter_tl.label_id = ?)"
        );
        params.push(query.label);
      }

      if (query.q) {
        conditions.push("(t.title LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ?)");
        const term = `%${query.q}%`;
        params.push(term, term, term);
      }

      if (query.source) {
        conditions.push("t.source = ?");
        params.push(query.source);
      }

      if (query.externalRef) {
        conditions.push("t.external_ref = ?");
        params.push(query.externalRef);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const orderByClause = getTicketOrderByClause(query.sort);
      const rows = db
        .prepare(
          `
          SELECT
            t.id,
            t.ticket_number AS ticketNumber,
            t.title,
            t.status,
            t.priority,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            COALESCE(group_concat(tl.label_id), '') AS labelIds
          FROM tickets t
          LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
          ${whereClause}
          GROUP BY t.id
          ORDER BY ${orderByClause}
        `
        )
        .all(...params) as TicketRow[];

      return rows.map(mapTicketSummary);
    },

    getTicket(id: number): Ticket | null {
      const row = db
        .prepare(
          `
          SELECT
            t.id,
            t.ticket_number AS ticketNumber,
            t.title,
            t.description,
            t.source,
            t.external_ref AS externalRef,
            t.status,
            t.priority,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            COALESCE(group_concat(tl.label_id), '') AS labelIds
          FROM tickets t
          LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
          WHERE t.id = ?
          GROUP BY t.id
        `
        )
        .get(id) as TicketRow | undefined;

      return row ? mapTicket(row) : null;
    },

    getTicketDetail(id: number): TicketDetail | null {
      const row = db
        .prepare(
          `
          SELECT
            t.id,
            t.ticket_number AS ticketNumber,
            t.title,
            t.description,
            t.source,
            t.external_ref AS externalRef,
            t.status,
            t.priority,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            COALESCE(group_concat(tl.label_id), '') AS labelIds
          FROM tickets t
          LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
          WHERE t.id = ?
          GROUP BY t.id
        `
        )
        .get(id) as TicketRow | undefined;

      return row ? mapTicketDetail(row, listTicketNotes(id)) : null;
    },

    createTicket(
      input: TicketInput,
      meta: { source?: string; externalRef?: string | null } = {}
    ): Ticket {
      const data = ticketInputSchema.parse(input);
      assertLabelIdsExist(data.labelIds);
      const source = meta.source?.trim() || "app";
      const externalRef = meta.externalRef?.trim() || null;

      const createdAt = nowTimestamp();
      const runInsert = db.transaction((payload: TicketInput) => {
        const result = insertTicket.run({
          ...payload,
          source,
          externalRef,
          createdAt,
          updatedAt: createdAt
        });

        const ticketId = Number(result.lastInsertRowid);
        updateTicketNumber.run(`APP-${ticketId}`, ticketId);
        replaceTicketLabels(ticketId, payload.labelIds);
        return ticketId;
      });

      const ticketId = runInsert(data);
      return this.getTicket(ticketId)!;
    },

    updateTicket(id: number, input: TicketInput): Ticket | null {
      const data = ticketInputSchema.parse(input);
      assertLabelIdsExist(data.labelIds);

      const runUpdate = db.transaction((ticketId: number, payload: TicketInput) => {
        const result = updateTicketRecord.run({
          ...payload,
          id: ticketId,
          updatedAt: nowTimestamp()
        });

        if (result.changes === 0) {
          return null;
        }

        replaceTicketLabels(ticketId, payload.labelIds);
        return ticketId;
      });

      const ticketId = runUpdate(id, data);
      return ticketId ? this.getTicket(ticketId) : null;
    },

    patchTicket(id: number, input: Partial<TicketInput>): Ticket | null {
      const current = this.getTicket(id);

      if (!current) {
        return null;
      }

      const next = ticketInputSchema.parse({
        title: input.title ?? current.title,
        description: input.description ?? current.description,
        status: input.status ?? current.status,
        priority: input.priority ?? current.priority,
        labelIds: input.labelIds ?? current.labelIds
      });

      return this.updateTicket(id, next);
    },

    getTicketByExternalRef(source: string, externalRef: string): TicketDetail | null {
      const row = db
        .prepare(
          `
          SELECT
            t.id,
            t.ticket_number AS ticketNumber,
            t.title,
            t.description,
            t.source,
            t.external_ref AS externalRef,
            t.status,
            t.priority,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt,
            COALESCE(group_concat(tl.label_id), '') AS labelIds
          FROM tickets t
          LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
          WHERE t.source = ? AND t.external_ref = ?
          GROUP BY t.id
        `
        )
        .get(source, externalRef) as TicketRow | undefined;

      return row ? mapTicketDetail(row, listTicketNotes(row.id)) : null;
    },

    createOrGetTicketByExternalRef(
      input: TicketInput,
      meta: { source: string; externalRef?: string | null }
    ): { ticket: TicketDetail; created: boolean } {
      const source = meta.source.trim() || "agent";
      const externalRef = meta.externalRef?.trim() || null;

      if (externalRef) {
        const existing = this.getTicketByExternalRef(source, externalRef);
        if (existing) {
          return { ticket: existing, created: false };
        }
      }

      const created = this.createTicket(input, { source, externalRef });
      return {
        ticket: this.getTicketDetail(created.id)!,
        created: true
      };
    },

    listTicketNotes(ticketId: number): TicketNote[] {
      return listTicketNotes(ticketId);
    },

    createTicketNote(
      ticketId: number,
      input: { body: string; authorName: string; authorType: TicketActorType }
    ): TicketNote | null {
      const ticket = this.getTicket(ticketId);

      if (!ticket) {
        return null;
      }

      const data = ticketNoteInputSchema.parse(input);
      const createdAt = nowTimestamp();
      const result = insertTicketNote.run({
        ticketId,
        ...data,
        createdAt
      });

      return db
        .prepare(
          `
          SELECT
            id,
            ticket_id AS ticketId,
            body,
            author_name AS authorName,
            author_type AS authorType,
            created_at AS createdAt
          FROM ticket_notes
          WHERE id = ?
        `
        )
        .get(result.lastInsertRowid) as TicketNote;
    },

    deleteTicket(id: number): boolean {
      const result = db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
      return result.changes > 0;
    },

    close() {
      db.close();
    }
  };
}
