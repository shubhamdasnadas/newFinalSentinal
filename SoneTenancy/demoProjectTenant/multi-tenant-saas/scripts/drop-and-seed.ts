/**
 * Drops ALL saas databases and seeds fresh data.
 * Run: npx tsx scripts/drop-and-seed.ts
 */
import mongoose from "mongoose";

const MONGO_URI = "mongodb://localhost:27017";

// ── Schemas ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const OrgSchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true },
  description: String,
  color: String,
  email: String,
  phone: String,
  address: String,
  website: String,
  industry: String,
  plan: String,
  isActive: { type: Boolean, default: true },
  allowedPages: [String],
}, { timestamps: true });

const OrgUserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  department: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
  name: String, key: String, description: String,
  status: String, createdBy: String,
}, { timestamps: true });

const ReportSchema = new mongoose.Schema({
  title: String, description: String, type: String,
  createdBy: String, status: String,
}, { timestamps: true });

const NotificationSchema = new mongoose.Schema({
  title: String, message: String, type: String,
  isRead: Boolean, targetUser: String,
}, { timestamps: true });

const SupportTicketSchema = new mongoose.Schema({
  subject: String, description: String, status: String,
  priority: String, createdBy: String,
}, { timestamps: true });

const BillingSchema = new mongoose.Schema({
  plan: String, amount: Number, currency: String, status: String,
  billingDate: Date,
  invoices: [{ id: String, amount: Number, date: Date, status: String }],
}, { timestamps: true });

const AnalyticsSchema = new mongoose.Schema({
  event: String, page: String, user: String,
}, { timestamps: true });

// ── Seed Data ─────────────────────────────────────────────────────────────────
const ALL_PAGES = ["dashboard","members","projects","reports","analytics","billing","notifications","support","settings"];

