# Skill: Close Task

**When to use:** After task-verify passes. Triggered by "close task," "finish task," "merge this."

## Prerequisites

Task-verify must have passed. If not, run it first.

## Steps

### Step 1: Final check

```bash
make check
```

If anything fails, stop and fix.

### Step 2: Update docs

1. **Task breakdown** — mark complete, fill in lessons learned.
2. **Tracker** — mark task ✅ Done. Add any new tasks discovered.
3. **Context** — move task to Done, set "Next up," add session log entry, prune to under 300 lines.
4. **Technical Guidance** — if task-verify flagged any new decisions, APIs, env vars, or constraints, confirm they've been added to `docs/TECHNICAL_GUIDANCE.md`. The docs should reflect the project as it stands now, not just how it started.

### Step 3: Commit and push

Commit is safe to do immediately:

```bash
git add .
git commit -m "Complete task <id>: <description>

- <what was built>
- Tests passing, lint clean"
```

**Before pushing, confirm with the user:**

> "Ready to push task branch `task/<task-id>-<description>` to GitHub. Should I go ahead?"

Wait for confirmation, then:

```bash
git push origin task/<task-id>-<description>
```

### Step 4: Merge to main

**Before merging, confirm with the user:**

> "Ready to merge `task/<task-id>-<description>` into main and push. Should I go ahead?"

Wait for confirmation, then:

```bash
git checkout main
git merge task/<task-id>-<description>
git push origin main
```

### Step 5: Orient for next

"Next task in the tracker is [X.Y]. Want to start it, or done for today?"

## Rules

- Never close with failing tests or lint.
- Always update all four docs: breakdown, tracker, context, technical guidance.
- Prune context under 300 lines. The prove-it test: could someone pick up from this file alone?
- TECHNICAL_GUIDANCE.md should reflect the project as it stands now — new decisions, APIs, env vars, and constraints must be documented before closing.
- Commit messages say what was built, not just "done."
