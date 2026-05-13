# PostgreSQL Setup Guide for Multi-Tenant SaaS

## ✅ Current Status

Your project is **already configured** for PostgreSQL! Here's what's in place:

### 🔧 What's Already Set Up

1. **Database Connection** (`app/lib/db.ts`)
   - PostgreSQL connection pool using `node-postgres` (pg)
   - Singleton pattern with hot-reload support
   - Transaction support via `withTransaction()`

2. **Database Schema** (`scripts/migrate.sql`)
   - 9 tables with proper indexes and foreign keys
   - UUID primary keys
   - Automatic `updated_at` triggers
   - Multi-tenant architecture with `org_slug` isolation

3. **Data Models** (`app/models/`)
   - `User.ts` - Super admin users
   - `Organization.ts` - Organization/tenant management
   - `OrgModels.ts` - All tenant-scoped models (projects, reports, etc.)

4. **Environment Configuration** (`.env.local`)
   - Database connection string
   - JWT secret for authentication
   - Super admin credentials

5. **Seed Scripts** (`scripts/`)
   - `migrate.sql` - Creates all tables
   - `seed-pg.ts` - Seeds dummy data (3 orgs with members, projects, etc.)

---

## 🚀 Quick Start (If Not Already Done)

### Step 1: Verify PostgreSQL Installation

You have PostgreSQL 17 installed at: `C:\Program Files\PostgreSQL\17`

Add PostgreSQL to your PATH (if not already):
```powershell
# Run as Administrator
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::Machine)
```

Or use the full path in commands:
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
```

### Step 2: Create Database

```powershell
# Connect to PostgreSQL (default password is usually 'postgres')
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres

# In psql prompt:
CREATE DATABASE "P4C";
\q
```

### Step 3: Install Dependencies

```bash
cd demoProjectTenant/multi-tenant-saas
npm install
```

### Step 4: Run Database Migration

```powershell
# Option A: Using psql directly
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d P4C -f scripts/migrate.sql

# Option B: If psql is in PATH
psql -U postgres -d P4C -f scripts/migrate.sql
```

### Step 5: Seed Database with Dummy Data

```bash
npx tsx scripts/seed-pg.ts
```

### Step 6: Start Development Server

```bash
npm run dev
```

### Step 7: Open Application

Navigate to: http://localhost:3000

---

## 🔐 Login Credentials (After Seeding)

### Super Admin
- **Email:** superadmin@saas.com
- **Password:** SuperAdmin@123

### Organization Users

#### Acme Corp
- alice@acme.com / Alice@123 (org_admin)
- bob@acme.com / Bob@123 (org_user)
- carol@acme.com / Carol@123 (org_user)
- david@acme.com / David@123 (org_user)

#### ShubhamENT
- shubham@shubhament.com / Shubham@123 (org_admin)
- priya@shubhament.com / Priya@123 (org_user)
- raj@shubhament.com / Raj@123 (org_user)
- neha@shubhament.com / Neha@123 (org_user)

#### TechNova
- emma@technova.io / Emma@123 (org_admin)
- liam@technova.io / Liam@123 (org_user)
- sofia@technova.io / Sofia@123 (org_user)

---

## 📊 Database Schema

### Core Tables

1. **users** - Super admin accounts
   - id, name, email, password, role, org_id, org_slug, is_active

2. **organizations** - Tenant metadata
   - id, name, slug, description, color, email, phone, address, website, industry, plan, is_active, allowed_pages

3. **org_users** - Organization members (tenant-isolated)
   - id, org_slug, name, email, password, role, department, is_active

### Tenant-Scoped Tables (all have `org_slug`)

4. **projects** - Project management
5. **reports** - Report generation
6. **notifications** - User notifications
7. **support_tickets** - Support system
8. **billing** - Billing information
9. **invoices** - Invoice records
10. **analytics_events** - Analytics tracking

---

## 🔧 Environment Variables

Your `.env.local` file is already configured:

```env
# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/P4C

