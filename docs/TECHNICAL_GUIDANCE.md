# Technical Guidance — Incidentally

**Project-specific technical decisions. Updated as the project evolves.**
**For standard patterns (API client, testing, linting, Makefile), see `.cursor/reference/PROJECT_PATTERNS.md`.**

---

## Stack

**Language:** TypeScript (Node.js 20+)
**Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query v5, Wouter (routing), Zod
**Backend:** Express.js, Drizzle ORM, node-postgres (`pg`)
**Database:** PostgreSQL (application data), AWS Redshift (read-only Pro/shift data)
**File storage:** AWS S3 (production documents), local `uploads/` (dev fallback)
**Auth:** express-session placeholder → Google Workspace OAuth (planned, task 2.3)
**Validation:** Zod schemas in `shared/schema.ts` — imported by both frontend and backend
**AI (Phase 4):** OpenAI (company account) — shared LLM client with retries + cost logging; see `PROJECT_PATTERNS.md` for the standard LLM client pattern

---

## Data Flow

**New Incident:**
```
User enters Pro name or ID
        ↓
Two-tier search: PostgreSQL pg_trgm similarity() + Redshift ILIKE prefix match
        ↓
Pro selected → last 10 shifts fetched from Redshift
        ↓
Calendar highlights worked shifts: W2 = green (Moss), 1099 = coral (Coral)
        ↓
Date of injury selected → shift auto-populates Partner, State, Address, Pay Rate, Shift Length
        ↓
Claim saved to PostgreSQL with internal number (YYYYMMDDNN-SS-CC)
```

**Document Upload:**
```
User drags file onto Documents tab
        ↓
POST /api/claims/:id/documents (multipart/form-data, via multer)
        ↓
S3 (prod) or local uploads/ (dev) via FileStorageProvider interface
        ↓
Presigned URL generated on download (1-hour expiry)
GET /api/claims/:id/documents/:docId/download
```

---

## APIs and Integrations

### AWS Redshift (Pro data — read-only)
- **Pattern:** Redshift Data API — no persistent connection, each query is a new API call
- **Auth:** AWS SSO (`aws sso login --profile <profile>`) — session expires ~8 hours, must re-login
- **Key data pulled:** Pro shift history, shift location/partner/pay details, worker classification (W2 vs 1099)
- **Concurrency:** Backfill scripts use `p-limit` (concurrency 5) to parallelize Redshift queries
- **Files:** `server/pro-storage.ts` (runtime queries), `server/scripts/` (one-time backfill scripts)

### AWS S3 (Document storage)
- **Pattern:** `FileStorageProvider` interface — `S3StorageProvider` in prod, `LocalStorageProvider` in dev
- **Auth:** Same AWS SSO profile as Redshift
- **Presigned URLs:** 1-hour expiry for downloads. Files are never served directly.
- **Files:** `server/routes/documents.ts` (API), storage provider files in `server/`

### Google Drive (planned — task 2.2)
- **Plan:** Service account key → scan folder → fuzzy-match file names to claimant names → download → store via S3
- **No AI summarization** — files are stored as-is, no content analysis
- **Env vars:** `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GDRIVE_FOLDER_ID`

### Instawork Falcon (Pro admin links)
- **Pattern:** URL construction only — no API
- **URL format:** `https://admin.instawork.com/internal/falcon/{proId}/`

### Nominatim (geocoding — backfill only)
- **Used for:** Reverse-geocoding shift coordinates to human-readable addresses during backfill
- **Rate limit:** 1 request/second enforced in backfill scripts

---

## Project-Specific Decisions

- **Internal claim numbering: `YYYYMMDDNN-SS-CC`** — date + daily sequence + state code + carrier code. Prevents collision with carrier claim numbers and litigation case numbers. UI label: "Incident No."
- **Fuzzy Pro search: two-tier** — PostgreSQL `similarity()` with `gin_trgm_ops` index for local data; prefix-truncation ILIKE for Redshift (no trigram support there). Results merged in memory, ordered by similarity score.
- **Pro name matching rule:** If a shift has multiple workers but one matches the claimant's name → assign that worker. "Near matches" are flagged for manual review rather than auto-assigned.
- **Redshift results cached** — LRU cache with TTL in `server/pro-storage.ts` to avoid redundant API calls.
- **Drizzle schema is the source of truth** — `shared/schema.ts` imported by both sides. Run `npm run db:push` to apply changes. No migration files — appropriate for a single-team internal tool.
- **No database migrations** — `db:push` used directly. Switch to Drizzle migrations if multiple environments are added.
- **W2 = Moss green, 1099 = Coral** — Instawork brand colors used consistently for worker type throughout the UI.

---

## Environment Variables

