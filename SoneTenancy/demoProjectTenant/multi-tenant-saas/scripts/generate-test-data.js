/**
 * Background sync test data generator.
 *
 * Creates a sync_test_log table in the specified org's database and inserts
 * a new row every 10 seconds with an incrementing counter and timestamp.
 *
 * Usage: node scripts/generate-test-data.js <orgSlug>
 * Example: node scripts/generate-test-data.js techsec_digital
 *
 * Stop with Ctrl+C. The table persists so the dashboard can read it.
 * To clean up: psql -d saas_org_<orgSlug> -c "DROP TABLE sync_test_log;"
 */

const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const orgSlug = process.argv[2];
if (!orgSlug) {
  console.error("Usage: node scripts/generate-test-data.js <orgSlug>");
  console.error("Example: node scripts/generate-test-data.js techsec_digital");
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.PG_HOST     || "localhost",
  port:     parseInt(process.env.PG_PORT || "5432", 10),
  user:     process.env.PG_USER     || "postgres",
  password: process.env.PG_PASSWORD || "root",
  database: `saas_org_${orgSlug}`,
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_test_log (
      id         SERIAL      PRIMARY KEY,
      counter    INTEGER     NOT NULL,
      label      TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log(`[sync-test] Table ready in saas_org_${orgSlug}`);
  console.log("[sync-test] Inserting a row every 10 seconds. Press Ctrl+C to stop.\n");

  let counter = 0;

  async function insert() {
    counter++;
    const label = new Date().toISOString();
    await pool.query(
      "INSERT INTO sync_test_log (counter, label) VALUES ($1, $2)",
      [counter, label]
    );
    console.log(`[sync-test] Inserted row #${counter} at ${label}`);
  }

  await insert();
  const interval = setInterval(insert, 10_000);

  process.on("SIGINT", async () => {
    clearInterval(interval);
    console.log(`\n[sync-test] Stopped. ${counter} rows written to sync_test_log.`);
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[sync-test] Fatal:", err.message);
  process.exit(1);
});
