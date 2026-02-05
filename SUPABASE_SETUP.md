# Supabase Integration Setup Guide

This guide walks you through setting up Veritas Kanban with Supabase PostgreSQL backend.

## ✅ Completed Steps

- [x] Supabase project created
- [x] PostgreSQL schema created (all tables)
- [x] TypeScript storage provider implemented (`supabase-storage.ts`)
- [x] Environment configuration (`supabase.ts`)
- [x] Storage backend selector added to `storage/index.ts`

## 🎯 Next Steps

### 1. Install Supabase Client

```bash
cd ~/Desktop/veritas-kanban
pnpm add @supabase/supabase-js
```

### 2. Set Environment Variables

Create or update `.env` in the server root:

```bash
# Existing vars
NODE_ENV=production
PORT=3001

# Supabase vars
STORAGE_BACKEND=supabase
SUPABASE_URL=https://jwkrhixstgxtazynraua.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3a3JoaXhzdGd4dGF6eW5yYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDU1NzAsImV4cCI6MjA4NTgyMTU3MH0.jpeitAqst6juYCbIVliivsKAva80Etq6ZdUdYbxVxwc
```

⚠️ **Security Note:** The anon key is public. For production with direct Supabase API calls, use the service key (more restricted). For now, the anon key is fine for server-side initialization.

### 3. Initialize Storage Backend in Server Startup

In `server/src/index.ts`, add this near the top of the `(async () => { ... })()` block:

```typescript
import { initializeStorageBackend } from './config/storage-config.js';

(async () => {
  try {
    // Initialize storage backend (file or supabase)
    await initializeStorageBackend();

    // ... rest of startup code
```

### 4. Build & Test

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test (optional)
pnpm test

# Run locally
pnpm dev
```

### 5. Deploy to Render

Push code to GitHub, then:

1. Go to https://dashboard.render.com
2. Connect your repo
3. Create new **Web Service**
4. Set environment variables in Render settings:
   ```
   STORAGE_BACKEND=supabase
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   ```
5. Deploy

The app will no longer lose data on sleep/restart. ✅

---

## 📋 What's Implemented

### Storage Provider Classes

- **SupabaseTaskRepository** - Tasks CRUD, search, archive
- **SupabaseSettingsRepository** - Feature settings persistence
- **SupabaseActivityRepository** - Activity logging
- **SupabaseTemplateRepository** - Task template management
- **SupabaseStatusHistoryRepository** - Agent status tracking & summaries
- **SupabaseManagedListRepository** - Generic list management (projects, sprints, etc.)
- **SupabaseTelemetryRepository** - Event tracking & analytics

All implement the standard `StorageProvider` interface, so swapping between file ↔ Supabase requires only changing the `STORAGE_BACKEND` env var.

---

## 🔄 Data Migration (Optional)

If you want to migrate existing data from file storage to Supabase:

### Export from File Storage

```bash
# Start with file backend
STORAGE_BACKEND=file pnpm start

# Use the admin API or write a migration script to export data
# Example: fetch all tasks from ./tasks/active/*.md
```

### Import to Supabase

Create a migration script in `server/src/scripts/migrate-to-supabase.ts`:

```typescript
import { getStorage } from '../storage/index.js';
import { supabase } from '../config/supabase.js';

export async function migrateToSupabase() {
  // 1. Read all tasks from file system
  // 2. Insert into Supabase
  // 3. Verify counts match
}
```

Run:

```bash
tsx server/src/scripts/migrate-to-supabase.ts
```

---

## 🛠️ Troubleshooting

### Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY

**Solution:** Check `.env` file has correct values (no leading/trailing spaces).

```bash
# Verify
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

### Error: Connection refused

**Solution:** Verify Supabase network is accessible from your environment.

```bash
# Test connection
curl https://jwkrhixstgxtazynraua.supabase.co/rest/v1/tasks \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Error: Tasks table doesn't exist

**Solution:** Tables may not have been created. Run the SQL schema manually:

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Paste content from `supabase-schema.sql`
4. Run

---

## 📊 Monitoring

### View Data in Supabase Console

1. Go to https://app.supabase.com
2. Select your project
3. Click **Table Editor**
4. Browse tables: tasks, activity, telemetry, etc.

### Check Logs

```bash
# Server logs
pnpm dev

# Filter for Supabase errors
pnpm dev 2>&1 | grep -i supabase
```

---

## 🔐 Security Notes

- **Anon Key:** Public, safe to commit (read/write only allowed data)
- **Service Key:** Secret, keep in `.env.local` / CI/CD secrets only
- **RLS:** Disabled for now; enable when multi-user support is needed
- **CORS:** Configured for local dev; update for production domain

---

## 📚 Files Added/Modified

| File                                     | Purpose                                         |
| ---------------------------------------- | ----------------------------------------------- |
| `server/src/config/supabase.ts`          | Supabase client initialization                  |
| `server/src/config/storage-config.ts`    | Storage backend selector                        |
| `server/src/storage/supabase-storage.ts` | All 7 repository implementations                |
| `server/src/storage/index.ts`            | Added 'supabase' backend type                   |
| `.env`                                   | New env vars: `STORAGE_BACKEND`, `SUPABASE_*`   |
| `supabase-schema.sql`                    | PostgreSQL schema (already created in Supabase) |

---

## ✨ Next Features

- [ ] Data migration script
- [ ] RLS policies for multi-user
- [ ] Backup/restore functionality
- [ ] Real-time subscriptions (Supabase Realtime)
- [ ] Full-text search optimization
- [ ] Automated backups to S3

---

**Questions?** Check the files or test with:

```bash
npm run dev
# Will fail if env vars are wrong — that's the validation working!
```
