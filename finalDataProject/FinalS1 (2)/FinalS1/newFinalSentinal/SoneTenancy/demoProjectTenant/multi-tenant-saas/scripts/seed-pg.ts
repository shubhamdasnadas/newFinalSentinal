/**
 * PostgreSQL multi-database seed script.
 *
 * Organizations:
 *   1. TechSec Digital Pvt Ltd  (slug: techsec_digital)
 *   2. PCPL Pvt Ltd             (slug: pcpl)
 *
 * Run: npx tsx scripts/seed-pg.ts
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE = {
  host:     process.env.PG_HOST     || "localhost",
  port:     parseInt(process.env.PG_PORT || "5432", 10),
  user:     process.env.PG_USER     || "postgres",
  password: process.env.PG_PASSWORD || "root",
};

const masterPool = new Pool({ ...BASE, database: process.env.PG_DATABASE || "P4C" });

// ─── Per-org schema ───────────────────────────────────────────────────────────
const ORG_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS org_users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  password    TEXT,
  role        TEXT        NOT NULL DEFAULT 'org_user'
                          CHECK (role IN ('org_admin', 'org_user')),
  department  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive', 'archived')),
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  type        TEXT        NOT NULL DEFAULT 'custom'
                          CHECK (type IN ('sales', 'finance', 'hr', 'operations', 'custom')),
  data        JSONB,
  status      TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'info'
                          CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  target_user TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT        NOT NULL,
  description TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_by  TEXT,
  assigned_to TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan         TEXT          NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency     TEXT          NOT NULL DEFAULT 'USD',
  status       TEXT          NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'past_due', 'cancelled')),
  billing_date TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_ref TEXT          NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  date        TIMESTAMPTZ,
  status      TEXT          NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  page        TEXT,
  "user"      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS firewall_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT        NOT NULL UNIQUE,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentinelone_threats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data       JSONB       NOT NULL,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentinelone_agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data       JSONB       NOT NULL,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_layout (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT        NOT NULL UNIQUE,
  layout     JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_users_email      ON org_users(email);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $func$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$func$ LANGUAGE plpgsql;

DO $do$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_users','projects','reports','notifications','support_tickets','billing'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
      CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END;
$do$;
`;

// ─── Seed data ────────────────────────────────────────────────────────────────

const ALL_PAGES = [
  "dashboard", "members", "projects", "reports",
  "analytics", "billing", "notifications", "support", "security", "settings",
];

const ORGS = [
  {
    name: "TechSec Digital Pvt Ltd",
    slug: "techsec_digital",
    description: "Cybersecurity and digital transformation solutions for enterprises",
    color: "#6366f1",
    email: "admin@techsecdigital.in",
    phone: "+91 98100 12345",
    address: "Plot 42, Cyber City, Gurugram, Haryana 122002",
    website: "https://techsecdigital.in",
    industry: "Cybersecurity",
    plan: "enterprise",
    allowedPages: ALL_PAGES,
    members: [
      { name: "Rajesh Sharma",   email: "rajesh@techsecdigital.in",  password: "Rajesh@123",  role: "org_admin", department: "Management" },
      { name: "Priya Nair",      email: "priya@techsecdigital.in",   password: "Priya@123",   role: "org_user",  department: "Security Operations" },
      { name: "Amit Verma",      email: "amit@techsecdigital.in",    password: "Amit@123",    role: "org_user",  department: "Network Security" },
      { name: "Sunita Rao",      email: "sunita@techsecdigital.in",  password: "Sunita@123",  role: "org_user",  department: "Compliance" },
      { name: "Vikram Singh",    email: "vikram@techsecdigital.in",  password: "Vikram@123",  role: "org_user",  department: "Threat Intelligence" },
    ],
    projects: [
      { name: "SOC Automation",         key: "SOCAU",  description: "Security Operations Center automation platform",          status: "active" },
      { name: "Zero Trust Architecture", key: "ZTRST",  description: "Enterprise zero-trust network implementation",           status: "active" },
      { name: "Threat Intelligence Hub", key: "TIHUB",  description: "Centralized threat intelligence aggregation system",     status: "active" },
      { name: "Compliance Dashboard",    key: "COMPL",  description: "ISO 27001 and SOC2 compliance tracking dashboard",       status: "active" },
      { name: "Endpoint Hardening",      key: "ENDPT",  description: "Automated endpoint security hardening scripts",          status: "inactive" },
      { name: "SIEM Integration",        key: "SIEM",   description: "SIEM platform integration with existing infrastructure", status: "archived" },
    ],
    reports: [
      { title: "Q1 2025 Security Posture Report",  description: "Quarterly security assessment and risk analysis",         type: "operations", status: "published" },
      { title: "Threat Landscape Analysis",        description: "Monthly threat intelligence and attack vector analysis",  type: "custom",     status: "published" },
      { title: "Compliance Audit Q1 2025",         description: "ISO 27001 compliance audit findings and remediation",    type: "operations", status: "published" },
      { title: "Incident Response Summary",        description: "Summary of security incidents and response actions",     type: "operations", status: "draft" },
      { title: "Vulnerability Assessment Report",  description: "Network and application vulnerability scan results",     type: "custom",     status: "published" },
    ],
    notifications: [
      { title: "Critical Threat Detected",    message: "High-severity threat detected on endpoint WKSTN-042. Immediate action required.", type: "error",   targetUser: "all" },
      { title: "Firewall Policy Updated",     message: "Palo Alto firewall rules updated successfully. New policies are now active.",      type: "success", targetUser: "all" },
      { title: "SentinelOne Sync Complete",   message: "Threat data synchronized successfully. 1,247 agents reporting.",                  type: "info",    targetUser: "rajesh@techsecdigital.in" },
      { title: "Compliance Deadline Reminder", message: "ISO 27001 recertification audit is scheduled for next month.",                   type: "warning", targetUser: "sunita@techsecdigital.in" },
      { title: "New CVE Published",           message: "Critical CVE-2025-1234 affects your environment. Patch available.",               type: "warning", targetUser: "all" },
    ],
    tickets: [
      { subject: "SentinelOne agent offline on 3 endpoints",  description: "Agents on WKSTN-015, WKSTN-023, WKSTN-031 are not reporting to console", status: "open",        priority: "high",     createdBy: "priya@techsecdigital.in" },
      { subject: "Firewall blocking legitimate traffic",       description: "Application traffic to 192.168.50.0/24 being blocked by new policy",     status: "in_progress", priority: "critical", createdBy: "amit@techsecdigital.in" },
      { subject: "Dashboard layout not saving",               description: "Custom widget positions reset after page refresh",                         status: "resolved",    priority: "medium",   createdBy: "vikram@techsecdigital.in" },
      { subject: "Compliance report export failing",          description: "PDF export of compliance report returns 500 error",                        status: "open",        priority: "medium",   createdBy: "sunita@techsecdigital.in" },
    ],
    billing: { plan: "enterprise", amount: 499, currency: "INR", status: "active" },
    invoices: [
      { ref: "TSEC-INV-001", amount: 499, date: new Date("2025-01-01"), status: "paid" },
      { ref: "TSEC-INV-002", amount: 499, date: new Date("2025-02-01"), status: "paid" },
      { ref: "TSEC-INV-003", amount: 499, date: new Date("2025-03-01"), status: "paid" },
      { ref: "TSEC-INV-004", amount: 499, date: new Date("2025-04-01"), status: "paid" },
      { ref: "TSEC-INV-005", amount: 499, date: new Date("2025-05-01"), status: "pending" },
    ],
    analytics: [
      { event: "page_view",       page: "/dashboard", user: "rajesh@techsecdigital.in" },
      { event: "page_view",       page: "/security",  user: "priya@techsecdigital.in" },
      { event: "page_view",       page: "/security",  user: "amit@techsecdigital.in" },
      { event: "page_view",       page: "/reports",   user: "sunita@techsecdigital.in" },
      { event: "page_view",       page: "/dashboard", user: "vikram@techsecdigital.in" },
      { event: "report_viewed",   page: "/reports",   user: "rajesh@techsecdigital.in" },
      { event: "page_view",       page: "/members",   user: "rajesh@techsecdigital.in" },
      { event: "page_view",       page: "/analytics", user: "priya@techsecdigital.in" },
      { event: "page_view",       page: "/security",  user: "vikram@techsecdigital.in" },
      { event: "project_created", page: "/projects",  user: "rajesh@techsecdigital.in" },
    ],
  },
  {
    name: "PCPL Pvt Ltd",
    slug: "pcpl",
    description: "Professional consulting and project lifecycle management services",
    color: "#0ea5e9",
    email: "admin@pcpl.co.in",
    phone: "+91 22 4567 8900",
    address: "Level 8, One BKC, Bandra Kurla Complex, Mumbai, Maharashtra 400051",
    website: "https://pcpl.co.in",
    industry: "Consulting",
    plan: "pro",
    allowedPages: ALL_PAGES,
    members: [
      { name: "Ananya Krishnan",  email: "ananya@pcpl.co.in",  password: "Ananya@123",  role: "org_admin", department: "Executive" },
      { name: "Rohit Mehta",      email: "rohit@pcpl.co.in",   password: "Rohit@123",   role: "org_user",  department: "IT Infrastructure" },
      { name: "Deepa Pillai",     email: "deepa@pcpl.co.in",   password: "Deepa@123",   role: "org_user",  department: "Project Management" },
      { name: "Karan Malhotra",   email: "karan@pcpl.co.in",   password: "Karan@123",   role: "org_user",  department: "Finance" },
    ],
    projects: [
      { name: "Digital Transformation 2025", key: "DT25",   description: "Enterprise-wide digital transformation initiative",         status: "active" },
      { name: "ERP Migration",               key: "ERPMIG", description: "Migration from legacy ERP to SAP S/4HANA",                  status: "active" },
      { name: "Cloud Infrastructure",        key: "CLOUD",  description: "AWS cloud infrastructure setup and migration",              status: "active" },
      { name: "Data Analytics Platform",     key: "DANAL",  description: "Business intelligence and analytics platform deployment",   status: "inactive" },
      { name: "Cybersecurity Audit 2024",    key: "CSAUD",  description: "Annual cybersecurity posture assessment and remediation",   status: "archived" },
    ],
    reports: [
      { title: "Q1 2025 Financial Summary",    description: "First quarter revenue, expenses and profitability analysis",  type: "finance",    status: "published" },
      { title: "Project Status Report May 25", description: "Monthly status update for all active projects",              type: "operations", status: "published" },
      { title: "HR Headcount Q1 2025",         description: "Workforce planning and headcount analysis",                  type: "hr",         status: "draft" },
      { title: "IT Infrastructure Audit",      description: "Comprehensive IT infrastructure health assessment",          type: "custom",     status: "published" },
    ],
    notifications: [
      { title: "ERP Migration Milestone",    message: "Phase 2 of ERP migration completed successfully. Phase 3 begins Monday.", type: "success", targetUser: "all" },
      { title: "Security Patch Required",    message: "Critical security patches pending on 12 servers. Please schedule maintenance.", type: "warning", targetUser: "rohit@pcpl.co.in" },
      { title: "Invoice Overdue",            message: "Invoice PCPL-INV-003 is 7 days overdue. Please review billing.",              type: "error",   targetUser: "ananya@pcpl.co.in" },
      { title: "New Project Kickoff",        message: "Data Analytics Platform project kickoff meeting scheduled for Friday 3 PM.",  type: "info",    targetUser: "all" },
    ],
    tickets: [
      { subject: "VPN connectivity issues for remote team",  description: "Remote employees unable to connect to VPN since yesterday morning",  status: "open",        priority: "high",   createdBy: "rohit@pcpl.co.in" },
      { subject: "ERP login timeout errors",                 description: "Users experiencing frequent session timeouts in SAP portal",          status: "in_progress", priority: "medium", createdBy: "deepa@pcpl.co.in" },
      { subject: "Monthly report generation slow",           description: "Finance reports taking 15+ minutes to generate",                      status: "resolved",    priority: "low",    createdBy: "karan@pcpl.co.in" },
    ],
    billing: { plan: "pro", amount: 299, currency: "INR", status: "active" },
    invoices: [
      { ref: "PCPL-INV-001", amount: 299, date: new Date("2025-01-01"), status: "paid" },
      { ref: "PCPL-INV-002", amount: 299, date: new Date("2025-02-01"), status: "paid" },
      { ref: "PCPL-INV-003", amount: 299, date: new Date("2025-03-01"), status: "paid" },
      { ref: "PCPL-INV-004", amount: 299, date: new Date("2025-04-01"), status: "pending" },
    ],
    analytics: [
      { event: "page_view",       page: "/dashboard", user: "ananya@pcpl.co.in" },
      { event: "page_view",       page: "/projects",  user: "deepa@pcpl.co.in" },
      { event: "page_view",       page: "/reports",   user: "karan@pcpl.co.in" },
      { event: "page_view",       page: "/members",   user: "ananya@pcpl.co.in" },
      { event: "project_created", page: "/projects",  user: "ananya@pcpl.co.in" },
      { event: "report_viewed",   page: "/reports",   user: "karan@pcpl.co.in" },
      { event: "page_view",       page: "/billing",   user: "ananya@pcpl.co.in" },
      { event: "page_view",       page: "/analytics", user: "rohit@pcpl.co.in" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function dropAndCreateOrgDb(slug: string) {
  const dbName = `saas_org_${slug}`;
  const adminPool = new Pool({ ...BASE, database: "postgres" });
  try {
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`  🗄️  Database "${dbName}" created`);
  } finally {
    await adminPool.end();
  }

  const orgPool = new Pool({ ...BASE, database: dbName });
  try {
    await orgPool.query(ORG_SCHEMA);
    console.log(`  ✅ Schema applied to "${dbName}"`);
  } finally {
    await orgPool.end();
  }
}

// ─── Main seed ────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🗑️  Clearing master P4C database...\n");
  await masterPool.query(`TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE`);
  console.log("✅ Master tables cleared\n");

  console.log("🌱 Seeding...\n");

  // Super Admin
  const hash = await bcrypt.hash("SuperAdmin@123", 10);
  await masterPool.query(
    `INSERT INTO users (name, email, password, role, is_active) VALUES ($1,$2,$3,$4,$5)`,
    ["Super Admin", "superadmin@saas.com", hash, "super_admin", true]
  );
  console.log("✅ Super Admin: superadmin@saas.com / SuperAdmin@123\n");

  for (const org of ORGS) {
    console.log(`── ${org.name} ──────────────────────────────────`);

    // 1. Register in master DB
    await masterPool.query(
      `INSERT INTO organizations
         (name, slug, description, color, email, phone, address, website, industry, plan, is_active, allowed_pages)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        org.name, org.slug, org.description, org.color, org.email,
        org.phone, org.address, org.website, org.industry, org.plan,
        true, org.allowedPages,
      ]
    );
    console.log(`  ✅ Registered in P4C master`);

    // 2. Create dedicated database
    await dropAndCreateOrgDb(org.slug);

    // 3. Seed org data
    const orgPool = new Pool({ ...BASE, database: `saas_org_${org.slug}` });
    try {
      // Members
      for (const m of org.members) {
        const mHash = await bcrypt.hash(m.password, 10);
        await orgPool.query(
          `INSERT INTO org_users (name, email, password, role, department, is_active)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [m.name, m.email, mHash, m.role, m.department, true]
        );
      }
      console.log(`  👥 ${org.members.length} members`);

      // Projects
      for (const p of org.projects) {
        await orgPool.query(
          `INSERT INTO projects (name, key, description, status, created_by) VALUES ($1,$2,$3,$4,$5)`,
          [p.name, p.key, p.description, p.status, org.members[0].email]
        );
      }
      console.log(`  📁 ${org.projects.length} projects`);

      // Reports
      for (const r of org.reports) {
        await orgPool.query(
          `INSERT INTO reports (title, description, type, status, created_by) VALUES ($1,$2,$3,$4,$5)`,
          [r.title, r.description, r.type, r.status, org.members[0].email]
        );
      }
      console.log(`  📊 ${org.reports.length} reports`);

      // Notifications
      for (const n of org.notifications) {
        await orgPool.query(
          `INSERT INTO notifications (title, message, type, is_read, target_user) VALUES ($1,$2,$3,$4,$5)`,
          [n.title, n.message, n.type, false, n.targetUser]
        );
      }
      console.log(`  🔔 ${org.notifications.length} notifications`);

      // Support tickets
      for (const t of org.tickets) {
        await orgPool.query(
          `INSERT INTO support_tickets (subject, description, status, priority, created_by) VALUES ($1,$2,$3,$4,$5)`,
          [t.subject, t.description, t.status, t.priority, t.createdBy]
        );
      }
      console.log(`  🎧 ${org.tickets.length} tickets`);

      // Billing
      await orgPool.query(
        `INSERT INTO billing (plan, amount, currency, status, billing_date) VALUES ($1,$2,$3,$4,$5)`,
        [org.billing.plan, org.billing.amount, org.billing.currency, org.billing.status, new Date()]
      );

      // Invoices
      for (const inv of org.invoices) {
        await orgPool.query(
          `INSERT INTO invoices (invoice_ref, amount, date, status) VALUES ($1,$2,$3,$4)`,
          [inv.ref, inv.amount, inv.date, inv.status]
        );
      }
      console.log(`  💳 billing + ${org.invoices.length} invoices`);

      // Analytics
      for (const a of org.analytics) {
        await orgPool.query(
          `INSERT INTO analytics_events (event, page, "user") VALUES ($1,$2,$3)`,
          [a.event, a.page, a.user]
        );
      }
      console.log(`  📈 ${org.analytics.length} analytics events`);
      console.log(`  ✅ ${org.name} fully seeded\n`);
    } finally {
      await orgPool.end();
    }
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("🎉 ALL DONE!\n");
  console.log("PostgreSQL databases created:");
  console.log("  P4C                        ← master (users + organizations)");
  for (const org of ORGS) {
    console.log(`  saas_org_${org.slug.padEnd(20)} ← ${org.name}`);
  }
  console.log("\nSUPER ADMIN:  superadmin@saas.com / SuperAdmin@123\n");
  console.log("ORG LOGINS:");
  for (const org of ORGS) {
    console.log(`\n  ${org.name}:`);
    for (const m of org.members) {
      console.log(`    ${m.email.padEnd(35)}  /  ${m.password}  (${m.role})`);
    }
  }
  console.log("\n═══════════════════════════════════════════════════════");
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => masterPool.end());
