/**
 * Drops OrgUser collections and re-seeds with plainPassword field.
 * Run: npx tsx scripts/reseed-users.ts
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = "mongodb://localhost:27017";

const OrgUserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  plainPassword: String,
  role: String,
  department: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const ORGS = [
  {
    slug: "acme_corp",
    members: [
      { name: "Alice Johnson", email: "alice@acme.com",   password: "Alice@123",   role: "org_admin", department: "Engineering" },
      { name: "Bob Smith",     email: "bob@acme.com",     password: "Bob@123",     role: "org_user",  department: "Product" },
      { name: "Carol White",   email: "carol@acme.com",   password: "Carol@123",   role: "org_user",  department: "Design" },
      { name: "David Lee",     email: "david@acme.com",   password: "David@123",   role: "org_user",  department: "Marketing" },
    ],
  },
  {
    slug: "shubhament",
    members: [
      { name: "Shubham Patel", email: "shubham@shubhament.com", password: "Shubham@123", role: "org_admin", department: "Management" },
      { name: "Priya Sharma",  email: "priya@shubhament.com",   password: "Priya@123",   role: "org_user",  department: "Sales" },
      { name: "Raj Kumar",     email: "raj@shubhament.com",     password: "Raj@123",     role: "org_user",  department: "Operations" },
    ],
  },
];

async function run() {
  for (const org of ORGS) {
    const conn = await mongoose.createConnection(`${MONGO_URI}/saas_org_${org.slug}`).asPromise();

    // Drop and recreate
    try { await conn.dropCollection("orgusers"); } catch {}

    const OrgUser = conn.model("OrgUser", OrgUserSchema);

    for (const m of org.members) {
      const hash = await bcrypt.hash(m.password, 10);
      await OrgUser.create({
        name: m.name,
        email: m.email,
        password: hash,
        plainPassword: m.password,   // ← stored in plain text for reference
        role: m.role,
        department: m.department,
        isActive: true,
      });
      console.log(`✅ [${org.slug}] ${m.name} — email: ${m.email} | password: ${m.password}`);
    }

    await conn.close();
  }

  console.log("\n🎉 Done! Login credentials:");
  console.log("─────────────────────────────────────────────────────");
  console.log("Org: Acme Corp");
  console.log("  alice@acme.com   / Alice@123   (admin)");
  console.log("  bob@acme.com     / Bob@123     (member)");
  console.log("  carol@acme.com   / Carol@123   (member)");
  console.log("  david@acme.com   / David@123   (member)");
  console.log("\nOrg: ShubhamENT");
  console.log("  shubham@shubhament.com / Shubham@123  (admin)");
  console.log("  priya@shubhament.com   / Priya@123    (member)");
  console.log("  raj@shubhament.com     / Raj@123      (member)");
  console.log("─────────────────────────────────────────────────────");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