const ORGS = [
  {
    name: "Acme Corp",
    slug: "acme_corp",
    description: "A leading technology company building the future of software",
    color: "#06b6d4",
    email: "hello@acme.com",
    phone: "+1 (555) 100-2000",
    address: "123 Tech Street, San Francisco, CA 94105",
    website: "https://acme.com",
    industry: "Technology",
    plan: "pro",
    allowedPages: ALL_PAGES,
    members: [
      { name: "Alice Johnson", email: "alice@acme.com",  password: "Alice@123",  role: "org_admin", department: "Engineering" },
      { name: "Bob Smith",     email: "bob@acme.com",    password: "Bob@123",    role: "org_user",  department: "Product" },
      { name: "Carol White",   email: "carol@acme.com",  password: "Carol@123",  role: "org_user",  department: "Design" },
      { name: "David Lee",     email: "david@acme.com",  password: "David@123",  role: "org_user",  department: "Marketing" },
    ],
    projects: [
      { name: "Website Redesign",  key: "WEBRD", description: "Complete overhaul of the company website",          status: "active" },
      { name: "Mobile App v2",     key: "MOBV2", description: "Next generation mobile application",                status: "active" },
      { name: "API Gateway",       key: "APIGW", description: "Centralized API gateway for all microservices",     status: "active" },
      { name: "Data Pipeline",     key: "DATAP", description: "Real-time data processing pipeline",               status: "inactive" },
      { name: "Legacy Migration",  key: "LEGCY", description: "Migrate legacy systems to cloud infrastructure",   status: "archived" },
    ],
    reports: [
      { title: "Q4 2024 Sales Report",    description: "Quarterly sales performance analysis",  type: "sales",      status: "published" },
      { title: "Annual Finance Summary",  description: "Full year financial overview",           type: "finance",    status: "published" },
      { title: "HR Headcount Report",     description: "Team growth and hiring metrics",         type: "hr",         status: "draft" },
      { title: "Operations Review",       description: "Infrastructure and ops performance",     type: "operations", status: "published" },
    ],
    notifications: [
      { title: "System Maintenance",  message: "Scheduled maintenance on Sunday 2am-4am UTC",  type: "warning", targetUser: "all" },
      { title: "New Feature Released", message: "Dashboard analytics v2 is now live!",          type: "success", targetUser: "all" },
      { title: "Invoice Due",          message: "Your Pro plan invoice is due in 3 days",        type: "info",    targetUser: "alice@acme.com" },
    ],
    tickets: [
      { subject: "Login issue on mobile",    description: "Users unable to login on iOS 17",          status: "open",        priority: "high",   createdBy: "bob@acme.com" },
      { subject: "Dashboard loading slow",   description: "Dashboard takes 10+ seconds to load",      status: "in_progress", priority: "medium", createdBy: "carol@acme.com" },
      { subject: "Export to CSV broken",     description: "CSV export returns empty file",             status: "resolved",    priority: "low",    createdBy: "david@acme.com" },
    ],
    billing: {
      plan: "pro", amount: 99, currency: "USD", status: "active",
      invoices: [
        { id: "INV-001", amount: 99, date: new Date("2024-12-01"), status: "paid" },
        { id: "INV-002", amount: 99, date: new Date("2025-01-01"), status: "paid" },
        { id: "INV-003", amount: 99, date: new Date("2025-02-01"), status: "paid" },
        { id: "INV-004", amount: 99, date: new Date("2025-03-01"), status: "paid" },
      ],
    },
    analytics: [
      { event: "page_view",       page: "/dashboard", user: "alice@acme.com" },
      { event: "page_view",       page: "/projects",  user: "bob@acme.com" },
      { event: "project_created", page: "/projects",  user: "alice@acme.com" },
      { event: "page_view",       page: "/members",   user: "carol@acme.com" },
      { event: "report_viewed",   page: "/reports",   user: "david@acme.com" },
      { event: "page_view",       page: "/dashboard", user: "bob@acme.com" },
      { event: "page_view",       page: "/analytics", user: "alice@acme.com" },
      { event: "page_view",       page: "/billing",   user: "alice@acme.com" },
    ],
  },
  {
    name: "ShubhamENT",
    slug: "shubhament",
    description: "Enterprise insurance solutions for modern businesses",
    color: "#8b5cf6",
    email: "info@shubhament.com",
    phone: "+91 98765 43210",
    address: "456 Business Park, Mumbai, Maharashtra 400001",
    website: "https://shubhament.com",
    industry: "Insurance",
    plan: "enterprise",
    allowedPages: ["dashboard","members","projects","reports","billing","settings"],
    members: [
      { name: "Shubham Patel", email: "shubham@shubhament.com", password: "Shubham@123", role: "org_admin", department: "Management" },
      { name: "Priya Sharma",  email: "priya@shubhament.com",   password: "Priya@123",   role: "org_user",  department: "Sales" },
      { name: "Raj Kumar",     email: "raj@shubhament.com",     password: "Raj@123",     role: "org_user",  department: "Operations" },
      { name: "Neha Gupta",    email: "neha@shubhament.com",    password: "Neha@123",    role: "org_user",  department: "Finance" },
    ],
    projects: [
      { name: "Insurance Portal",    key: "INSPR", description: "Customer-facing insurance management portal",  status: "active" },
      { name: "Claims Automation",   key: "CLAIM", description: "Automated claims processing system",           status: "active" },
      { name: "Agent Dashboard",     key: "AGNTD", description: "Dashboard for insurance agents",              status: "inactive" },
      { name: "Mobile Claims App",   key: "MCLM",  description: "Mobile app for filing claims on the go",      status: "active" },
    ],
    reports: [
      { title: "Claims Q1 2025",       description: "First quarter claims analysis",          type: "operations", status: "published" },
      { title: "Premium Revenue",      description: "Monthly premium collection summary",     type: "finance",    status: "published" },
      { title: "Agent Performance",    description: "Top performing agents this quarter",     type: "sales",      status: "draft" },
      { title: "Risk Assessment 2025", description: "Annual risk portfolio assessment",       type: "custom",     status: "published" },
    ],
    notifications: [
      { title: "Policy Renewal Alert", message: "50 policies are due for renewal this month", type: "warning", targetUser: "all" },
      { title: "System Update",        message: "Claims module updated to v3.2",               type: "info",    targetUser: "all" },
      { title: "New Agent Onboarded",  message: "Welcome Neha Gupta to the Finance team!",    type: "success", targetUser: "shubham@shubhament.com" },
    ],
    tickets: [
      { subject: "Policy upload failing",      description: "Bulk policy upload returns 500 error",    status: "open",        priority: "critical", createdBy: "priya@shubhament.com" },
      { subject: "Report generation timeout",  description: "Large reports time out after 30s",        status: "in_progress", priority: "high",     createdBy: "raj@shubhament.com" },
      { subject: "Agent login not working",    description: "Agents cannot login after password reset", status: "resolved",    priority: "medium",   createdBy: "neha@shubhament.com" },
    ],
    billing: {
      plan: "enterprise", amount: 299, currency: "USD", status: "active",
      invoices: [
        { id: "INV-E001", amount: 299, date: new Date("2024-11-01"), status: "paid" },
        { id: "INV-E002", amount: 299, date: new Date("2024-12-01"), status: "paid" },
        { id: "INV-E003", amount: 299, date: new Date("2025-01-01"), status: "paid" },
        { id: "INV-E004", amount: 299, date: new Date("2025-02-01"), status: "paid" },
      ],
    },
    analytics: [
      { event: "page_view",     page: "/dashboard", user: "shubham@shubhament.com" },
      { event: "page_view",     page: "/reports",   user: "priya@shubhament.com" },
      { event: "page_view",     page: "/projects",  user: "raj@shubhament.com" },
      { event: "report_viewed", page: "/reports",   user: "shubham@shubhament.com" },
      { event: "page_view",     page: "/members",   user: "neha@shubhament.com" },
    ],
  },
  {
    name: "TechNova",
    slug: "technova",
    description: "Innovative fintech startup disrupting digital payments",
    color: "#10b981",
    email: "hello@technova.io",
    phone: "+1 (415) 555-9900",
    address: "789 Innovation Ave, Austin, TX 78701",
    website: "https://technova.io",
    industry: "Fintech",
    plan: "starter",
    allowedPages: ["dashboard","members","projects","reports","support","settings"],
    members: [
      { name: "Emma Wilson",    email: "emma@technova.io",   password: "Emma@123",  role: "org_admin", department: "Engineering" },
      { name: "Liam Chen",      email: "liam@technova.io",   password: "Liam@123",  role: "org_user",  department: "Product" },
      { name: "Sofia Martinez", email: "sofia@technova.io",  password: "Sofia@123", role: "org_user",  department: "Design" },
    ],
    projects: [
      { name: "Payment Gateway v3", key: "PAYV3", description: "Next-gen payment processing engine",    status: "active" },
      { name: "Fraud Detection AI", key: "FRAUD", description: "ML-based fraud detection system",       status: "active" },
      { name: "Merchant Portal",    key: "MERCH", description: "Self-service portal for merchants",     status: "inactive" },
    ],
    reports: [
      { title: "Transaction Volume Q1", description: "Q1 payment transaction analysis",  type: "finance",    status: "published" },
      { title: "Fraud Incidents Report", description: "Monthly fraud detection summary", type: "operations", status: "published" },
    ],
    notifications: [
      { title: "API Rate Limit Warning", message: "You are approaching your API rate limit", type: "warning", targetUser: "all" },
      { title: "Deployment Successful",  message: "Payment Gateway v3.1 deployed to prod",  type: "success", targetUser: "emma@technova.io" },
    ],
    tickets: [
      { subject: "Webhook not firing",    description: "Payment webhooks not triggering on success", status: "open",     priority: "high",   createdBy: "liam@technova.io" },
      { subject: "UI glitch on checkout", description: "Checkout button disappears on mobile",       status: "resolved", priority: "medium", createdBy: "sofia@technova.io" },
    ],
    billing: {
      plan: "starter", amount: 29, currency: "USD", status: "active",
      invoices: [
        { id: "INV-T001", amount: 29, date: new Date("2025-02-01"), status: "paid" },
        { id: "INV-T002", amount: 29, date: new Date("2025-03-01"), status: "paid" },
      ],
    },
    analytics: [
      { event: "page_view",       page: "/dashboard", user: "emma@technova.io" },
      { event: "page_view",       page: "/projects",  user: "liam@technova.io" },
      { event: "project_created", page: "/projects",  user: "emma@technova.io" },
    ],
  },
];

