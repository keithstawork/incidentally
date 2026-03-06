# Skill: Scaffold Project Infrastructure

**When to use:** After onboarding, or when the user says "scaffold," "set up testing," "set up linting," "add a Makefile," or "set up the project infrastructure."

## Purpose

Detect what already exists in the project and generate only the missing infrastructure: test framework, linter, Makefile, .gitignore, .env, API client, etc. Also normalize skill file layout if needed. Never overwrite existing files. Reference `.cursor/reference/PROJECT_PATTERNS.md` for all templates and patterns.

## Steps

### Step 1: Normalize skill directory structure

Check `.cursor/skills/`. The correct convention is one directory per skill with a `SKILL.md` inside:

```
.cursor/skills/
├── onboarding/
│   └── SKILL.md
├── scaffold/
│   └── SKILL.md
├── task-create/
│   └── SKILL.md
```

If any skills are flat files (e.g. `.cursor/skills/scaffold.md` instead of `.cursor/skills/scaffold/SKILL.md`), restructure them:

```bash
cd .cursor/skills
for f in *.md; do
  name="${f%.md}"
  mkdir -p "$name"
  mv "$f" "$name/SKILL.md"
done
```

After restructuring, update any paths in `.cursorrules` to match the new layout.

This convention allows co-locating supporting files with a skill (e.g. `scaffold/EXAMPLES.md` alongside `scaffold/SKILL.md`).

### Step 2: Audit what exists

Check the repo for each of these. Note what's present and what's missing.

```
Existing code?         → What language? What structure?
Makefile?              → Has targets already?
Testing?               → pytest/vitest/jest config? Test directory?
Linting?               → ruff/eslint config? pyproject.toml/eslintrc?
.gitignore?            → Covers secrets and caches?
.env / .env.example?   → Has the keys the project needs?
requirements.txt?      → Or package.json?
API client?            → Shared client with backoff, or raw calls?
Database?              → SQLite, PostgreSQL, ORM already set up?
Google Sheets/Docs?    → Apps Script webhook URL in .env?
README?                → Describes the project?
```

### Step 3: Plan what to create

Based on the audit, list only what's missing. Present the plan to the user:

> "Here's what I'd set up:
> - [x] Makefile — with setup, test, lint, format, check, run, help
> - [x] pytest + ruff config (no testing or linting set up yet)
> - [x] .gitignore (missing — will cover .env, caches, OS files)
> - [x] .env.example (you'll need API keys for BambooHR)
> - [x] Shared API client with exponential backoff
> - [ ] tests/ directory already exists — keeping it
> - [ ] requirements.txt already exists — will add pytest and ruff to it
>
> Should I proceed?"

### Step 4: Generate missing files

For each missing piece, reference `.cursor/reference/PROJECT_PATTERNS.md` for the template. Adapt to the project's language and existing structure.

**Key rules for each file:**

**Makefile:**
- If one exists, add missing targets (setup, test, lint, format, check, run, help). Don't remove existing targets.
- If none exists, create one from the template in PROJECT_PATTERNS.md.
- Use the correct commands for the detected stack (Python vs Node).

**Testing setup:**
- Python: add pytest to requirements.txt, create pyproject.toml config (or add to existing), create `tests/` dir if missing, create `tests/__init__.py`.
- Node: add vitest to package.json devDependencies, add test script.
- Create one example test if no tests exist yet.

**Linting setup:**
- Python: add ruff to requirements.txt, add ruff config to pyproject.toml.
- Node: add eslint + prettier to devDependencies, create config files.

**.gitignore:**
- If one exists, append missing patterns (check for .env, caches, OS files).
- If none exists, create from patterns in PROJECT_PATTERNS.md for the detected stack.

**.env.example:**
- Create with placeholders for every API key or secret the project needs (from TECHNICAL_GUIDANCE.md).
- Add clear comments explaining each variable.

**Shared API client:**
- Only create if the project calls external APIs.
- Python: `scripts/api_client.py` from the pattern in PROJECT_PATTERNS.md.
- Node: `src/lib/apiClient.ts`.
- Include a test for the client.

**Directory structure:**
- Create `scripts/`, `tests/`, `data/` only if they don't exist and the project needs them.
- Never reorganize existing code into a different structure.

**Database setup (if needed):**
- Only set up if the project involves persistent data storage.
- Python: add `sqlalchemy` to requirements.txt. Add `alembic` if migrations are needed.
- Create `src/models.py` with a base setup if no models exist.
- Add `make db-migrate` target to Makefile if using Alembic.
- See DATABASE section in PROJECT_PATTERNS.md.

**Google Sheets / Docs output (if needed):**
- Always use **Apps Script webhooks** — no OAuth, no credentials files, no Google Cloud project.
- Add the webhook URL to `.env.example` with setup instructions.
- No additional Python dependencies needed beyond `requests`.
- See CLOUD DOCUMENT section in PROJECT_PATTERNS.md for the full pattern and Apps Script code.

### Step 5: Install and verify

```bash
make setup    # Install dependencies
make check    # Verify tests and lint pass
```

If anything fails, fix it before continuing.

### Step 6: Commit the scaffold

```bash
git add .
git commit -m "Add project infrastructure: [list what was added]"
```

## Rules

- **Normalize skill layout first.** Flat `.md` files in `.cursor/skills/` get moved to `skill-name/SKILL.md` subdirectories before doing anything else.
- **Never overwrite existing files.** Add to existing Makefile, append to .gitignore. Always ask before replacing.
- **Detect, don't assume.** Check what's there before deciding what to create.
- **Reference PROJECT_PATTERNS.md** for all templates. Don't hardcode templates in this skill.
- **Minimal footprint.** Only create what the project actually needs.
- **Verify it works.** `make check` must pass after scaffolding.
