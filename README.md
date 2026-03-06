# Incidentally

Instawork's internal injury claims management tool for Trust & Safety and Legal teams. Tracks workers' compensation and occupational accident claims from initial intake through resolution — replacing spreadsheets with a purpose-built pipeline that integrates live with Instawork's Pro data.

---

## Setup

**First time only:**
```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env: set DATABASE_URL, SESSION_SECRET, AWS_PROFILE, etc.

# 3. Push database schema
npm run db:push

# 4. Authenticate with AWS (for Redshift + S3)
aws sso login
```

**Every session:**
```bash
npm run dev
# App runs at http://localhost:3001
```

If Redshift queries fail with auth errors, re-run `aws sso login` — SSO sessions expire after ~8 hours.

---

## Running the project

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (frontend + backend on port 3001) |
| `npm run db:push` | Apply schema changes to the database |
| `npm run build` | Build for production |

---

## Project structure

```
client/          → React frontend (Vite, Tailwind, shadcn/ui)
server/          → Express backend
  routes/        → API route handlers
  scripts/       → One-time backfill and data scripts
shared/          → Zod schema shared between frontend and backend
docs/            → CONTEXT.md, TRACKER.md, TECHNICAL_GUIDANCE.md
.cursor/skills/  → Development workflow skills
```

---

## Development workflow

| Say this in Cursor | What happens |
|---|---|
| "Start session" | Orient on current state, pick the active task |
| "I want to add X" | Scope the idea, add to tracker, plan the task |
| "Start task" | Create branch and detailed task plan |
| "Check my work" | Verify against task plan, run quality checks |
| "Close task" | Update docs, commit, prep for merge |
| "End session" | Save progress, update CONTEXT.md |
| "Where is..." / "What's the status of..." | Find anything in docs or tracker |

See `docs/CONTEXT.md` for current state and active tasks.
See `docs/TRACKER.md` for the full task list by phase.
See `docs/TECHNICAL_GUIDANCE.md` for stack decisions and integration details.
