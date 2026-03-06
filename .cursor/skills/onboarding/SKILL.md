# Skill: Project Onboarding

**When to use:** Setting up a new project or adding the task-by-task system to an existing one. Triggered by "set up my project," "onboard," or when `docs/CONTEXT.md` is in its template state.

## Purpose

Understand what the user is trying to accomplish in plain English, then translate that into a project plan and documentation. The user describes their problem — you decide the technical approach. After onboarding, run the `scaffold` skill to set up any missing infrastructure.

**Key principle:** Non-technical users describe what they want to stop doing manually. Do not ask them to identify a "tech stack" or pick a project type. Ask about their work — you figure out the rest.

## Steps

### Step 1: Detect what exists

Before asking questions, look at the current repo:
- Is there existing code? What language/framework?
- Is there an existing README, package.json, requirements.txt, Makefile?
- Are there existing tests or linting configs?
- Is there a `.env` or `.env.example`?

Adapt to what's already here. Don't assume a blank slate.

### Step 2: Interview the user

**Lead with their problem, not technical categories.** The user does not need to know what a "cron job," "FastAPI backend," or "webhook" is. Ask about their work and life. You will translate their answers into the right technical decisions.

Use the `AskQuestion` tool to ask structured questions — present one group of questions at a time, not a wall of text. Keep options in plain everyday English.

**Question 1 — What are you trying to stop doing manually?**

Options (plain language):
- "I do a repetitive task (copy/paste, data cleanup, report generation) that takes up my time"
- "I want to connect two tools I already use so data flows between them automatically"
- "I want to run a list of things through AI — classify them, summarise them, extract information, or rewrite them"
- "I want to build something my team can open in a browser and use themselves"
- "I'm not sure yet — I just know there's a problem I want to solve"

**Question 2 — How often does this happen?**

Options:
- "Once in a while — I'd run it myself when I need it"
- "On a schedule — daily, weekly, or monthly"
- "All the time — it should just happen automatically in the background"

**Question 3 — Where does the information come from and where does it go?**

Ask this as a free-text follow-up: *"Describe what you do today. Walk me through it step by step — what do you open, what do you copy, what do you do with it, where does it end up?"*

Ask follow-up questions until you can answer:
- What is the source of data? (spreadsheet, system name, file, email, etc.)
- What transformation or work needs to happen?
- Where does the result need to go? (spreadsheet, email, dashboard, Slack, etc.)
- Who else needs to see or use the result?

**Do not use technical terms in your questions.** If they describe copying from Salesforce to a spreadsheet, that's an integration. If they describe reformatting a CSV export, that's a script. You decide — they don't need to.

**After the interview, confirm your understanding in plain English** before writing any docs:

> "Here's what I understand: [2–3 sentence plain-English description of what they're building and why]. Does that sound right?"

Only proceed once they confirm.

### Step 3: Create project documentation

Based on the interview, make the technical decisions yourself — do not surface these choices to the user unless they ask. Pick the simplest approach that solves the problem.

**Technical decision guide:**
- Repetitive manual task on a file or spreadsheet → Python script in `scripts/`
- Needs to run on a schedule → Python script + cron note in README
- Connects two tools (e.g. CRM → Sheets) → Python script using APIs, webhook if one tool supports it
- Team needs a UI in a browser → FastAPI backend + simple HTML/JS frontend or a no-code tool reference
- Involves running data through an AI (classify, extract, summarise, rewrite) → Python script using the LLM client pattern from `PROJECT_PATTERNS.md`. Use the company OpenAI account (`OPENAI_API_KEY` in `.env`). Note in `TECHNICAL_GUIDANCE.md` which model was chosen and why.
- Unsure → default to a Python script; it's the lowest barrier and easiest to extend

1. **Create or update `docs/CONTEXT.md`** with:
   - **Plain English summary** (2–3 sentences a non-technical person could read) — what this does, who it's for, why it matters
   - Project name, current phase, first 3–5 active tasks, constraints, quick reference table
   - Keep under 300 lines

2. **Create `docs/TRACKER.md`** with phased tasks:
   - Phase 1: Core functionality (minimum to be useful)
   - Phase 2: Error handling, edge cases, polish
   - Phase 3: Nice-to-haves, automation, integrations
   - Each task gets an ID and short description written in plain English (e.g. "Pull employee list from BambooHR" not "Implement BambooHR API GET /employees endpoint")
   - 8–15 tasks across 2–3 phases is typical

