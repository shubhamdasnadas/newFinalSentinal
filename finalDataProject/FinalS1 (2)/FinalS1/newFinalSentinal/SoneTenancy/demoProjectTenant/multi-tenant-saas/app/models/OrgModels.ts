/**
 * Per-organization models.
 * Each org has its OWN PostgreSQL database (saas_org_<slug>).
 * Tables no longer need an org_slug column — isolation is at the DB level.
 */
import { orgQuery } from "../lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  password?: string | null;
  role: "org_admin" | "org_user";
  department?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  status: "active" | "inactive" | "archived";
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Report {
  id: string;
  title: string;
  description?: string | null;
  type: "sales" | "finance" | "hr" | "operations" | "custom";
  data?: unknown;
  status: "draft" | "published" | "archived";
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  is_read: boolean;
  target_user?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  created_by?: string | null;
  assigned_to?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Billing {
  id: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  amount: number;
  currency: string;
  status: "active" | "past_due" | "cancelled";
  billing_date?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  invoice_ref: string;
  amount: number;
  date?: Date | null;
  status: string;
  created_at: Date;
}

export interface AnalyticsEvent {
  id: string;
  event: string;
  page?: string | null;
  user?: string | null;
  metadata?: unknown;
  created_at: Date;
}

// ─── OrgUser ──────────────────────────────────────────────────────────────────

export const OrgUserModel = {
  async findAll(orgSlug: string): Promise<Omit<OrgUser, "password">[]> {
    return orgQuery<Omit<OrgUser, "password">>(
      orgSlug,
      `SELECT id, name, email, role, department, is_active, created_at, updated_at
       FROM org_users ORDER BY created_at DESC`
    );
  },

  async findByEmail(orgSlug: string, email: string): Promise<OrgUser | null> {
    const rows = await orgQuery<OrgUser>(
      orgSlug,
      "SELECT * FROM org_users WHERE email = $1 LIMIT 1",
      [email.toLowerCase().trim()]
    );
    return rows[0] ?? null;
  },

  /**
   * Search across ALL active orgs — used during login.
   * Iterates org databases to find the user.
   */
  async findByEmailAcrossOrgs(
    email: string,
    orgSlugs: string[]
  ): Promise<(OrgUser & { org_slug: string }) | null> {
    for (const slug of orgSlugs) {
      try {
        const rows = await orgQuery<OrgUser>(
          slug,
          "SELECT * FROM org_users WHERE email = $1 LIMIT 1",
          [email.toLowerCase().trim()]
        );
        if (rows[0]) return { ...rows[0], org_slug: slug };
      } catch {
        // org DB might not exist yet — skip
      }
    }
    return null;
  },

  async findById(orgSlug: string, id: string): Promise<OrgUser | null> {
    const rows = await orgQuery<OrgUser>(
      orgSlug,
      "SELECT * FROM org_users WHERE id = $1 LIMIT 1",
      [id]
    );
    return rows[0] ?? null;
  },

  async countActive(orgSlug: string): Promise<number> {
    const rows = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM org_users WHERE is_active = TRUE"
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  },

  async findActiveRecent(orgSlug: string, limit = 5): Promise<Omit<OrgUser, "password">[]> {
    return orgQuery<Omit<OrgUser, "password">>(
      orgSlug,
      `SELECT id, name, email, role, department, is_active, created_at, updated_at
       FROM org_users WHERE is_active = TRUE
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
  },

  async create(data: {
    org_slug: string;
    name: string;
    email: string;
    password?: string;
    role?: string;
    department?: string;
    is_active?: boolean;
  }): Promise<OrgUser> {
    const rows = await orgQuery<OrgUser>(
      data.org_slug,
      `INSERT INTO org_users (name, email, password, role, department, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        data.name,
        data.email.toLowerCase().trim(),
        data.password ?? null,
        data.role ?? "org_user",
        data.department ?? null,
        data.is_active ?? true,
      ]
    );
    return rows[0];
  },

  async update(
    orgSlug: string,
    id: string,
    data: Partial<{ name: string; role: string; department: string; is_active: boolean }>
  ): Promise<OrgUser | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) { fields.push(`${key} = $${idx++}`); values.push(val); }
    }
    if (fields.length === 0) return this.findById(orgSlug, id);
    values.push(id);
    const rows = await orgQuery<OrgUser>(
      orgSlug,
      `UPDATE org_users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  },

  async deactivate(orgSlug: string, id: string): Promise<void> {
    await orgQuery(
      orgSlug,
      "UPDATE org_users SET is_active = FALSE WHERE id = $1",
      [id]
    );
  },
};

// ─── Project ──────────────────────────────────────────────────────────────────

export const ProjectModel = {
  async findAll(orgSlug: string): Promise<Project[]> {
    return orgQuery<Project>(
      orgSlug,
      "SELECT * FROM projects ORDER BY created_at DESC"
    );
  },

  async findRecent(orgSlug: string, limit = 5): Promise<Project[]> {
    return orgQuery<Project>(
      orgSlug,
      "SELECT * FROM projects ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
  },

  async count(orgSlug: string): Promise<number> {
    const rows = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM projects"
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  },

  async countByStatus(orgSlug: string, status: string): Promise<number> {
    const rows = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM projects WHERE status = $1",
      [status]
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  },

  async create(data: {
    org_slug: string;
    name: string;
    key: string;
    description?: string;
    status?: string;
    created_by?: string;
  }): Promise<Project> {
    const rows = await orgQuery<Project>(
      data.org_slug,
      `INSERT INTO projects (name, key, description, status, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        data.name,
        data.key,
        data.description ?? null,
        data.status ?? "active",
        data.created_by ?? null,
      ]
    );
    return rows[0];
  },
};

