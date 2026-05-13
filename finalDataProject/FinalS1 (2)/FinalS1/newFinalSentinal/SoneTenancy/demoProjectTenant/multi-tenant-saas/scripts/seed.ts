/**
 * Run: npx ts-node --project tsconfig.json scripts/seed.ts
 * Or:  npx tsx scripts/seed.ts
 *
 * Creates the super admin user in the main DB.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "superadmin@saas.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  orgId: mongoose.Schema.Types.ObjectId,
  orgSlug: String,
  orgName: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

async function seed() {
  const conn = await mongoose.createConnection(`${MONGO_URI}/saas_main`).asPromise();
  const User = conn.models.User || conn.model("User", UserSchema);

  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL });
  if (existing) {
    console.log("✅ Super admin already exists:", SUPER_ADMIN_EMAIL);
    await conn.close();
    return;
  }

  const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await User.create({
    name: "Super Admin",
    email: SUPER_ADMIN_EMAIL,
    password: hash,
    role: "super_admin",
  });

  console.log("✅ Super admin created:", SUPER_ADMIN_EMAIL);
  console.log("   Password:", SUPER_ADMIN_PASSWORD);
  await conn.close();
}

seed().catch(console.error);
