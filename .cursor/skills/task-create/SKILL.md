# Skill: Create Task

**When to use:** Starting a new task. Triggered by "start task," "create task," "next task," or "plan this task."

## Steps

### Step 1: Load project context

1. Read `docs/CONTEXT.md` — current phase, active tasks, constraints.
2. Read `docs/TRACKER.md` — identify the task and its dependencies.
3. Read `docs/TECHNICAL_GUIDANCE.md` — relevant patterns and constraints.
4. Skim `.cursor/reference/PROJECT_PATTERNS.md` if the task involves API calls, testing patterns, or infrastructure you're unfamiliar with.

### Step 2: Create a git branch

```bash
git checkout -b task/<task-id>-<short-description>
```

### Step 3: Create the task breakdown

Create `docs/task_breakdowns/TASK_<id>_<Short_Name>.md`:

- **What this task does** and how it fits in the project
- **Backwards compatibility:** What currently works that must keep working?
- **Steps** — each with "files to touch" and "how to test"
- **Testing requirements** — what tests to write, edge cases, expected `make test` result
- **Acceptance criteria** — including "tests pass" and "lint clean"

### Step 4: Assess task size

**Small** (single script, < 1 hour): Keep the breakdown short — context, 2–3 steps, criteria. Still needs at least one test. Use the **scripts collection pattern** from PROJECT_PATTERNS.md: one script per job in `scripts/`, independently runnable, with a `make` target. Even a simple "transform this CSV" task should be a clean, named script — not a throwaway. When the user wants to add more later, it'll be easy.

**Medium** (multiple files, 1–3 hours): Full breakdown, 4–6 steps, test at each step.

**Large** (7+ steps or 4+ files): Split into smaller tasks. Update the tracker.

### Step 5: Confirm alignment with the user

Before building, present the plan and ask:

> "Here's the plan for this task. Before we build, let's make sure we're aligned:
>
> 1. **Project alignment:** Does this task move the project forward as described in the tracker and context?
> 2. **Technical guidance:** Are we following the patterns in TECHNICAL_GUIDANCE.md? (especially: [call out the most relevant point — API client usage, data formats, etc.])
> 3. **Tests planned:** Tests will cover [X, Y, Z] — anything else we should test?
> 4. **Backwards compatible:** Existing functionality won't break because [approach].
> 5. **Right size:** Is this scoped tightly enough to finish and verify in one sitting?
>
> Ready to build?"

This step is important. It's the moment to catch misalignment before writing code.

### Step 6: Update context

Set active task and branch in `docs/CONTEXT.md`.

## Rules

- **Always branch.** Never work directly on main.
- **Always plan tests.** No task ships without tests.
- **Backwards compatible first.** Add alongside, verify, then remove old.
- **If calling an API**, use the shared API client (see `docs/TECHNICAL_GUIDANCE.md` or `.cursor/reference/PROJECT_PATTERNS.md`). Never scatter raw HTTP calls.
- **Small changes, frequent commits.** Each step should be independently committable.