// ─── Report ───────────────────────────────────────────────────────────────────

export const ReportModel = {
  async findAll(orgSlug: string): Promise<Report[]> {
    return orgQuery<Report>(orgSlug, "SELECT * FROM reports ORDER BY created_at DESC");
  },

  async findById(orgSlug: string, id: string): Promise<Report | null> {
    const rows = await orgQuery<Report>(
      orgSlug,
      "SELECT * FROM reports WHERE id = $1 LIMIT 1",
      [id]
    );
    return rows[0] ?? null;
  },

  async create(data: {
    org_slug: string;
    title: string;
    description?: string;
    type?: string;
    data?: unknown;
    status?: string;
    created_by?: string;
  }): Promise<Report> {
    const rows = await orgQuery<Report>(
      data.org_slug,
      `INSERT INTO reports (title, description, type, data, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        data.title,
        data.description ?? null,
        data.type ?? "custom",
        data.data ? JSON.stringify(data.data) : null,
        data.status ?? "draft",
        data.created_by ?? null,
      ]
    );
    return rows[0];
  },

  async delete(orgSlug: string, id: string): Promise<void> {
    await orgQuery(orgSlug, "DELETE FROM reports WHERE id = $1", [id]);
  },
};

// ─── Notification ─────────────────────────────────────────────────────────────

export const NotificationModel = {
  async findForUser(orgSlug: string, userEmail: string): Promise<Notification[]> {
    return orgQuery<Notification>(
      orgSlug,
      `SELECT * FROM notifications
       WHERE target_user = $1 OR target_user = 'all'
       ORDER BY created_at DESC`,
      [userEmail]
    );
  },

  async create(data: {
    org_slug: string;
    title: string;
    message: string;
    type?: string;
    is_read?: boolean;
    target_user?: string;
  }): Promise<Notification> {
    const rows = await orgQuery<Notification>(
      data.org_slug,
      `INSERT INTO notifications (title, message, type, is_read, target_user)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        data.title,
        data.message,
        data.type ?? "info",
        data.is_read ?? false,
        data.target_user ?? "all",
      ]
    );
    return rows[0];
  },
};

// ─── SupportTicket ────────────────────────────────────────────────────────────