3. **Rewrite `README.md`** for the actual project. The template README is no longer relevant — replace it entirely with:

   - **Project name and plain-English description** — what it does, who uses it, what problem it solves (2–3 sentences, same as the "What This Does" section in CONTEXT.md)
   - **Setup** — how to install dependencies and configure `.env` (reference `install.sh` for first-time Mac setup, then `make setup`)
   - **How to run it** — the key `make` targets for this specific project
   - **The workflow table** — keep the skill trigger table (still relevant for anyone building on top of this project)

   Example structure:
   ```markdown
   # [Project Name]

   [2–3 sentence plain-English description]

   ## Setup
   1. Run `bash install.sh` (first time only — installs Homebrew, git, gh)
   2. Run `gh auth login` (first time only — connects to GitHub)
   3. Clone and configure:
      ```bash
      gh repo clone Instawork/[project-name]
      cd [project-name]
      cp .env.example .env   # fill in your API keys
      make setup
      ```

   ## Running the project
   | Command | What it does |
   |---|---|
   | `make run` | [describe what this does for this specific project] |
   | `make check` | Run tests and lint |

   ## Development workflow
   | Say this in Cursor | What happens |
   |---|---|
   | "Start session" | Orient, pick task |
   | ... | ... |
   ```

4. **Create `docs/TECHNICAL_GUIDANCE.md`** with project-specific decisions:
   - Language/framework chosen and **why in one plain sentence**
   - Which external tools or APIs are used, how to authenticate
   - Data flow: input → processing → output (use tool names the user recognizes, e.g. "Salesforce → Python script → Google Sheet")
   - Any project-specific constraints (rate limits, data sensitivity, etc.)
   - If the project includes a FastAPI backend, note that Swagger/OpenAPI docs are auto-available at `/docs` when the server runs
   - If the project outputs to Google Sheets/Docs, note the Apps Script webhook approach — just a URL in `.env`, no credentials needed. Reference the pattern in PROJECT_PATTERNS.md.
   - Reference `.cursor/reference/PROJECT_PATTERNS.md` for standard patterns — don't duplicate them, just note which apply

### Step 4: Set up git and GitHub

Based on what was detected in Step 1, handle the two scenarios:

**New project (cloned from template, no remote):**

The user likely did `git clone <template> && rm -rf .git && git init`. They need a GitHub repo.

1. Commit everything so far (no confirmation needed):
   ```bash
   git add .
   git commit -m "Initial project setup: docs, skills, and structure"
   ```

2. **Before creating the GitHub repo, confirm with the user:**

   > "I'm ready to create a new private GitHub repo called `<project-name>` and push your project to it. Should I go ahead?"

   Wait for confirmation, then:
   ```bash
   gh repo create <project-name> --private --source=. --push
   ```
   If `gh` CLI isn't installed, walk them through creating the repo on github.com, then confirm before pushing:

   > "I'll connect your project to that GitHub repo and push. Should I go ahead?"

   ```bash
   git remote add origin https://github.com/<org>/<project-name>.git
   git push -u origin main
   ```

3. Confirm the repo is live: "Your project is on GitHub at [URL]. From here on, every task gets its own branch and merge."

**Existing project (template integrated into existing repo):**

The user copied `.cursor/`, `docs/`, and `.cursorrules` into a project that already has a git remote.

1. Create a branch (no confirmation needed):
   ```bash
   git checkout -b setup/task-by-task-system
   ```

2. Commit the new files (no confirmation needed):
   ```bash
   git add .cursor/ docs/ .cursorrules
   git commit -m "Add task-by-task build system

   - Skills for session management, task planning, and quality gates
   - Project documentation: context, tracker, technical guidance
   - Reference patterns for scaffolding infrastructure"
   ```

3. **Before pushing and opening a PR, confirm with the user:**

   > "Ready to push the `setup/task-by-task-system` branch to GitHub and open a pull request. Should I go ahead?"

   Wait for confirmation, then:
   ```bash
   git push origin setup/task-by-task-system
   gh pr create --title "Add task-by-task build system" \
     --body "Adds structured development workflow with Cursor skills, project docs, and quality gates. See docs/CONTEXT.md for current plan and docs/TRACKER.md for the full task list."
   ```

4. After merge, switch back to main: `git checkout main && git pull`

### Step 5: Offer to scaffold

After git is set up, tell the user:

> "Your project plan is set up and pushed to GitHub. Next step is to make sure you have the right infrastructure (testing, linting, Makefile, etc.). Want me to run the scaffold skill to set that up?"

## Rules

- **Never ask the user to make technical decisions.** Ask about their problem; you decide the approach.
- **Never use technical jargon in questions.** No "webhook," "cron," "API endpoint," "backend," or "framework" — describe things by what they do, not what they are.
- **Always confirm understanding in plain English** before writing docs. One paragraph. They confirm. Then proceed.
- **Always rewrite README.md during onboarding.** The template README describes the template, not the project. Anyone cloning the project repo should immediately understand what it does.
- Never overwrite existing docs without asking — except README.md, which should always be replaced during onboarding.
- If the project already has code, shape the tracker around what exists (some tasks may already be "done").
- Keep it simple. If a script solves the problem, don't suggest a web app.
- CONTEXT.md must be under 300 lines after setup. Must include a plain English summary at the top.
- TRACKER.md should have 8–15 tasks for a typical project. Task descriptions must use plain language.
- Task names in TRACKER.md should describe *what the user gets*, not *what the code does*.
