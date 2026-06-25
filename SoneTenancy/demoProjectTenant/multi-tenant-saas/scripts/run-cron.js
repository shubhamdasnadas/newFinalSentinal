/**
 * Local dev cron scheduler.
 *
 * Calls POST /api/cron/sync on a regular interval to simulate background syncing
 * while the browser is closed.
 *
 * Usage: node scripts/run-cron.js [intervalSeconds]
 * Example (every 30s): node scripts/run-cron.js 30
 * Example (every 2min): node scripts/run-cron.js 120
 *
 * Default interval: 30 seconds
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const INTERVAL_S = parseInt(process.argv[2] || "30", 10);
const CRON_SECRET = process.env.CRON_SECRET;
const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/api/cron/sync`;

if (!CRON_SECRET) {
  console.error("[run-cron] ERROR: CRON_SECRET not found in .env.local");
  process.exit(1);
}

console.log(`[run-cron] Scheduler started — calling ${URL} every ${INTERVAL_S}s`);
console.log("[run-cron] Press Ctrl+C to stop.\n");

async function runSync() {
  const start = new Date();
  console.log(`[run-cron] ▶ Sync started at ${start.toLocaleTimeString()}`);
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[run-cron] ✗ HTTP ${res.status}:`, data.message ?? data);
      return;
    }

    const elapsed = ((Date.now() - start.getTime()) / 1000).toFixed(1);
    console.log(`[run-cron] ✓ Completed in ${elapsed}s — ${data.orgsProcessed} org(s) processed`);

    for (const [slug, result] of Object.entries(data.results ?? {})) {
      const r = result;
      if (r.status === "skipped") {
        console.log(`  [${slug}] skipped — ${r.reason}`);
      } else if (r.status === "error") {
        console.log(`  [${slug}] error — ${r.error}`);
      } else {
        const parts = Object.entries(r.integrations ?? {}).map(([name, res]) => {
          if (res.error) return `${name}: error (${res.error})`;
          if (name === "sentinelone") return `s1: ${res.threats ?? 0} threats, ${res.agents ?? 0} agents`;
          if (name === "harmony") return `harmony: ${res.upserted ?? 0} upserted (${res.totalInDb ?? 0} total)`;
          if (name === "firewall") return `firewall: ${res.success ?? 0}/${res.total ?? 0} reports`;
          return `${name}: done`;
        });
        console.log(`  [${slug}] ✓ ${parts.join(" | ")}`);
      }
    }
  } catch (err) {
    console.error(`[run-cron] ✗ Request failed:`, err.message);
    console.error(`[run-cron]   Is the dev server running on port ${PORT}?`);
  }
  console.log();
}

runSync();
const interval = setInterval(runSync, INTERVAL_S * 1000);

process.on("SIGINT", () => {
  clearInterval(interval);
  console.log("\n[run-cron] Stopped.");
  process.exit(0);
});
