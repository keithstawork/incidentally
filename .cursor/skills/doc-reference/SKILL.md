# Skill: Doc Reference

**When to use:** When you need to find project information or understand the project structure.

## Where Things Live

| What you need | Where to find it |
|---|---|
| What to work on right now | `docs/CONTEXT.md` |
| Full task list and status | `docs/TRACKER.md` |
| Plan for a specific task | `docs/task_breakdowns/TASK_<id>_*.md` |
| Technical decisions for this project | `docs/TECHNICAL_GUIDANCE.md` |
| Standard patterns and templates | `.cursor/reference/PROJECT_PATTERNS.md` |
| AI behavior rules | `.cursorrules` |
| Available commands | `make help` |
| AI workflow skills | `.cursor/skills/<name>/SKILL.md` |

## Skill Quick Reference

| Situation | Skill |
|---|---|
| New project or adding system to existing | `onboarding/SKILL.md` |
| Set up testing, linting, Makefile, etc. | `scaffold/SKILL.md` |
| Starting a work session | `session-start/SKILL.md` |
| Planning and starting a task | `task-create/SKILL.md` |
| Checking if a task is really done | `task-verify/SKILL.md` |
| Closing a completed task | `task-close/SKILL.md` |
| Ending a work session | `session-end/SKILL.md` |
| Finding where something is | `doc-reference/SKILL.md` (this file) |

## Skill Directory Convention

Skills follow the pattern `.cursor/skills/<skill-name>/SKILL.md`. Each skill gets its own directory so supporting files (examples, templates) can sit alongside the skill definition. If you find flat `.md` files in `.cursor/skills/`, the `scaffold` skill will normalize them into this layout.

## Doc Hierarchy

- **Context** directs (what to do now)
- **Tracker** tracks (what's done, what's next)
- **Breakdowns** detail (how to build one task)
- **Technical Guidance** explains (project-specific decisions)
- **Reference/PROJECT_PATTERNS.md** provides templates (standard patterns for any project)

Don't duplicate. Link instead.
