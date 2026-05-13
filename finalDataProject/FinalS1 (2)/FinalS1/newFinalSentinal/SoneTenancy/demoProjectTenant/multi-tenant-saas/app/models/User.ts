/**
 * User model — super admins stored in the `users` table.
 */
import { query } from "../lib/db";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "org_admin" | "org_user";
  org_id?: string | null;
  org_slug?: string | null;
  org_name?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const UserModel = {
  async findByEmail(email: string): Promise<User | null> {
    const rows = await query<User>(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase().trim()]
    );
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<User | null> {
    const rows = await query<User>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
    return rows[0] ?? null;
  },

  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    org_id?: string;
    org_slug?: string;
    org_name?: string;
    is_active?: boolean;
  }): Promise<User> {
    const rows = await query<User>(
      `INSERT INTO users (name, email, password, role, org_id, org_slug, org_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.name,
        data.email.toLowerCase().trim(),
        data.password,
        data.role ?? "org_user",
        data.org_id ?? null,
        data.org_slug ?? null,
        data.org_name ?? null,
        data.is_active ?? true,
      ]
    );
    return rows[0];
  },
};
