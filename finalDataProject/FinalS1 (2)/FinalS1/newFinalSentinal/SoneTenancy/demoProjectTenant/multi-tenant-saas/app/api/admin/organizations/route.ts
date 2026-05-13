/**
 * GET  /api/admin/organizations  - List all organizations (super admin only)
 * POST /api/admin/organizations  - Create a new organization + provision its database
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { OrgModel } from "../../../models/Organization";
import { OrgUserModel, ProjectModel } from "../../../models/OrgModels";
import { provisionOrgDatabase, query } from "../../../lib/db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const ORG_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#3b82f6", "#14b8a6", "#f97316",
];

/** Transform DB org row → frontend shape */
function transformOrg(org: Record<string, any>, extra: Record<string, any> = {}) {
  return {
    _id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description ?? null,
    color: org.color,
    email: org.email ?? null,
    phone: org.phone ?? null,
    address: org.address ?? null,
    website: org.website ?? null,
    industry: org.industry ?? null,
    plan: org.plan,
    isActive: org.is_active,
    allowedPages: org.allowed_pages ?? [],
    createdAt: org.created_at,
    updatedAt: org.updated_at,
    ...extra,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const orgs = await OrgModel.findAll();

    // Enrich with member + project counts from each org's own database
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        try {
          const [memberCount, projectCount, activeProjectCount] = await Promise.all([
            OrgUserModel.countActive(org.slug),
            ProjectModel.count(org.slug),
            ProjectModel.countByStatus(org.slug, "active"),
          ]);
          return transformOrg(org as any, { memberCount, projectCount, activeProjectCount });
        } catch {
          return transformOrg(org as any, { memberCount: 0, projectCount: 0, activeProjectCount: 0 });
        }
      })
    );

    return NextResponse.json({ orgs: enriched });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone, address, website, industry, plan, description } = body;

    if (!name) {
      return NextResponse.json({ message: "Organization name is required" }, { status: 400 });
    }

    // Check duplicate name
    const existing = await OrgModel.findByNameExact(name);
    if (existing) {
      return NextResponse.json({ message: "Organization with this name already exists" }, { status: 409 });
    }

    // Generate unique slug
    let slug = slugify(name);
    const slugExists = await OrgModel.findBySlug(slug);
    if (slugExists) {
      slug = `${slug}_${Date.now()}`;
    }

    const color = ORG_COLORS[Math.floor(Math.random() * ORG_COLORS.length)];

    // 1. Register org in master P4C database
    // Verify the creator's user ID actually exists in the users table
    // (JWT may carry a stale ID if the DB was re-seeded)
    let createdBy: string | undefined;
    try {
      const rows = await query<{ id: string }>(
        "SELECT id FROM users WHERE id = $1 LIMIT 1",
        [user.userId]
      );
      createdBy = rows[0]?.id ?? undefined;
    } catch {
      createdBy = undefined;
    }

    const org = await OrgModel.create({
      name: name.trim(),
      slug,
      description,
      color,
      email,
      phone,
      address,
      website,
      industry,
      plan: plan || "free",
      created_by: createdBy,
    });

    // 2. Provision a dedicated PostgreSQL database for this org
    try {
      await provisionOrgDatabase(slug);
    } catch (dbErr: any) {
      // If DB provisioning fails, remove the org record to keep things consistent
      await OrgModel.deactivate(org.id);
      console.error("DB provisioning failed:", dbErr);
      return NextResponse.json(
        { message: `Organization created but database provisioning failed: ${dbErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, org: transformOrg(org as any) }, { status: 201 });
  } catch (error: any) {
    console.error("Create org error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
