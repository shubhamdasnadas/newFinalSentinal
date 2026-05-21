/**
 * Organization model — stored in the master P4C database.
 * Uses masterPool via query().
 */
import { query } from "../lib/db";

export const ALL_PAGES = [
  "dashboard", "members", "projects", "reports",
  "analytics", "billing", "notifications", "support", "security", "settings","checkpoint"
];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  industry?: string | null;
  plan: "free" | "starter" | "pro" | "enterprise";
  is_active: boolean;
  created_by?: string | null;
  allowed_pages: string[];
  created_at: Date;
  updated_at: Date;
}

export const OrgModel = {
  async findAll(): Promise<Organization[]> {
    return query<Organization>(
      "SELECT * FROM organizations ORDER BY created_at DESC"
    );
  },

  async findActive(): Promise<Organization[]> {
    return query<Organization>(
      "SELECT * FROM organizations WHERE is_active = TRUE ORDER BY created_at DESC"
    );
  },

  async findById(id: string): Promise<Organization | null> {
    const rows = await query<Organization>(
      "SELECT * FROM organizations WHERE id = $1 LIMIT 1",
      [id]
    );
    return rows[0] ?? null;
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    const rows = await query<Organization>(
      "SELECT * FROM organizations WHERE slug = $1 LIMIT 1",
      [slug]
    );
    return rows[0] ?? null;
  },

  async findByEmail(email: string): Promise<Organization | null> {
    const rows = await query<Organization>(
      "SELECT * FROM organizations WHERE email = $1 AND is_active = TRUE LIMIT 1",
      [email.toLowerCase().trim()]
    );
    return rows[0] ?? null;
  },

  async findByNameExact(name: string): Promise<Organization | null> {
    const rows = await query<Organization>(
      "SELECT * FROM organizations WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name.trim()]
    );
    return rows[0] ?? null;
  },

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    industry?: string;
    plan?: string;
    created_by?: string;
    allowed_pages?: string[];
  }): Promise<Organization> {
    const rows = await query<Organization>(
      `INSERT INTO organizations
         (name, slug, description, color, email, phone, address, website, industry, plan, created_by, allowed_pages)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        data.name.trim(),
        data.slug,
        data.description ?? null,
        data.color ?? "#6366f1",
        data.email ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.website ?? null,
        data.industry ?? null,
        data.plan ?? "free",
        data.created_by ?? null,
        data.allowed_pages ?? ALL_PAGES,
      ]
    );
    return rows[0];
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      phone: string;
      address: string;
      website: string;
      industry: string;
      plan: string;
      is_active: boolean;
      description: string;
      color: string;
      allowed_pages: string[];
    }>
  ): Promise<Organization | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const rows = await query<Organization>(
      `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  },

  async deactivate(id: string): Promise<void> {
    await query("UPDATE organizations SET is_active = FALSE WHERE id = $1", [id]);
  },
};