export const SupportTicketModel = {
  async findAll(orgSlug: string): Promise<SupportTicket[]> {
    return orgQuery<SupportTicket>(
      orgSlug,
      "SELECT * FROM support_tickets ORDER BY created_at DESC"
    );
  },

  async create(data: {
    org_slug: string;
    subject: string;
    description: string;
    status?: string;
    priority?: string;
    created_by?: string;
    assigned_to?: string;
  }): Promise<SupportTicket> {
    const rows = await orgQuery<SupportTicket>(
      data.org_slug,
      `INSERT INTO support_tickets (subject, description, status, priority, created_by, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        data.subject,
        data.description,
        data.status ?? "open",
        data.priority ?? "medium",
        data.created_by ?? null,
        data.assigned_to ?? null,
      ]
    );
    return rows[0];
  },
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export const BillingModel = {
  async findByOrg(orgSlug: string): Promise<(Billing & { invoices: Invoice[] }) | null> {
    const billingRows = await orgQuery<Billing>(
      orgSlug,
      "SELECT * FROM billing LIMIT 1"
    );
    if (!billingRows[0]) return null;

    const invoices = await orgQuery<Invoice>(
      orgSlug,
      "SELECT * FROM invoices ORDER BY date DESC"
    );
    return { ...billingRows[0], invoices };
  },

  async upsert(data: {
    org_slug: string;
    plan?: string;
    amount?: number;
    currency?: string;
    status?: string;
    billing_date?: Date;
  }): Promise<Billing> {
    // billing table has only one row per org DB — use id-based upsert
    const rows = await orgQuery<Billing>(
      data.org_slug,
      `INSERT INTO billing (plan, amount, currency, status, billing_date)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         plan = EXCLUDED.plan,
         amount = EXCLUDED.amount,
         currency = EXCLUDED.currency,
         status = EXCLUDED.status,
         billing_date = EXCLUDED.billing_date
       RETURNING *`,
      [
        data.plan ?? "free",
        data.amount ?? 0,
        data.currency ?? "USD",
        data.status ?? "active",
        data.billing_date ?? null,
      ]
    );
    // If no row existed, the INSERT above created one. If one existed, we need UPDATE.
    if (rows[0]) return rows[0];

    // Fallback: update the existing single row
    const existing = await orgQuery<Billing>(data.org_slug, "SELECT id FROM billing LIMIT 1");
    if (existing[0]) {
      const updated = await orgQuery<Billing>(
        data.org_slug,
        `UPDATE billing SET plan=$1, amount=$2, currency=$3, status=$4, billing_date=$5
         WHERE id=$6 RETURNING *`,
        [
          data.plan ?? "free",
          data.amount ?? 0,
          data.currency ?? "USD",
          data.status ?? "active",
          data.billing_date ?? null,
          existing[0].id,
        ]
      );
      return updated[0];
    }
    throw new Error("Billing upsert failed");
  },

  async createInvoice(data: {
    org_slug: string;
    invoice_ref: string;
    amount: number;
    date?: Date;
    status?: string;
  }): Promise<Invoice> {
    const rows = await orgQuery<Invoice>(
      data.org_slug,
      `INSERT INTO invoices (invoice_ref, amount, date, status)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.invoice_ref, data.amount, data.date ?? null, data.status ?? "pending"]
    );
    return rows[0];
  },
};

// ─── CheckpointEvent ──────────────────────────────────────────────────────────

export interface CheckpointEvent {
  id: string;
  event_id: string;
  customer_id?: string | null;
  type?: string | null;
  state?: string | null;
  severity?: string | null;
  confidence_indicator?: string | null;
  description?: string | null;
  sender_address?: string | null;
  saas?: string | null;
  entity_id?: string | null;
  entity_link?: string | null;
  event_created?: Date | null;
  actions?: unknown;
  additional_data?: unknown;
  raw: unknown;
  synced_at: Date;
}

