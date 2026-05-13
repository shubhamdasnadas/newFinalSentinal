# 🚀 Quick Start Guide

## Prerequisites Installed ✅
- ✅ Node.js v22+
- ✅ PostgreSQL 16 (at `C:\Program Files\PostgreSQL\16`)
- ✅ npm dependencies

---

## 5-Minute Setup

### 1️⃣ Add PostgreSQL to PATH (One-time setup)

**Option A: Temporary (current session only)**
```powershell
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"
```

**Option B: Permanent (recommended)**
```powershell
# Run PowerShell as Administrator
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";C:\Program Files\PostgreSQL\16\bin",
    "Machine"
)
```

Then restart your terminal.

---

### 2️⃣ Create Database

```powershell
# Connect to PostgreSQL (default password: postgres)
psql -U postgres

# In psql prompt, run:
CREATE DATABASE "P4C";
\q
```

---

### 3️⃣ Run Migration & Seed

```bash
# Create tables
psql -U postgres -d P4C -f scripts/migrate.sql

# Seed dummy data
npx tsx scripts/seed-pg.ts
```

---

### 4️⃣ Start Development Server

```bash
npm run dev
```

---

### 5️⃣ Login

Open: http://localhost:3000

**Super Admin:**
- Email: `superadmin@saas.com`
- Password: `SuperAdmin@123`

**Organization User (Acme Corp):**
- Email: `alice@acme.com`
- Password: `Alice@123`

---

## 🔧 If psql is not in PATH

Use full path for all commands:

```powershell
# Create database
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres

# Run migration
$env:PGPASSWORD="root"; & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d P4C -f scripts/migrate.sql
```

---

## 🆘 Common Issues

### "database P4C does not exist"
```sql
CREATE DATABASE "P4C";
```

### "password authentication failed"
Update `.env.local`:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/P4C
```

### "relation does not exist"
```bash
psql -U postgres -d P4C -f scripts/migrate.sql
```

### "Port 3000 already in use"
```bash
# Windows: Find and kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 📋 What's Included

- ✅ PostgreSQL database with 10 tables
- ✅ 3 organizations with members
- ✅ Projects, reports, notifications, support tickets
- ✅ Billing and invoices
- ✅ Analytics events
- ✅ JWT authentication
- ✅ Multi-tenant architecture

---

## 📚 More Details

See `POSTGRESQL_SETUP.md` for comprehensive documentation.
