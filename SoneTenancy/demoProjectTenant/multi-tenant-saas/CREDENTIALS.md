# Integration Credentials Setup

This document explains how to configure real API credentials for each org so the background cron job can sync data automatically.

---

## How it works

The cron job (`/api/cron/sync`) runs on a schedule and:
1. Fetches all active orgs from the master database
2. For each org, reads credentials from the `integration_credentials` table in that org's database (`saas_org_<slug>`)
3. Calls the sync function for each configured integration

If no credentials exist for an org, it is skipped entirely.

---

## Option A — Through the Dashboard UI (recommended for real credentials)

Log in as an org admin, go to the integration settings page for each service, and enter the credentials. They are saved automatically to the org's database.

| Integration | Required fields |
|-------------|----------------|
| SentinelOne | Account ID, API Token |
| Checkpoint Harmony | Client ID, Access Key |
| Palo Alto Firewall | Base URL, API Key |

---

## Option B — Direct database insert (via script)

Use this when setting up programmatically or seeding a new org.

### Step 1 — Copy and edit the seed script

Copy `scripts/seed-pcpl-credentials.js` and rename it for your org (e.g. `seed-myorg-credentials.js`).

Change the database name at the top:
```js
database: "saas_org_<your-org-slug>",
```

Replace the dummy values in the `CREDENTIALS` array with real values:

#### SentinelOne
```js
{
  integration: "sentinelone",
  credentials: {
    accountId: "<your-account-id>",        // shown in SentinelOne console
    tokenKey:  "<your-api-token>",         // Settings → Users → Service Users
    baseUrl:   "https://<your-instance>.sentinelone.net",
  },
}
```

#### Checkpoint Harmony
```js
{
  integration: "harmony",
  credentials: {
    clientId:  "<your-client-id>",         // Infinity Portal → Global Settings → API Keys
    accessKey: "<your-access-key>",
  },
}
```

#### Palo Alto Firewall
```js
{
  integration: "firewall",
  credentials: {
    baseUrl: "https://<firewall-ip-or-hostname>:443",
    apiKey:  "<your-api-key>",             // Firewall → Device → Administrators → Generate API Key
  },
}
```

### Step 2 — Run the script

From the `newFinalSentinal` directory:
```bash
node SoneTenancy/demoProjectTenant/multi-tenant-saas/scripts/seed-myorg-credentials.js
```

### Step 3 — Verify the cron picks it up

```bash
node SoneTenancy/demoProjectTenant/multi-tenant-saas/scripts/run-cron.js
```

The org should now show sync results instead of `skipped — no credentials configured`:
```
[myorg] ✓ s1: 47 threats, 12 agents | harmony: 5 upserted | firewall: 31/31 reports
```

---

## Updating credentials

Re-running the seed script with new values performs an `ON CONFLICT DO UPDATE` — it safely overwrites existing credentials without creating duplicates.

You can also update a single integration without touching the others by removing the other entries from the `CREDENTIALS` array before running.

---

## Removing credentials

Connect to the org's database and delete the row:
```sql
-- connects to saas_org_<slug>
DELETE FROM integration_credentials WHERE integration = 'sentinelone';
```

The cron job will skip that integration on the next run.
