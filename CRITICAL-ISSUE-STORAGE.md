# 🚨 CRITICAL: TaskService Not Using Storage Abstraction

## The Problem

Your Render deployment has `STORAGE_BACKEND=supabase` correctly configured, but **tasks are not being saved to Supabase**.

### Root Cause

The codebase has **TWO separate systems** that are not connected:

1. **Storage Abstraction Layer** (`server/src/storage/`) - Supports both file and Supabase backends ✅
2. **TaskService** (`server/src/services/task-service.ts`) - Hardcoded to use files ❌

The `TaskService` writes tasks directly to the filesystem and **never uses the storage abstraction layer**:

```typescript
// TaskService.createTask() - Line 404
const filepath = path.join(this.tasksDir, filename);
await fs.writeFile(filepath, content, 'utf-8'); // ❌ Writes to file!
```

Meanwhile, the storage abstraction sits unused:

```typescript
// server/src/storage/supabase-storage.ts - NEVER CALLED
class SupabaseTaskRepository implements TaskRepository {
  async create(task: Task): Promise<Task> {
    const { data, error } = await supabase.from('tasks').insert(...) // ✅ Would save to Supabase
  }
}
```

## Impact

- ✅ `STORAGE_BACKEND=supabase` is set correctly
- ✅ Supabase connection works
- ✅ Database schema is applied
- ❌ **Tasks still go to files, not Supabase**
- ❌ Data is lost when Render spins down (free tier)

## Verification

I confirmed this by:

1. Checking Supabase directly - only 1 test task exists (from earlier manual test)
2. No new tasks appear in Supabase when created via the app
3. TaskService code shows direct `fs.writeFile()` calls, no `getStorage()` usage

## The Fix (3 Options)

### Option 1: Quick Fix - Make TaskService Use Storage (Recommended)

Modify `TaskService` to delegate to the storage layer:

**Pros:**

- Works with both file and Supabase backends
- Minimal code changes
- Respects `STORAGE_BACKEND` env var

**Cons:**

- Loses some TaskService features (cache, file watcher, markdown)
- Requires careful refactoring

**Implementation:**

```typescript
// server/src/services/task-service.ts

import { getStorage } from '../storage/index.js';

export class TaskService {
  async createTask(input: CreateTaskInput): Promise<Task> {
    const storage = getStorage();
    const task: Task = {
      id: this.generateId(),
      title: input.title,
      // ... rest of task object
    };

    // Use storage layer instead of fs.writeFile
    return await storage.tasks.create(task);
  }

  async listTasks(): Promise<Task[]> {
    const storage = getStorage();
    return await storage.tasks.findAll();
  }

  // ... update all methods to use storage.tasks.*
}
```

### Option 2: Bypass TaskService (Fastest)

Update routes to use storage directly instead of TaskService:

**Pros:**

- Immediate fix
- No refactoring needed

**Cons:**

- Breaks existing TaskService features
- Inconsistent architecture

**Implementation:**

```typescript
// server/src/routes/tasks.ts

import { getStorage } from '../storage/index.js';

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const storage = getStorage();
    const task = await storage.tasks.create({
      id: generateId(),
      ...req.body,
    });
    res.json(task);
  })
);
```

### Option 3: Feature Flag (Temporary)

Add a flag to switch between file and storage:

**Pros:**

- Can test both systems
- Safe rollback

**Cons:**

- Technical debt
- Two code paths to maintain

## Recommended Approach

**Option 1** (Make TaskService use storage) is the correct long-term solution. Here's why:

1. **Preserves API**: All routes continue using TaskService
2. **Respects STORAGE_BACKEND**: Works with both file and Supabase
3. **Clean architecture**: Single responsibility
4. **Future-proof**: Easy to add more storage backends

## Implementation Steps

1. **Backup current TaskService** (in case we need to revert)
2. **Update TaskService methods** to use `getStorage().tasks.*`
3. **Remove file-specific code** (cache, watcher, markdown parsing)
4. **Test locally** with both backends
5. **Deploy to Render**
6. **Verify** tasks save to Supabase

## Immediate Workaround

Until we fix this, you have two options:

### A. Use File Storage (Default)

Remove `STORAGE_BACKEND` from Render ENVs:

- Tasks will save to container filesystem
- ⚠️ **Data lost on spin-down**

### B. Manually Migrate (Temporary)

1. Create tasks via Supabase SQL:

```sql
INSERT INTO tasks (id, title, description, status, type, created_at, updated_at)
VALUES ('task_001', 'My Task', 'Description', 'todo', 'task', NOW(), NOW());
```

2. View tasks via direct Supabase API (bypasses app)

## Next Steps

I'll create a fix for Option 1. This will require:

1. Refactoring TaskService to be storage-agnostic
2. Moving cache/watcher logic to optional layer
3. Testing with both file and Supabase backends
4. Updating documentation

## Timeline Estimate

- **Quick hack** (Option 2): 30 minutes
- **Proper fix** (Option 1): 2-4 hours
- **Testing + deployment**: 1 hour

Total: **3-5 hours** for a production-ready solution

## Questions?

1. Do you want the quick hack or proper fix?
2. Are there other services (activity, templates, etc.) also affected?
3. Should we keep file support or go Supabase-only?
4. Can I break the cache/watcher features temporarily?

Let me know how you want to proceed!
