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
  type Project,
  type ProjectInput,
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

const DEFAULT_PROJECT_NAME = "Default Project";
const DEFAULT_PROJECT_SLUG = "default";
const TICKET_NUMBER_PREFIX = "APP";

const labelInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/)
});

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(80).optional()
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

interface ProjectRow {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

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
  projectId: number;
  projectSlug: string;
  projectName: string;
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

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
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
    projectId: row.projectId,
    projectSlug: row.projectSlug,
    projectName: row.projectName,
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

function slugifyProjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      ticket_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'app',
      external_ref TEXT,
      status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')),
      priority TEXT NOT NULL CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
      UNIQUE (project_id, ticket_number)
    );

    CREATE TABLE IF NOT EXISTS project_ticket_sequences (
      project_id INTEGER PRIMARY KEY,
      next_ticket_number INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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

function ensureDefaultProject(db: SQLiteDatabase) {
  const existing = db
    .prepare("SELECT id FROM projects WHERE slug = ?")
    .get(DEFAULT_PROJECT_SLUG) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      INSERT OR IGNORE INTO project_ticket_sequences (project_id, next_ticket_number)
      VALUES (?, 1)
    `).run(existing.id);
    return existing.id;
  }

  const createdAt = nowTimestamp();
  const result = db
    .prepare(
      `
        INSERT INTO projects (name, slug, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `
    )
    .run(DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG, createdAt, createdAt);

  const projectId = Number(result.lastInsertRowid);
  db.prepare(`
    INSERT OR IGNORE INTO project_ticket_sequences (project_id, next_ticket_number)
    VALUES (?, 1)
  `).run(projectId);

  return projectId;
}

function ticketTableUsesGlobalTicketNumberConstraint(sql: string | null) {
  return Boolean(sql?.match(/ticket_number\s+TEXT\s+UNIQUE/i));
}

function rebuildTicketTable(
  db: SQLiteDatabase,
  defaultProjectId: number,
  options: { hasProjectId: boolean; hasSource: boolean; hasExternalRef: boolean }
) {
  const restoreForeignKeys = () => db.pragma("foreign_keys = ON");
  db.pragma("foreign_keys = OFF");

  const projectIdExpression = options.hasProjectId ? "COALESCE(project_id, ?)" : "?";
  const sourceExpression = options.hasSource ? "COALESCE(source, 'app')" : "'app'";
  const externalRefExpression = options.hasExternalRef ? "external_ref" : "NULL";

  try {
    db.exec(`
      CREATE TABLE tickets_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        ticket_number TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'app',
        external_ref TEXT,
        status TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')),
        priority TEXT NOT NULL CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
        UNIQUE (project_id, ticket_number)
      );
    `);

    db.prepare(
      `
        INSERT INTO tickets_new (
          id,
          project_id,
          ticket_number,
          title,
          description,
          source,
          external_ref,
          status,
          priority,
          created_at,
          updated_at
        )
        SELECT
          id,
          ${projectIdExpression},
          ticket_number,
          title,
          description,
          ${sourceExpression},
          ${externalRefExpression},
          status,
          priority,
          created_at,
          updated_at
        FROM tickets
      `
    ).run(defaultProjectId);

    db.exec(`
      DROP TABLE tickets;
      ALTER TABLE tickets_new RENAME TO tickets;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_project_source_external_ref
      ON tickets(project_id, source, external_ref)
      WHERE external_ref IS NOT NULL AND project_id IS NOT NULL;
    `);
  } finally {
    restoreForeignKeys();
  }
}

function migrateSchema(db: SQLiteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_ticket_sequences (
      project_id INTEGER PRIMARY KEY,
      next_ticket_number INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  const defaultProjectId = ensureDefaultProject(db);
  const columns = db.prepare("PRAGMA table_info(tickets)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  const ticketTableSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tickets'")
    .get() as { sql: string | null } | undefined;

  const needsTicketTableRebuild =
    ticketTableUsesGlobalTicketNumberConstraint(ticketTableSql?.sql ?? null) ||
    !columnNames.has("project_id") ||
    !columnNames.has("source") ||
    !columnNames.has("external_ref");

  if (needsTicketTableRebuild) {
    rebuildTicketTable(db, defaultProjectId, {
      hasProjectId: columnNames.has("project_id"),
      hasSource: columnNames.has("source"),
      hasExternalRef: columnNames.has("external_ref")
    });
  }

  if (!needsTicketTableRebuild && !columnNames.has("source")) {
    db.exec("ALTER TABLE tickets ADD COLUMN source TEXT NOT NULL DEFAULT 'app'");
  }

  if (!needsTicketTableRebuild && !columnNames.has("external_ref")) {
    db.exec("ALTER TABLE tickets ADD COLUMN external_ref TEXT");
  }

  if (!needsTicketTableRebuild && !columnNames.has("project_id")) {
    db.exec("ALTER TABLE tickets ADD COLUMN project_id INTEGER REFERENCES projects(id)");
  }

  db.prepare("UPDATE tickets SET project_id = ? WHERE project_id IS NULL").run(defaultProjectId);
  db.exec(`
    INSERT INTO project_ticket_sequences (project_id, next_ticket_number)
    SELECT
      p.id,
      COALESCE(
        (
          SELECT MAX(CAST(SUBSTR(t.ticket_number, 5) AS INTEGER))
          FROM tickets t
          WHERE t.project_id = p.id
            AND t.ticket_number LIKE '${TICKET_NUMBER_PREFIX}-%'
        ),
        0
      ) + 1
    FROM projects p
    WHERE 1 = 1
    ON CONFLICT(project_id) DO UPDATE SET
      next_ticket_number = CASE
        WHEN excluded.next_ticket_number > next_ticket_number THEN excluded.next_ticket_number
        ELSE next_ticket_number
      END
  `);

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

    DROP INDEX IF EXISTS idx_tickets_source_external_ref;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_project_source_external_ref
    ON tickets(project_id, source, external_ref)
    WHERE external_ref IS NOT NULL AND project_id IS NOT NULL;
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
  const insertProject = db.prepare(`
    INSERT INTO projects (name, slug, created_at, updated_at)
    VALUES (@name, @slug, @createdAt, @updatedAt)
  `);
  const insertProjectTicketSequence = db.prepare(`
    INSERT INTO project_ticket_sequences (project_id, next_ticket_number)
    VALUES (@projectId, @nextTicketNumber)
  `);
  const updateProjectRecord = db.prepare(`
    UPDATE projects
    SET name = @name,
        slug = @slug,
        updated_at = @updatedAt
    WHERE id = @id
  `);
  const insertTicket = db.prepare(`
    INSERT INTO tickets (project_id, ticket_number, title, description, source, external_ref, status, priority, created_at, updated_at)
    VALUES (@projectId, @ticketNumber, @title, @description, @source, @externalRef, @status, @priority, @createdAt, @updatedAt)
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
  const touchTicketRecord = db.prepare(`
    UPDATE tickets
    SET updated_at = ?
    WHERE id = ?
  `);
  const reserveTicketNumber = db.prepare(`
    UPDATE project_ticket_sequences
    SET next_ticket_number = next_ticket_number + 1
    WHERE project_id = ?
    RETURNING next_ticket_number - 1 AS ticketNumber
  `);
  const initializeTicketSequence = db.prepare(`
    INSERT INTO project_ticket_sequences (project_id, next_ticket_number)
    SELECT ?, COALESCE(MAX(CAST(SUBSTR(ticket_number, 5) AS INTEGER)), 0) + 1
    FROM tickets
    WHERE project_id = ?
    ON CONFLICT(project_id) DO UPDATE SET
      next_ticket_number = CASE
        WHEN excluded.next_ticket_number > next_ticket_number THEN excluded.next_ticket_number
        ELSE next_ticket_number
      END
  `);
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

  function getProjectRowBySlug(slug: string) {
    return db
      .prepare(
        `
          SELECT
            id,
            name,
            slug,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM projects
          WHERE slug = ?
        `
      )
      .get(slug) as ProjectRow | undefined;
  }

  function getProjectRowById(id: number) {
    return db
      .prepare(
        `
          SELECT
            id,
            name,
            slug,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM projects
          WHERE id = ?
        `
      )
      .get(id) as ProjectRow | undefined;
  }

  function getDefaultProject() {
    const project = getProjectRowBySlug(DEFAULT_PROJECT_SLUG);
    if (!project) {
      throw new Error("Project not found.");
    }

    return mapProject(project);
  }

  function requireProject(projectSlug?: string) {
    if (!projectSlug) {
      return getDefaultProject();
    }

    const project = getProjectRowBySlug(projectSlug);
    if (!project) {
      throw new Error("Project not found.");
    }

    return mapProject(project);
  }

  function resolveProjectGuard(projectSlug?: string) {
    if (!projectSlug) {
      return null;
    }

    const project = getProjectRowBySlug(projectSlug);
    return project ? mapProject(project) : null;
  }

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

  function getTicketRow(id: number, projectSlug?: string) {
    const conditions = ["t.id = ?"];
    const params: Array<number | string> = [id];

    if (projectSlug) {
      conditions.push("p.slug = ?");
      params.push(projectSlug);
    }

    return db
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
            p.id AS projectId,
            p.slug AS projectSlug,
            p.name AS projectName,
            COALESCE(group_concat(tl.label_id), '') AS labelIds
          FROM tickets t
          INNER JOIN projects p ON p.id = t.project_id
          LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
          WHERE ${conditions.join(" AND ")}
          GROUP BY t.id
        `
      )
      .get(...params) as TicketRow | undefined;
  }

  return {
    listProjects(): Project[] {
      const rows = db
        .prepare(
          `
            SELECT
              id,
              name,
              slug,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM projects
            ORDER BY name COLLATE NOCASE ASC, id ASC
          `
        )
        .all() as ProjectRow[];

      return rows.map(mapProject);
    },

    getProjectBySlug(slug: string): Project | null {
      const row = getProjectRowBySlug(slug);
      return row ? mapProject(row) : null;
    },

    createProject(input: ProjectInput): Project {
      const parsed = projectInputSchema.parse(input);
      const slug = slugifyProjectName(parsed.slug ?? parsed.name);

      if (!slug) {
        throw new Error("Project slug cannot be empty.");
      }

      const createdAt = nowTimestamp();
      const createProjectRecord = db.transaction(() => {
        const result = insertProject.run({
          name: parsed.name,
          slug,
          createdAt,
          updatedAt: createdAt
        });

        insertProjectTicketSequence.run({
          projectId: Number(result.lastInsertRowid),
          nextTicketNumber: 1
        });

        return db
          .prepare(
            `
              SELECT
                id,
                name,
                slug,
                created_at AS createdAt,
                updated_at AS updatedAt
              FROM projects
              WHERE id = ?
            `
          )
          .get(result.lastInsertRowid) as Project;
      });

      try {
        return createProjectRecord();
      } catch (error) {
        if (error instanceof Error && error.message.includes("projects.slug")) {
          throw new Error("Project slug already exists.");
        }

        throw error;
      }
    },

    updateProject(id: number, input: ProjectInput): Project | null {
      const current = getProjectRowById(id);

      if (!current) {
        return null;
      }

      const parsed = projectInputSchema.parse(input);
      const requestedSlug = parsed.slug ? slugifyProjectName(parsed.slug) : undefined;

      if (current.slug === DEFAULT_PROJECT_SLUG && requestedSlug && requestedSlug !== DEFAULT_PROJECT_SLUG) {
        throw new Error("Default project slug cannot be changed.");
      }

      const slug =
        current.slug === DEFAULT_PROJECT_SLUG
          ? DEFAULT_PROJECT_SLUG
          : slugifyProjectName(parsed.slug ?? parsed.name);

      if (!slug) {
        throw new Error("Project slug cannot be empty.");
      }

      try {
        updateProjectRecord.run({
          id,
          name: parsed.name,
          slug,
          updatedAt: nowTimestamp()
        });

        return mapProject(getProjectRowById(id)!);
      } catch (error) {
        if (error instanceof Error && error.message.includes("projects.slug")) {
          throw new Error("Project slug already exists.");
        }

        throw error;
      }
    },

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

      if (query.project) {
        const project = this.getProjectBySlug(query.project);
        if (!project) {
          throw new Error("Project not found.");
        }

        conditions.push("p.slug = ?");
        params.push(query.project);
      }

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
              p.id AS projectId,
              p.slug AS projectSlug,
              p.name AS projectName,
              COALESCE(group_concat(tl.label_id), '') AS labelIds
            FROM tickets t
            INNER JOIN projects p ON p.id = t.project_id
            LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
            ${whereClause}
            GROUP BY t.id
            ORDER BY ${orderByClause}
          `
        )
        .all(...params) as TicketRow[];

      return rows.map(mapTicketSummary);
    },

    getTicket(id: number, options: { project?: string } = {}): Ticket | null {
      const row = getTicketRow(id, options.project);
      return row ? mapTicket(row) : null;
    },

    getTicketDetail(id: number, options: { project?: string } = {}): TicketDetail | null {
      const row = getTicketRow(id, options.project);
      return row ? mapTicketDetail(row, listTicketNotes(id)) : null;
    },

    createTicket(
      input: TicketInput,
      meta: { source?: string; externalRef?: string | null; project?: string } = {}
    ): Ticket {
      const data = ticketInputSchema.parse(input);
      assertLabelIdsExist(data.labelIds);
      const project = requireProject(meta.project);
      const source = meta.source?.trim() || "app";
      const externalRef = meta.externalRef?.trim() || null;
      const createdAt = nowTimestamp();

      const runInsert = db.transaction((payload: TicketInput) => {
        initializeTicketSequence.run(project.id, project.id);
        const sequenceRow = reserveTicketNumber.get(project.id) as { ticketNumber: number } | undefined;

        if (!sequenceRow) {
          throw new Error("Unable to allocate ticket number.");
        }

        const result = insertTicket.run({
          projectId: project.id,
          ticketNumber: `${TICKET_NUMBER_PREFIX}-${sequenceRow.ticketNumber}`,
          ...payload,
          source,
          externalRef,
          createdAt,
          updatedAt: createdAt
        });

        const ticketId = Number(result.lastInsertRowid);
        replaceTicketLabels(ticketId, payload.labelIds);
        return ticketId;
      });

      const ticketId = runInsert(data);
      return this.getTicket(ticketId)!;
    },

    updateTicket(id: number, input: TicketInput, options: { project?: string } = {}): Ticket | null {
      const current = this.getTicket(id, options);
      if (!current) {
        return null;
      }

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

    patchTicket(
      id: number,
      input: Partial<TicketInput>,
      options: { project?: string } = {}
    ): Ticket | null {
      const current = this.getTicket(id, options);

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

      return this.updateTicket(id, next, options);
    },

    getTicketByExternalRef(
      source: string,
      externalRef: string,
      projectSlug?: string
    ): TicketDetail | null {
      const project = requireProject(projectSlug);
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
              p.id AS projectId,
              p.slug AS projectSlug,
              p.name AS projectName,
              COALESCE(group_concat(tl.label_id), '') AS labelIds
            FROM tickets t
            INNER JOIN projects p ON p.id = t.project_id
            LEFT JOIN ticket_labels tl ON tl.ticket_id = t.id
            WHERE t.project_id = ? AND t.source = ? AND t.external_ref = ?
            GROUP BY t.id
          `
        )
        .get(project.id, source, externalRef) as TicketRow | undefined;

      return row ? mapTicketDetail(row, listTicketNotes(row.id)) : null;
    },

    createOrGetTicketByExternalRef(
      input: TicketInput,
      meta: { source: string; externalRef?: string | null; project?: string }
    ): { ticket: TicketDetail; created: boolean } {
      const project = requireProject(meta.project);
      const source = meta.source.trim() || "agent";
      const externalRef = meta.externalRef?.trim() || null;

      if (externalRef) {
        const existing = this.getTicketByExternalRef(source, externalRef, project.slug);
        if (existing) {
          return { ticket: existing, created: false };
        }
      }

      const created = this.createTicket(input, { source, externalRef, project: project.slug });
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
      input: { body: string; authorName: string; authorType: TicketActorType },
      options: { project?: string } = {}
    ): TicketNote | null {
      const ticket = this.getTicket(ticketId, options);

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
      touchTicketRecord.run(createdAt, ticketId);

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

    deleteTicket(id: number, options: { project?: string } = {}): boolean {
      if (options.project && !resolveProjectGuard(options.project)) {
        return false;
      }

      const ticket = this.getTicket(id, options);
      if (!ticket) {
        return false;
      }

      const result = db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
      return result.changes > 0;
    },

    close() {
      db.close();
    }
  };
}