See `.env.example` for full list with comments. Key vars:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_PROFILE` | AWS SSO profile name for Redshift + S3 |
| `S3_BUCKET` | S3 bucket name for document storage |
| `REDSHIFT_CLUSTER_ID` | Redshift cluster identifier |
| `REDSHIFT_DATABASE` | Redshift database name |
| `REDSHIFT_DB_USER` | Redshift IAM user |
| `SESSION_SECRET` | Express session signing key |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Path to service account JSON (planned) |
| `GDRIVE_FOLDER_ID` | Google Drive folder ID for doc import (planned) |

---

## Instawork Brand Colors

Applied via Tailwind CSS variables. Key colors:
- **Moss** `#3B5747` — primary (sidebar, buttons, W2 indicators)
- **Coral** `#EC5A53` — primary accent (1099 indicators, alerts)
- **Blue** `#294EB2` — "ally" in "Incidentally" branding, links
- **Cream** `#F1EDE3` — background
- **Navy** `#1C2135` — dark text, headers
- **Graphite** `#576270` — muted text

---

## Phase 4: AI Agent Architecture (planned)

**Goal:** The system ingests all available claim information and surfaces next-step prompts to T&S agents — and eventually handles routine steps autonomously. Litigation workflows are explicitly out of scope for Phase 4.

**Focus user: T&S agent** (not paralegal or litigator). T&S handles intake, initial investigation, coverage determination, Pro verification, and routing. Legal/litigation workflows are Phase 5+.

### Data available to agents
- PostgreSQL: full claim record (all fields, notes, history, financials)
- S3/documents: uploaded files (medical records, correspondence, intake docs)
- Redshift: Pro shift history, earnings, worker classification, account history, active status
- External: TPA system (future), carrier portals (future)

### Automation philosophy

**Two categories of tasks — treated very differently:**

1. **Routine deterministic tasks** — rule-based, no meaningful human oversight needed, safe to automate fully from the start. Examples: assigning a carrier based on worker type + state, generating the incident number, auto-populating coverage type, flagging duplicate Pro claims.

2. **Judgment-requiring tasks** — LLM-powered, require testing before automation. These start as **display-only suggestions** (agent shows output, user confirms or edits). Only graduate to autonomous once we've validated the output quality in practice.

**Sequencing rule:** No LLM-powered task runs autonomously until it has been run in suggestion-only mode and the output has been reviewed and trusted.

### Planned agent types (T&S focus)

| Agent | Category | Phase | Trigger | What it does |
|---|---|---|---|---|
| Coverage router | Deterministic | 4.2 | Claim created | Auto-assign carrier + coverage type based on worker type + state — no LLM needed |
| Duplicate checker | Deterministic | 4.2 | Claim created | Flag if Pro has other open claims |
| Document field extractor | LLM — suggest first | 4.3 | Document uploaded | Extract dates, diagnoses, treatment notes → surface for user confirmation before writing |
| Claim summarizer | LLM — suggest first | 4.4 | Claim opened | Plain-English summary of claim state, history, data gaps, and urgency |
| T&S next-step prompter | LLM — suggest first | 4.5 | User Home load | For each open claim: what a T&S agent should do next, ranked by urgency |
| Routine action agent | LLM → autonomous after testing | 4.6 | Event-driven | Handle routine tasks autonomously once output is trusted (e.g., request missing docs, update status) |
| Gmail ingestion agent | Mixed | 4.7 | Scheduled | Monitor inbox for claim-related emails, auto-attach to correct incident |

### LLM provider strategy

LLM choice is not yet decided — OpenAI, Anthropic, and Google are all candidates, and different agents may perform better with different models. Architecture must support this.

- Build a **`LLMProvider` interface** in `server/lib/llm-client.ts` — all agent calls go through it
- Implement adapters for OpenAI, Anthropic (Claude), and Google (Gemini) behind the same interface
- Each agent can declare a preferred provider + model, allowing A/B testing
- Log provider, model, token usage, and latency for every call — required for cost tracking and model selection decisions
- Default to the cheapest capable model for each task; only escalate when quality requires it
- Use company accounts where available; `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` in `.env`

### Design principles
- **Show reasoning** — every suggestion includes why the agent is recommending it
- **Graceful fallback** — if LLM output is low-confidence or fails, surface for manual review rather than silently failing or blocking
- **Suggest before automating** — LLM tasks run in read-only suggestion mode first; autonomous only after output is validated
- **Deterministic tasks need no LLM** — don't use AI where a rule works reliably
- **One interface, many providers** — never scatter raw OpenAI/Anthropic calls; everything goes through `server/lib/llm-client.ts`

**Key dependency:** Agents need auth + roles (task 3.3) before autonomous actions can be role-gated by user type.

---

## Constraints

- Redshift SSO expires. When Redshift queries fail, run `aws sso login`.
- `uploads/` is gitignored — local dev only. In production, all documents go to S3.
- Pro data from Redshift is read-only. Never write back.
- No AI document processing in Phase 2 — deferred to Phase 4.
- Raw data exports (`.csv`, `.xlsx`) are gitignored — never commit.
