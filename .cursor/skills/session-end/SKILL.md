# Skill: Session End

**When to use:** End of a work session. Triggered by "end session," "wrap up," "done for today."

## Steps

### Step 1: Check state

```bash
git status && git branch && make check
```

### Step 2: Handle in-progress work

**Task complete?** Run `task-verify` then `task-close`.

**Task in progress?** Commit WIP on the task branch:
```bash
git add .
git commit -m "WIP task <id>: <what was done>"
```

**Before pushing, confirm with the user:**

> "I'll push the WIP commit to `task/<id>-<description>` on GitHub so your work is backed up. Should I go ahead?"

Wait for confirmation, then:
```bash
git push origin task/<id>-<description>
```

### Step 3: Update docs

1. **Context** — date, active task, last session summary, next up, session log entry, branch name.
2. **Tracker** — update statuses.
3. **Task breakdowns** — mark completed steps, add gotchas.

### Step 4: Prune context

Remove session logs older than 5 sessions. Remove stale decisions. Keep under 300 lines.

### Step 5: Commit and push docs

Commit is safe to do immediately:

```bash
git add docs/
git commit -m "Update docs: session end — <summary>"
```

**Before pushing, confirm with the user:**

> "Ready to push the doc updates to GitHub. Should I go ahead?"

Wait for confirmation, then:

```bash
git push
```

### Step 6: Summarize

What was done, test/lint status, what next session should start with, which branch has WIP.

## Rules

- Always commit before ending. Uncommitted work is lost work.
- Update all three: context, tracker, breakdowns.
- Write "Next session should" as instructions for a stranger.
- Never leave main broken. WIP stays on task branch.
