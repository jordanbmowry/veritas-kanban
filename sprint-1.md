# Sprint 1: Foundation & Core Kanban

**Goal:** Basic task board with CRUD operations and file persistence.

**Started:** 2026-01-26
**Status:** Complete ✅

---

## Stories

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| US-101 | Project scaffolding with dev container | ✅ Complete | |
| US-102 | Task file schema and parser | ✅ Complete | gray-matter, 15 unit tests |
| US-103 | REST API for task CRUD | ✅ Complete | Full CRUD + archive + zod validation |
| US-104 | Kanban board UI shell | ✅ Complete | Loading skeleton, 4 columns |
| US-105 | Task card component | ✅ Complete | Icons, colors, tooltip, click handler |
| US-106 | Create task dialog | ✅ Complete | All fields, validation |
| US-107 | Task detail panel | ✅ Complete | Sheet, auto-save, delete confirmation |
| US-108 | Drag and drop between columns | ✅ Complete | @dnd-kit, visual feedback |
| US-109 | Push to GitHub repositories | ⏳ In Progress | |

---

## Progress Log

### 2026-01-26

**US-101: Project scaffolding** ✅
- Created monorepo with pnpm workspaces
- Dev container configured with Node.js 22
- Server package: Express + WebSocket
- Web package: React 19 + Vite + shadcn/ui
- Shared package: TypeScript types
- Git initialized with both remotes (work + personal)
- Typecheck passes
- Dev server running at http://localhost:3000

**US-102: Task file schema and parser** ✅
- Full Task interface in `shared/src/types.ts`
- TaskService with injectable paths for testing
- gray-matter for markdown parsing
- Slug generation for filenames
- 15 unit tests covering:
  - Parsing (valid, minimal, git metadata, attempts)
  - Creation (full fields, minimal, slug generation)
  - Updates (fields, file rename on title change)
  - Deletion
  - Archival
- Fixed: undefined value handling in frontmatter

**US-103: REST API for task CRUD** ✅
- `GET /api/tasks` — list all active tasks
- `GET /api/tasks/:id` — get single task
- `POST /api/tasks` — create task
- `PATCH /api/tasks/:id` — update task
- `DELETE /api/tasks/:id` — delete task
- `POST /api/tasks/:id/archive` — archive completed task
- Zod validation schemas
- Proper error handling and status codes
- Vite proxy configured for frontend → API

**US-104: Kanban board UI shell** ✅
- 4 columns: To Do, In Progress, Review, Done
- Dark theme via shadcn/ui
- Column headers with task count badges
- Empty state message per column
- Loading skeleton while fetching

**US-105: Task card component** ✅
- Type icons (Code, Search, FileText, Zap)
- Color-coded left border by type
- Priority badges with color coding
- Project tag display
- Tooltip on hover for full title
- Click opens task detail panel

**US-106: Create task dialog** ✅
- Modal dialog with form
- Fields: title (required), description, type, priority, project
- Type defaults to 'code', priority to 'medium'
- Create button disabled until title entered
- Closes on successful creation
- New task appears in To Do column

**US-107: Task detail panel** ✅
- Slide-out Sheet component from right
- Inline editing for title and description
- Dropdowns for type, status, priority
- Tags input (comma-separated)
- Debounced auto-save (500ms delay)
- Delete button with confirmation dialog
- Close button and Escape key to close
- Metadata display (created/updated dates, ID)

**US-108: Drag and drop between columns** ✅
- @dnd-kit for drag and drop
- Visual feedback: ring highlight on target column
- Ghost card with rotation effect while dragging
- Updates task status on drop
- Persists change to file via API
- Smooth transitions
