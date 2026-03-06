# Task 2.1: Database Name Cleanup

**Status:** In progress
**Branch:** `task/2.1-name-cleanup`
**Dependencies:** None

---

## What this does

Audit claimant first/last names in the database for data quality issues — extra characters, honorifics, suffixes embedded in name fields, encoding artifacts, or anything else that looks wrong. Produce a list of records to fix, confirm with the user, then apply updates.

## Backwards compatibility

Read-only audit first. No writes until the user reviews and approves the specific changes. All claims continue to load normally throughout.

## Steps

### Step 1: Audit — run queries to surface suspicious names
**Do:** Query the `claims` table for:
- Names with non-alpha characters (parentheses, brackets, slashes, numbers, extra punctuation)
- Names with honorifics or suffixes (Mr., Mrs., Dr., Jr., Sr., II, III, Esq., etc.)
- Names that are all-caps or all-lowercase (may indicate data import artifacts)
- Names with leading/trailing whitespace
- Names with multiple consecutive spaces
- Very short names (< 2 chars) or suspiciously long names (> 40 chars)
- Names containing digits
**Files:** Direct DB query via psql or the app's DATABASE_URL
**Test:** Review the output — does it surface real issues without too many false positives?

### Step 2: Review with user
**Do:** Present findings grouped by issue type. User approves which records to fix and how.
**Test:** User confirms the proposed changes look correct.

### Step 3: Apply fixes
**Do:** Write and run targeted UPDATE statements for approved changes. Log each change.
**Test:** Re-run audit queries to confirm issues are resolved. Spot-check a few claims in the UI.

---

## Acceptance criteria

- [ ] Audit query runs and returns all suspicious name records
- [ ] User has reviewed and approved changes
- [ ] Approved fixes applied and verified
- [ ] No claims broken (spot-check 5–10 in the UI after changes)
- [ ] TRACKER.md updated to mark 2.1 complete
