# Skill: Verify Task

**When to use:** After building a task, before closing it. Triggered by "verify," "check my work," "am I done," or before running task-close.

## Steps

### Step 1: Run automated checks

```bash
make check
```

Both tests and lint must pass. Fix issues before continuing.

### Step 2: Review against the task breakdown

Open `docs/task_breakdowns/TASK_<id>_*.md` and check:

- [ ] Every step is marked complete
- [ ] Every acceptance criterion is met
- [ ] Gotchas and lessons learned are documented

### Step 3: Review against technical guidance

Check `docs/TECHNICAL_GUIDANCE.md`:

- [ ] API calls go through the shared client (backoff, error handling)
- [ ] Secrets loaded from `.env`, not hardcoded
- [ ] Error handling is in place — clear messages on failure
- [ ] Code style matches project conventions

Also ask: did this task introduce anything new that isn't documented yet?

- [ ] New external tool or API → add to the APIs and Integrations section
- [ ] New architectural decision or pattern (e.g. chose LLM model, chose a data format) → add to Project-Specific Decisions
- [ ] New environment variable → add to `.env.example` and note it in TECHNICAL_GUIDANCE.md
- [ ] New constraint discovered (rate limit, data sensitivity, etc.) → add to Constraints

If anything is missing, update `docs/TECHNICAL_GUIDANCE.md` before closing. The goal: anyone reading the docs after this task should understand every decision that was made.

### Step 4: Test it manually

Run the actual task and verify:

- [ ] Output is correct (spot-check results)
- [ ] Edge cases handled (empty input, missing fields, API errors)
- [ ] Existing functionality still works

### Step 5: Review the diff

```bash
git diff main
```

- [ ] Only files related to this task changed
- [ ] No secrets or `.env` values in the diff
- [ ] No debug print statements left in

### Step 6: Report

> "Verification report for Task [X.Y]:
> - Tests: [PASS/FAIL]
> - Lint: [PASS/FAIL]
> - Manual run: [PASS/FAIL]
> - Backwards compatible: [Yes/No]
> - [Ready to close / Issues to fix first]"

## Rules

- Never skip tests. If they don't exist, write them first.
- Never skip lint. Fix errors, don't disable rules.
- Be honest. If something is incomplete, say so.
