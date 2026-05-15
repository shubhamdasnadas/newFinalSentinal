import mongoose from "mongoose";

const conn = await mongoose.createConnection("mongodb://localhost:27017/saas_org_shubhament").asPromise();
const OrgUser = conn.model("OrgUser", new mongoose.Schema({ name: String, email: String, role: String, isActive: Boolean }));
const users = await OrgUser.find().select("name email role isActive");
console.log("ShubhamENT users:", JSON.stringify(users, null, 2));
await conn.close();
process.exit(0);
