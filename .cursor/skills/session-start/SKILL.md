# Skill: Session Start

**When to use:** Beginning of every work session. Triggered by "start session," "where did I leave off," or when opening the project.

## Steps

1. **Read `docs/CONTEXT.md`.** Current phase, active task, last session, what's next, blockers.
2. **Read `docs/TRACKER.md`.** What's done, in progress, upcoming.
3. **Check git state.** `git status && git branch` — Are we on a task branch? Uncommitted work?
4. **Identify the active task.** Use context's "Next up" or pick from tracker.
5. **Check for a task breakdown.** If the task is non-trivial and has no breakdown, use `task-create`.
6. **Skim `docs/TECHNICAL_GUIDANCE.md`** for anything relevant to the current task.
7. **Orient the user.** 3–5 sentences: what we're doing, which files, what "done" looks like, current branch.

## Rules

- Always read context and tracker before doing anything.
- If context is in template state, run `onboarding` first.
- If there's uncommitted work from a previous session, address it first.
