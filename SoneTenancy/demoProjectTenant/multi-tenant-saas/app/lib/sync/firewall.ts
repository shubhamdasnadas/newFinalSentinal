import { orgQuery } from "../db";
import axios from "axios";
import https from "https";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

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

export interface FirewallCredentials {
  baseUrl: string;
  apiKey: string;
}

export interface FirewallSyncResult {
  success: number;
  total: number;
  syncedAt: string;
}

export async function syncFirewall(
  orgSlug: string,
  creds: FirewallCredentials
): Promise<FirewallSyncResult> {
  const baseUrl = creds.baseUrl.replace(/\/$/, "");
  const apiKey = creds.apiKey;

  await orgQuery(
    orgSlug,
    `CREATE TABLE IF NOT EXISTS firewall_reports (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      report_name TEXT        NOT NULL UNIQUE,
      data        JSONB       NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  console.log(`[FW sync][${orgSlug}] Starting collection of ${REPORTS.length} reports`);

  let successCount = 0;
  for (const report of REPORTS) {
    try {
      const url = `${baseUrl}/api/?type=report&reportname=${report}&key=${apiKey}`;
      const response = await axios.get(url, { httpsAgent: agent });
      const json = parser.parse(response.data);

      await orgQuery(
        orgSlug,
        `INSERT INTO firewall_reports (report_name, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (report_name) DO UPDATE SET
           data       = EXCLUDED.data,
           updated_at = EXCLUDED.updated_at`,
        [report, JSON.stringify(json)]
      );
      successCount++;
    } catch (err: any) {
      console.error(`[FW sync][${orgSlug}] Error on ${report}:`, err.message);
    }
  }

  console.log(`[FW sync][${orgSlug}] Done — ${successCount}/${REPORTS.length} reports saved`);
  return { success: successCount, total: REPORTS.length, syncedAt: new Date().toISOString() };
}
