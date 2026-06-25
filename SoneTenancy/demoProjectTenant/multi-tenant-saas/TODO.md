# TODO - Background Sync Jobs (Logout-safe)

- [ ] Add `sync_jobs` table SQL into org schema (`app/lib/db.ts` ORG_SCHEMA_SQL)
- [ ] Add job model helpers: create job, fetch pending job, update status
- [ ] Create API routes:
  - [ ] `POST /api/sync-jobs/create` (create a job and return immediately)
  - [ ] `GET /api/sync-jobs/[id]` (read status)
  - [ ] `GET /api/sync-jobs/status` (optional)
- [ ] Implement worker script (Node) that polls DB and runs syncs:
  - [ ] `npm run worker` wiring in `package.json`
  - [ ] `worker.ts` reads all active org slugs from master DB
  - [ ] For each org, find `PENDING` job, mark `RUNNING`, execute sync per `source`
  - [ ] Execute using existing sync logic but refactored into pure functions so they do NOT rely on browser cookies
- [ ] Refactor existing sync endpoints (`/api/sentinelone/sync` and harmony sync) into reusable service functions that worker can call.
- [ ] Replace client-side `BackgroundSync.tsx` (interval-based) with button->create-job calls.
- [ ] Update UI components to use job-create endpoint and show job progress from DB.
- [ ] Verify build + run:
  - [ ] `npm run build`
  - [ ] start worker in separate terminal
  - [ ] trigger sync, logout, verify worker continues and DB updates

