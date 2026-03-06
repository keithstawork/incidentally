# Skill: Feature Plan

**When to use:** When the user has a new idea they want to add to an existing project, or wants to figure out what to build next. Triggered by "I want to add [X]", "what should I build next?", "I have an idea", "plan a new feature", "what can I build on top of this?"

## Purpose

Bridge the gap between "I have an idea" and "there's a task in the tracker ready to build." This skill scopes new work, checks fit with what already exists, and adds it to the tracker before handing off to `task-create`.

**Key principle:** The user describes what they want in plain English — you figure out the technical scope. Do not ask them to define tasks or break down work themselves.

---

## Steps

### Step 1: Read the current project

Before asking anything, read:
- `docs/CONTEXT.md` — what's been built, current phase, constraints
- `docs/TRACKER.md` — what's done, in progress, and planned
- `docs/TECHNICAL_GUIDANCE.md` — the architecture, APIs, data flow

You need a clear picture of what already exists before you can scope what comes next.

### Step 2: Understand the idea (or generate options)

**If the user already has an idea:**

Ask clarifying questions in plain English until you can answer:
- What does this do that the project doesn't do today?
- Who benefits and how?
- Where does it fit in the existing data flow? (new input? new output? new step in the middle?)
- Does it touch existing code or is it additive?
- Is there anything in the current architecture that makes this easier or harder?

Keep questions conversational — one or two at a time, not a form. Stop asking when you have enough to scope the work.

**If the user wants suggestions ("what should I build next?"):**

Look at what's done and what's planned, then propose 2–3 options. For each, describe:
- What it does in one plain sentence
- Why it would be valuable right now (not just "nice to have")
- Roughly how much work it is (small / medium / large)

Present options clearly and let them pick. Don't proceed until they've chosen.

### Step 3: Confirm scope in plain English

Before writing anything to the tracker, confirm your understanding:

> "Here's what I'm thinking: [2–3 sentence plain-English description of what gets built, who uses it, and what changes]. Does that sound right?"

Wait for confirmation. Adjust if needed.

### Step 4: Assess size and phase

**Small** (1–2 tasks, fits in a session): Add directly to the appropriate phase in TRACKER.md.

**Medium** (3–5 tasks): Break into steps. Add as a mini-phase or extend an existing phase.

**Large** (6+ tasks, or touches many parts of the system): Flag it.

> "This is a bigger addition — it would touch [X, Y, Z] and probably take [estimate]. I'd suggest we break it into a smaller first step we can ship, then plan the rest. Want to do that?"

Don't let a large idea become an unmanageable blob in the tracker.

### Step 5: Add to TRACKER.md

Add the new tasks to the tracker with:
- Correct phase placement (Phase 1 if core, Phase 2 if polish, Phase 3 if nice-to-have)
- Plain-English task descriptions (what the user gets, not what the code does)
- Any notes on dependencies or sequencing

Update `docs/CONTEXT.md` if the new work changes what the project is or what's coming up next.

### Step 6: Offer to start building

> "Tasks added. Want to start the first one now? I can create a branch and plan."

If yes, hand off to `task-create` for the first new task.

---

## Rules

- **Never add tasks to the tracker without the user confirming the scope first.** Step 3 is not optional.
- **Never ask the user to write task descriptions or define technical requirements.** That's your job.
- **Check for overlap.** If a similar task is already in the tracker, flag it before adding a duplicate.
- **Check for architecture fit.** If the idea requires a significant change to the existing architecture (new dependency, different data model, different output format), surface that clearly in plain English before scoping the tasks.
- **Stay additive.** New features should add alongside what exists. If the idea requires changing existing behaviour, note that and plan the backwards-compatible path.
- **Keep task count reasonable.** 2–5 new tasks is typical for a medium feature. If you're writing 8+ tasks for one idea, it's too big — split it.