# JWT Secret
JWT_SECRET=GLYE1oQoUQlfbi4POaDk2Zgqc8vwlnDOONl0G8I8uSA

# Super Admin Credentials
SUPER_ADMIN_EMAIL=superadmin@saas.com
SUPER_ADMIN_PASSWORD=SuperAdmin@123
```

**⚠️ Important:** Change `JWT_SECRET` and database password in production!

---

## 🛠️ Available NPM Scripts

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm run migrate  # Run database migration (requires psql in PATH)
npm run seed     # Seed database with dummy data
```

---

## 🏗️ Multi-Tenancy Architecture

### Tenant Isolation Strategy
- **Method:** Shared database with `org_slug` discriminator
- **Security:** All queries filter by `org_slug` from JWT token
- **Scalability:** Single PostgreSQL database "P4C"

### How It Works
1. User logs in → JWT token includes `activeOrgSlug`
2. API routes extract `org_slug` from token
3. All database queries filter by `org_slug`
4. Data is isolated per organization

### Example Query Pattern
```typescript
// All tenant-scoped queries include org_slug
const projects = await query(
  "SELECT * FROM projects WHERE org_slug = $1",
  [orgSlug]
);
```

---

## 🔍 Troubleshooting

### Issue: "psql: command not found"
**Solution:** Add PostgreSQL to PATH or use full path:
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres
```

### Issue: "database P4C does not exist"
**Solution:** Create the database:
```sql
CREATE DATABASE "P4C";
```

### Issue: "password authentication failed"
**Solution:** Update `.env.local` with correct PostgreSQL password:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/P4C
```

### Issue: "relation does not exist"
**Solution:** Run migration script:
```bash
psql -U postgres -d P4C -f scripts/migrate.sql
```

### Issue: "No data in database"
**Solution:** Run seed script:
```bash
npx tsx scripts/seed-pg.ts
```

### Issue: "Port 3000 already in use"
**Solution:** Kill the process or use a different port:
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
PORT=3001 npm run dev
```

---

## 📦 Dependencies

### Production
- `pg` (8.20.0) - PostgreSQL client
- `@types/pg` (8.20.0) - TypeScript types
- `bcryptjs` (3.0.3) - Password hashing
- `jsonwebtoken` (9.0.3) - JWT authentication
- `next` (16.2.4) - React framework
- `react` (19.2.4) - UI library

### Development
- `tsx` (4.19.2) - TypeScript execution
- `typescript` (5.x) - Type checking
- `tailwindcss` (4.x) - Styling

---

## 🔐 Security Best Practices

1. **Change JWT_SECRET** in production
2. **Use strong database passwords**
3. **Enable SSL for PostgreSQL** in production
4. **Use environment-specific .env files**
5. **Never commit .env files** to version control
6. **Use parameterized queries** (already implemented)
7. **Hash passwords** with bcrypt (already implemented)
8. **Validate org_slug** in all tenant-scoped queries

---

## 🚀 Production Deployment Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update database credentials
- [ ] Enable PostgreSQL SSL connection
- [ ] Set `NODE_ENV=production`
- [ ] Run `npm run build`
- [ ] Set up database backups
- [ ] Configure connection pooling limits
- [ ] Enable database query logging
- [ ] Set up monitoring and alerts
- [ ] Review and update CORS settings
- [ ] Enable rate limiting
- [ ] Set up CDN for static assets

---

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres (pg) Documentation](https://node-postgres.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/multi-tenancy)

---

## 🆘 Need Help?

1. Check the `.env.local` file for configuration
2. Review `app/lib/db.ts` for connection setup
3. Check `scripts/migrate.sql` for schema
4. Review `app/models/` for data access patterns
5. Check browser console and terminal for errors

---

**Last Updated:** April 29, 2026
**PostgreSQL Version:** 17
**Node.js Version:** 24.12.0