async function dropAndSeed() {
  console.log("🗑️  Dropping all existing databases...\n");

  // Drop main DB
  const mainConn = await mongoose.createConnection(`${MONGO_URI}/saas_main`).asPromise();
  await mainConn.dropDatabase();
  console.log("✅ Dropped: saas_main");

  // Drop org DBs
  for (const org of ORGS) {
    const c = await mongoose.createConnection(`${MONGO_URI}/saas_org_${org.slug}`).asPromise();
    await c.dropDatabase();
    console.log(`✅ Dropped: saas_org_${org.slug}`);
    await c.close();
  }
  await mainConn.close();

  console.log("\n🌱 Seeding fresh data...\n");

  // ── Seed Main DB ─────────────────────────────────────────────────────────────
  const main = await mongoose.createConnection(`${MONGO_URI}/saas_main`).asPromise();
  const User = main.model("User", UserSchema);
  const Org  = main.model("Organization", OrgSchema);

  // Super admin (password login)
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash("SuperAdmin@123", 10);
  await User.create({ name: "Super Admin", email: "superadmin@saas.com", password: hash, role: "super_admin", isActive: true });
  console.log("✅ Super Admin: superadmin@saas.com / SuperAdmin@123");

  // Create orgs in main DB
  for (const orgData of ORGS) {
    await Org.create({
      name: orgData.name, slug: orgData.slug, description: orgData.description,
      color: orgData.color, email: orgData.email, phone: orgData.phone,
      address: orgData.address, website: orgData.website, industry: orgData.industry,
      plan: orgData.plan, isActive: true, allowedPages: orgData.allowedPages,
    });
    console.log(`✅ Org created in main DB: ${orgData.name}`);
  }
  await main.close();

  // ── Seed Each Org DB ──────────────────────────────────────────────────────────
  for (const orgData of ORGS) {
    const conn = await mongoose.createConnection(`${MONGO_URI}/saas_org_${orgData.slug}`).asPromise();
    const OrgUser    = conn.model("OrgUser",       OrgUserSchema);
    const Project    = conn.model("Project",       ProjectSchema);
    const Report     = conn.model("Report",        ReportSchema);
    const Notif      = conn.model("Notification",  NotificationSchema);
    const Ticket     = conn.model("SupportTicket", SupportTicketSchema);
    const Billing    = conn.model("Billing",       BillingSchema);
    const Analytics  = conn.model("Analytics",     AnalyticsSchema);

    // Members — with bcrypt password for email+password login
    for (const m of orgData.members) {
      const hash = await bcrypt.hash((m as any).password || "Password@123", 10);
      await OrgUser.create({ name: m.name, email: m.email, password: hash, role: m.role, department: m.department, isActive: true });
    }
    console.log(`  👥 ${orgData.members.length} members`);

    for (const p of orgData.projects)      await Project.create({ ...p, createdBy: orgData.members[0].email });
    for (const r of orgData.reports)       await Report.create({ ...r, createdBy: orgData.members[0].email });
    for (const n of orgData.notifications) await Notif.create({ ...n, isRead: false });
    for (const t of orgData.tickets)       await Ticket.create(t);
    for (const a of orgData.analytics)     await Analytics.create(a);
    await Billing.create({ ...orgData.billing, billingDate: new Date() });

    console.log(`  📁 ${orgData.projects.length} projects | 📊 ${orgData.reports.length} reports | 🔔 ${orgData.notifications.length} notifs | 🎧 ${orgData.tickets.length} tickets | 💳 billing | 📈 ${orgData.analytics.length} events`);
    console.log(`  ✅ ${orgData.name} seeded\n`);
    await conn.close();
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("🎉 ALL DONE — Fresh database ready!\n");
  console.log("SUPER ADMIN LOGIN:");
  console.log("  Tab:      Super Admin");
  console.log("  Email:    superadmin@saas.com");
  console.log("  Password: SuperAdmin@123\n");
  console.log("ORGANIZATION LOGIN (email + password):");
  for (const org of ORGS) {
    console.log(`\n  Org: ${org.name}`);
    for (const m of org.members) {
      console.log(`    ${m.email}  /  ${(m as any).password}  (${m.role})`);
    }
  }
  console.log("\n═══════════════════════════════════════════════════════");
  process.exit(0);
}

dropAndSeed().catch((e) => { console.error(e); process.exit(1); });