export const CheckpointEventModel = {
  /** Ensure the table exists (safe to call on every sync) */
  async ensureTable(orgSlug: string): Promise<void> {
    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS checkpoint_events (
        id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id             TEXT        NOT NULL UNIQUE,
        customer_id          TEXT,
        type                 TEXT,
        state                TEXT,
        severity             TEXT,
        confidence_indicator TEXT,
        description          TEXT,
        sender_address       TEXT,
        saas                 TEXT,
        entity_id            TEXT,
        entity_link          TEXT,
        event_created        TIMESTAMPTZ,
        actions              JSONB,
        additional_data      JSONB,
        raw                  JSONB       NOT NULL,
        synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cp_events_type          ON checkpoint_events(type);
      CREATE INDEX IF NOT EXISTS idx_cp_events_state         ON checkpoint_events(state);
      CREATE INDEX IF NOT EXISTS idx_cp_events_event_created ON checkpoint_events(event_created);`
    );
  },

  /** Upsert a batch of raw events from the Checkpoint API */
  async upsertBatch(orgSlug: string, records: Record<string, unknown>[]): Promise<number> {
    if (records.length === 0) return 0;
    let upserted = 0;
    for (const r of records) {
      const eventId = (r.eventId ?? r.event_id ?? "") as string;
      if (!eventId) continue;
      await orgQuery(
        orgSlug,
        `INSERT INTO checkpoint_events
           (event_id, customer_id, type, state, severity, confidence_indicator,
            description, sender_address, saas, entity_id, entity_link,
            event_created, actions, additional_data, raw, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,NOW())
         ON CONFLICT (event_id) DO UPDATE SET
           state                = EXCLUDED.state,
           severity             = EXCLUDED.severity,
           confidence_indicator = EXCLUDED.confidence_indicator,
           description          = EXCLUDED.description,
           actions              = EXCLUDED.actions,
           additional_data      = EXCLUDED.additional_data,
           raw                  = EXCLUDED.raw,
           synced_at            = NOW()`,
        [
          eventId,
          (r.customerId ?? null) as string | null,
          (r.type ?? null) as string | null,
          (r.state ?? null) as string | null,
          (r.severity ?? null) as string | null,
          (r.confidenceIndicator ?? null) as string | null,
          (r.description ?? null) as string | null,
          (r.senderAddress ?? null) as string | null,
          (r.saas ?? null) as string | null,
          (r.entityId ?? null) as string | null,
          (r.entityLink ?? null) as string | null,
          (r.eventCreated ?? null) as string | null,
          r.actions ? JSON.stringify(r.actions) : null,
          r.additionalData ? JSON.stringify(r.additionalData) : null,
          JSON.stringify(r),
        ]
      );
      upserted++;
    }
    return upserted;
  },

  /** Fetch all events from DB, newest first */
  async findAll(orgSlug: string): Promise<CheckpointEvent[]> {
    return orgQuery<CheckpointEvent>(
      orgSlug,
      `SELECT * FROM checkpoint_events ORDER BY event_created DESC NULLS LAST`
    );
  },

  /** Count total events */
  async count(orgSlug: string): Promise<number> {
    const rows = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM checkpoint_events"
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  },

  /** Last sync time */
  async lastSyncedAt(orgSlug: string): Promise<Date | null> {
    const rows = await orgQuery<{ synced_at: Date }>(
      orgSlug,
      "SELECT synced_at FROM checkpoint_events ORDER BY synced_at DESC LIMIT 1"
    );
    return rows[0]?.synced_at ?? null;
  },
};

// ─── SentinelOne ─────────────────────────────────────────────────────────────

export const SentinelOneModel = {
  /** Ensure both tables exist (idempotent) */
  async ensureTables(orgSlug: string): Promise<void> {
    await orgQuery(orgSlug, `
      CREATE TABLE IF NOT EXISTS s1_threats (
        id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        data      JSONB       NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS s1_agents (
        id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        data      JSONB       NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  },

  async findAllThreats(orgSlug: string): Promise<unknown[]> {
    await this.ensureTables(orgSlug);
    const rows = await orgQuery<{ data: unknown }>(
      orgSlug,
      "SELECT data FROM s1_threats ORDER BY synced_at DESC"
    );
    return rows.map((r) => {
      if (typeof r.data === "string") {
        try { return JSON.parse(r.data); } catch { return r.data; }
      }
      return r.data;
    });
  },

  async findAllAgents(orgSlug: string): Promise<unknown[]> {
    await this.ensureTables(orgSlug);
    const rows = await orgQuery<{ data: unknown }>(
      orgSlug,
      "SELECT data FROM s1_agents ORDER BY synced_at DESC"
    );
    return rows.map((r) => {
      if (typeof r.data === "string") {
        try { return JSON.parse(r.data); } catch { return r.data; }
      }
      return r.data;
    });
  },

  async lastSyncedAt(orgSlug: string): Promise<Date | null> {
    await this.ensureTables(orgSlug);
    const rows = await orgQuery<{ synced_at: Date }>(
      orgSlug,
      "SELECT synced_at FROM s1_threats ORDER BY synced_at DESC LIMIT 1"
    );
    return rows[0]?.synced_at ?? null;
  },
};

export const AnalyticsModel = {
  async pageStats(orgSlug: string): Promise<{ _id: string; count: number }[]> {
    const rows = await orgQuery<{ page: string; count: string }>(
      orgSlug,
      `SELECT page, COUNT(*) AS count
       FROM analytics_events WHERE page IS NOT NULL
       GROUP BY page ORDER BY count DESC LIMIT 10`
    );
    return rows.map((r) => ({ _id: r.page, count: parseInt(r.count, 10) }));
  },

  async dailyStats(orgSlug: string): Promise<{ _id: string; count: number }[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await orgQuery<{ day: string; count: string }>(
      orgSlug,
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM analytics_events
       WHERE created_at >= $1
       GROUP BY day ORDER BY day ASC`,
      [sevenDaysAgo]
    );
    return rows.map((r) => ({ _id: r.day, count: parseInt(r.count, 10) }));
  },

  async totalEvents(orgSlug: string): Promise<number> {
    const rows = await orgQuery<{ count: string }>(
      orgSlug,
      "SELECT COUNT(*) AS count FROM analytics_events"
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  },

  async topUsers(orgSlug: string): Promise<{ _id: string; count: number }[]> {
    const rows = await orgQuery<{ user: string; count: string }>(
      orgSlug,
      `SELECT "user", COUNT(*) AS count
       FROM analytics_events
       WHERE "user" IS NOT NULL
       GROUP BY "user" ORDER BY count DESC LIMIT 8`
    );
    return rows.map((r) => ({ _id: r.user, count: parseInt(r.count, 10) }));
  },

  async create(data: {
    org_slug: string;
    event: string;
    page?: string;
    user?: string;
    metadata?: unknown;
  }): Promise<AnalyticsEvent> {
    const rows = await orgQuery<AnalyticsEvent>(
      data.org_slug,
      `INSERT INTO analytics_events (event, page, "user", metadata)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [
        data.event,
        data.page ?? null,
        data.user ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return rows[0];
  },
};
