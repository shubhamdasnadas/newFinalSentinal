/**
 * POST /api/firewall/collect
 * Fetches all Palo Alto firewall reports (XML → JSON via fast-xml-parser)
 * and stores them in the org's own PostgreSQL database.
 *
 * Mirrors the original Express collectFirewallReports() exactly,
 * but persists to PostgreSQL instead of MongoDB.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";
import axios from "axios";
import https from "https";
import { XMLParser } from "fast-xml-parser";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

// Exact same parser config as the original Express code
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

// Allow self-signed certificates — same as original
const agent = new https.Agent({ rejectUnauthorized: false });

const REPORTS = [
  "bandwidth-trend",
  "risk-trend",
  "risky-users",
  "spyware-infected-hosts",
  "threat-trend",
  "top-application-categories",
  "top-applications",
  "top-attacker-destinations",
  "top-attacker-sources",
  "top-attackers-by-destination-countries",
  "top-attacks",
  "top-blocked-url-categories",
  "top-blocked-url-user-behavior",
  "top-blocked-url-users",
  "top-blocked-websites",
  "top-connections",
  "top-denied-applications",
  "top-denied-destinations",
  "top-denied-sources",
  "top-destination-countries",
  "top-destinations",
  "top-http-applications",
  "top-source-countries",
  "top-sources",
  "top-spyware-threats",
  "top-technology-categories",
  "top-url-categories",
  "top-url-user-behavior",
  "top-url-users",
  "top-users",
  "top-victim-destinations",
  "top-victim-sources",
  "top-victims-by-destination-countries",
  "top-viruses",
  "top-vulnerabilities",
  "top-websites",
];

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const baseUrl = process.env.FIREWALL_BASE_URL;
    const apiKey  = process.env.FIREWALL_API_KEY;

    console.log("[FW] FIREWALL_BASE_URL:", baseUrl ? baseUrl : "NOT SET");
    console.log("[FW] FIREWALL_API_KEY:", apiKey ? `${apiKey.slice(0, 10)}...` : "NOT SET");

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { message: "Firewall not configured — FIREWALL_BASE_URL or FIREWALL_API_KEY missing" },
        { status: 503 }
      );
    }

    // Ensure table exists in org's database
    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS firewall_reports (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        report_name TEXT        NOT NULL UNIQUE,
        data        JSONB       NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    console.log("[FW] Starting firewall collection for org:", orgSlug);

    const results: { report: string; status: string; error?: string }[] = [];

    for (const report of REPORTS) {
      try {
        console.log("[FW] Fetching:", report);

        const url = `${baseUrl}/api/?type=report&reportname=${report}&key=${apiKey}`;

        // Use axios with httpsAgent — exactly like the original Express code
        const response = await axios.get(url, { httpsAgent: agent });

        // Parse XML → JSON using fast-xml-parser — exactly like the original
        const json = parser.parse(response.data);

        // Upsert into org's PostgreSQL database (replaces MongoDB findOneAndUpdate)
        await orgQuery(
          orgSlug,
          `INSERT INTO firewall_reports (report_name, data, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (report_name) DO UPDATE SET
             data       = EXCLUDED.data,
             updated_at = EXCLUDED.updated_at`,
          [report, JSON.stringify(json)]
        );

        console.log("[FW] Saved:", report);
        results.push({ report, status: "success" });
      } catch (err: any) {
        console.error("[FW] Error on", report, ":", err.message);
        results.push({ report, status: "error", error: err.message });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    return NextResponse.json({
      message: `Saved ${successCount}/${REPORTS.length} reports to PostgreSQL`,
      results,
      total: REPORTS.length,
      success: successCount,
    });
  } catch (error: any) {
    console.error("[FW] Collection error:", error.message);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
