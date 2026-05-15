/**
 * Full seed script — creates 2 orgs with members, projects, reports, notifications, support tickets, billing
 * Run: npx tsx scripts/seed-full.ts
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";

// ── Schemas ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, password: String, role: String, orgId: mongoose.Schema.Types.ObjectId, orgSlug: String, orgName: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
const OrgSchema = new mongoose.Schema({ name: String, slug: { type: String, unique: true }, description: String, color: String, email: String, phone: String, address: String, website: String, industry: String, plan: String, isActive: { type: Boolean, default: true }, createdBy: mongoose.Schema.Types.ObjectId, allowedPages: [String] }, { timestamps: true });
const OrgUserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, password: String, plainPassword: String, role: String, department: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
const ProjectSchema = new mongoose.Schema({ name: String, key: String, description: String, status: String, createdBy: String }, { timestamps: true });
const ReportSchema = new mongoose.Schema({ title: String, description: String, type: String, data: mongoose.Schema.Types.Mixed, createdBy: String, status: String }, { timestamps: true });
const NotificationSchema = new mongoose.Schema({ title: String, message: String, type: String, isRead: Boolean, targetUser: String }, { timestamps: true });
const SupportTicketSchema = new mongoose.Schema({ subject: String, description: String, status: String, priority: String, createdBy: String, assignedTo: String }, { timestamps: true });
const BillingSchema = new mongoose.Schema({ plan: String, amount: Number, currency: String, status: String, billingDate: Date, invoices: [{ id: String, amount: Number, date: Date, status: String }] }, { timestamps: true });
const AnalyticsSchema = new mongoose.Schema({ event: String, page: String, user: String, metadata: mongoose.Schema.Types.Mixed }, { timestamps: true });

const ALL_PAGES = ["dashboard", "members", "projects", "reports", "analytics", "billing", "notifications", "support", "settings"];

const ORGS = [
  {
    name: "Acme Corp",
    slug: "acme_corp",
    description: "A leading technology company building the future",
    color: "#06b6d4",
    email: "hello@acme.com",
    phone: "+1 (555) 100-2000",
    address: "123 Tech Street, San Francisco, CA 94105",
    website: "https://acme.com",
    industry: "Technology",
    plan: "pro",
    allowedPages: ALL_PAGES,
    members: [
      { name: "Alice Johnson", email: "alice@acme.com", password: "Alice@123", role: "org_admin", department: "Engineering" },
      { name: "Bob Smith", email: "bob@acme.com", password: "Bob@123", role: "org_user", department: "Product" },
      { name: "Carol White", email: "carol@acme.com", password: "Carol@123", role: "org_user", department: "Design" },
      { name: "David Lee", email: "david@acme.com", password: "David@123", role: "org_user", department: "Marketing" },
    ],
    projects: [
      { name: "Website Redesign", key: "WEBRD", description: "Complete overhaul of the company website with modern design", status: "active" },
      { name: "Mobile App v2", key: "MOBV2", description: "Next generation mobile application with new features", status: "active" },
      { name: "API Gateway", key: "APIGW", description: "Centralized API gateway for all microservices", status: "active" },
      { name: "Data Pipeline", key: "DATAP", description: "Real-time data processing pipeline", status: "inactive" },
      { name: "Legacy Migration", key: "LEGCY", description: "Migrate legacy systems to cloud", status: "archived" },
    ],
    reports: [
      { title: "Q4 2024 Sales Report", description: "Quarterly sales performance analysis", type: "sales", status: "published" },
      { title: "Annual Finance Summary", description: "Full year financial overview", type: "finance", status: "published" },
      { title: "HR Headcount Report", description: "Team growth and hiring metrics", type: "hr", status: "draft" },
      { title: "Operations Review", description: "Infrastructure and ops performance", type: "operations", status: "published" },
    ],
    notifications: [
      { title: "System Maintenance", message: "Scheduled maintenance on Sunday 2am-4am UTC", type: "warning", targetUser: "all" },
      { title: "New Feature Released", message: "Dashboard analytics v2 is now live!", type: "success", targetUser: "all" },
      { title: "Invoice Due", message: "Your Pro plan invoice is due in 3 days", type: "info", targetUser: "alice@acme.com" },
    ],
    tickets: [
      { subject: "Login issue on mobile", description: "Users are unable to login on iOS 17", status: "open", priority: "high", createdBy: "bob@acme.com" },
      { subject: "Dashboard loading slow", description: "Dashboard takes 10+ seconds to load", status: "in_progress", priority: "medium", createdBy: "carol@acme.com" },
      { subject: "Export to CSV broken", description: "CSV export returns empty file", status: "resolved", priority: "low", createdBy: "david@acme.com" },
    ],
    billing: { plan: "pro", amount: 99, currency: "USD", status: "active", invoices: [
      { id: "INV-001", amount: 99, date: new Date("2024-12-01"), status: "paid" },
      { id: "INV-002", amount: 99, date: new Date("2025-01-01"), status: "paid" },
      { id: "INV-003", amount: 99, date: new Date("2025-02-01"), status: "paid" },
    ]},
    analytics: [
      { event: "page_view", page: "/dashboard", user: "alice@acme.com" },
      { event: "page_view", page: "/projects", user: "bob@acme.com" },
      { event: "project_created", page: "/projects", user: "alice@acme.com" },
      { event: "page_view", page: "/members", user: "carol@acme.com" },
      { event: "report_viewed", page: "/reports", user: "david@acme.com" },
      { event: "page_view", page: "/dashboard", user: "bob@acme.com" },
      { event: "page_view", page: "/analytics", user: "alice@acme.com" },
    ],
  },
  {
    name: "ShubhamENT",
    slug: "shubhament",
    description: "Enterprise solutions for modern businesses",
    color: "#8b5cf6",
    email: "info@shubhament.com",
    phone: "+91 98765 43210",
    address: "456 Business Park, Mumbai, Maharashtra 400001",
    website: "https://shubhament.com",
    industry: "Insurance",
    plan: "enterprise",
    allowedPages: ["dashboard", "members", "projects", "reports", "billing", "settings"],
    members: [
      { name: "Shubham Patel", email: "shubham@shubhament.com", password: "Shubham@123", role: "org_admin", department: "Management" },
      { name: "Priya Sharma", email: "priya@shubhament.com", password: "Priya@123", role: "org_user", department: "Sales" },
      { name: "Raj Kumar", email: "raj@shubhament.com", password: "Raj@123", role: "org_user", department: "Operations" },
    ],
    projects: [
      { name: "Insurance Portal", key: "INSPR", description: "Customer-facing insurance management portal", status: "active" },
      { name: "Claims Automation", key: "CLAIM", description: "Automated claims processing system", status: "active" },
      { name: "Agent Dashboard", key: "AGNTD", description: "Dashboard for insurance agents", status: "inactive" },
    ],
    reports: [
      { title: "Claims Q1 2025", description: "First quarter claims analysis", type: "operations", status: "published" },
      { title: "Premium Revenue Report", description: "Monthly premium collection summary", type: "finance", status: "published" },
      { title: "Agent Performance", description: "Top performing agents this quarter", type: "sales", status: "draft" },
    ],
    notifications: [
      { title: "Policy Renewal Alert", message: "50 policies are due for renewal this month", type: "warning", targetUser: "all" },
      { title: "System Update", message: "Claims module updated to v3.2", type: "info", targetUser: "all" },
    ],
    tickets: [
      { subject: "Policy upload failing", description: "Bulk policy upload returns 500 error", status: "open", priority: "critical", createdBy: "priya@shubhament.com" },
      { subject: "Report generation timeout", description: "Large reports time out after 30s", status: "in_progress", priority: "high", createdBy: "raj@shubhament.com" },
    ],
    billing: { plan: "enterprise", amount: 299, currency: "USD", status: "active", invoices: [
      { id: "INV-E001", amount: 299, date: new Date("2024-11-01"), status: "paid" },
      { id: "INV-E002", amount: 299, date: new Date("2024-12-01"), status: "paid" },
      { id: "INV-E003", amount: 299, date: new Date("2025-01-01"), status: "paid" },
    ]},
    analytics: [
      { event: "page_view", page: "/dashboard", user: "shubham@shubhament.com" },
      { event: "page_view", page: "/reports", user: "priya@shubhament.com" },
      { event: "page_view", page: "/projects", user: "raj@shubhament.com" },
      { event: "report_viewed", page: "/reports", user: "shubham@shubhament.com" },
    ],
  },
];

async function seed() {
  console.log("🌱 Starting full seed...\n");

  // ── Main DB ──────────────────────────────────────────────────────────────────
  const mainConn = await mongoose.createConnection(`${MONGO_URI}/saas_main`).asPromise();
  const User = mainConn.models.User || mainConn.model("User", UserSchema);
  const Org = mainConn.models.Organization || mainConn.model("Organization", OrgSchema);

  // Super admin
  const superAdminEmail = "superadmin@saas.com";
  const existing = await User.findOne({ email: superAdminEmail });
  if (!existing) {
    const hash = await bcrypt.hash("SuperAdmin@123", 10);
    await User.create({ name: "Super Admin", email: superAdminEmail, password: hash, role: "super_admin" });
    console.log("✅ Super admin created: superadmin@saas.com / SuperAdmin@123");
  } else {
    console.log("ℹ️  Super admin already exists");
  }

  for (const orgData of ORGS) {
    // Create or update org in main DB
    let org = await Org.findOne({ slug: orgData.slug });
    if (!org) {
      org = await Org.create({
        name: orgData.name, slug: orgData.slug, description: orgData.description,
        color: orgData.color, email: orgData.email, phone: orgData.phone,
        address: orgData.address, website: orgData.website, industry: orgData.industry,
        plan: orgData.plan, isActive: true, allowedPages: orgData.allowedPages,
      });
      console.log(`✅ Org created: ${orgData.name}`);
    } else {
      await Org.findByIdAndUpdate(org._id, { allowedPages: orgData.allowedPages, color: orgData.color, plan: orgData.plan, description: orgData.description });
      console.log(`ℹ️  Org exists, updated: ${orgData.name}`);
    }

    // ── Org DB ──────────────────────────────────────────────────────────────────
    const orgConn = await mongoose.createConnection(`${MONGO_URI}/saas_org_${orgData.slug}`).asPromise();
    const OrgUser = orgConn.models.OrgUser || orgConn.model("OrgUser", OrgUserSchema);
    const Project = orgConn.models.Project || orgConn.model("Project", ProjectSchema);
    const Report = orgConn.models.Report || orgConn.model("Report", ReportSchema);
    const Notification = orgConn.models.Notification || orgConn.model("Notification", NotificationSchema);
    const Ticket = orgConn.models.SupportTicket || orgConn.model("SupportTicket", SupportTicketSchema);
    const Billing = orgConn.models.Billing || orgConn.model("Billing", BillingSchema);
    const Analytics = orgConn.models.Analytics || orgConn.model("Analytics", AnalyticsSchema);

    // Members
    for (const m of orgData.members) {
      const ex = await OrgUser.findOne({ email: m.email });
      if (!ex) {
        const hash = await bcrypt.hash(m.password, 10);
        await OrgUser.create({ name: m.name, email: m.email, password: hash, plainPassword: m.password, role: m.role, department: m.department, isActive: true });
        console.log(`  👤 Member: ${m.name} (${m.email}) — ${m.password}`);
      }
    }

    // Projects
    const projCount = await Project.countDocuments();
    if (projCount === 0) {
      for (const p of orgData.projects) {
        await Project.create({ ...p, createdBy: orgData.members[0].email });
      }
      console.log(`  📁 ${orgData.projects.length} projects created`);
    }

    // Reports
    const repCount = await Report.countDocuments();
    if (repCount === 0) {
      for (const r of orgData.reports) {
        await Report.create({ ...r, createdBy: orgData.members[0].email });
      }
      console.log(`  📊 ${orgData.reports.length} reports created`);
    }

    // Notifications
    const notifCount = await Notification.countDocuments();
    if (notifCount === 0) {
      for (const n of orgData.notifications) {
        await Notification.create({ ...n, isRead: false });
      }
      console.log(`  🔔 ${orgData.notifications.length} notifications created`);
    }

    // Support tickets
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      for (const t of orgData.tickets) {
        await Ticket.create(t);
      }
      console.log(`  🎧 ${orgData.tickets.length} support tickets created`);
    }

    // Billing
    const billingCount = await Billing.countDocuments();
    if (billingCount === 0) {
      await Billing.create({ ...orgData.billing, billingDate: new Date() });
      console.log(`  💳 Billing record created (${orgData.billing.plan})`);
    }

    // Analytics
    const analyticsCount = await Analytics.countDocuments();
    if (analyticsCount === 0) {
      for (const a of orgData.analytics) {
        await Analytics.create(a);
      }
      console.log(`  📈 ${orgData.analytics.length} analytics events created`);
    }

    await orgConn.close();
    console.log(`  ✅ ${orgData.name} seeded\n`);
  }

  await mainConn.close();
  console.log("🎉 Seed complete!\n");
  console.log("─────────────────────────────────────────");
  console.log("Super Admin:  superadmin@saas.com / SuperAdmin@123");
  console.log("Acme Admin:   alice@acme.com / Alice@123  (org: Acme Corp)");
  console.log("ShubhamENT:   shubham@shubhament.com / Shubham@123  (org: ShubhamENT)");
  console.log("─────────────────────────────────────────");
}

seed().catch((e) => { console.error(e); process.exit(1); });
