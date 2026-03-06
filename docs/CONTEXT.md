# Incidentally — Working Context

**Living document — updated every work session. Keep under 300 lines.**

---

## What This Does

Incidentally is Instawork's internal injury claims management tool for Trust & Safety and Legal teams. It tracks workers' compensation and occupational accident claims from initial intake through resolution — replacing spreadsheets with a purpose-built pipeline. It integrates live with Instawork's Pro data (Redshift/Falcon) to auto-populate claim details, highlight worked shifts on the injury date calendar, and surface Pro history.

**Strategic direction:** Evolve from a data management tool into an AI-powered claims assistant. The system will ingest all available claim information (documents, Redshift Pro data, claim history, financials) and use it to proactively prompt users on next steps — and eventually take those steps autonomously via agentic workflows. The goal is that a T&S agent or paralegal opens a claim and is told exactly what needs to happen next, rather than having to reconstruct context from scratch each time.

---

## Current State

**Date:** 2026-02-27
**Phase:** Phase 2 — Enhancements & Integrations
**Active task:** 2.1 — Database name cleanup review
**Branch:** main
**Blocker:** None
**Last session:** Integrated cursor-build-template process engine; added live splash page stats from real DB data
**Next up:** Query DB for claimant names with extra characters/terms that need cleaning up

---

## Active Tasks

- [ ] **2.1** — Review and clean up claimant/Pro names in the database (extra characters, honorifics, data artifacts)
- [ ] **2.2** — Google Drive document import (match files by claimant name to open incidents, store in document library)
- [ ] **2.3** — Google Workspace sign-on (replace placeholder session auth with real Google OAuth)
- [ ] **2.4** — Pro Details card: add shift count stats (total / W2 / 1099) and open claims check
- [ ] **2.5** — Data Insights dashboard rework (better global summaries, split out Financials page)
- [ ] **2.6** — Company Settings page (insurance policies, company info, carrier mappings)

### Done

See TRACKER.md Phase 1 for full completed task list.

### Coming Up

- Pro History / earnings lookback (1-year, W2 vs 1099 breakdown, weekly averages)
- Reporting and data export
- Real user authentication + role-based permissions (after Google OAuth)
- Document library: Gmail ingestion (Phase 3)
- More Redshift data integrations

**Phase 4 — AI Agents (future, T&S focus):**
- Deterministic automation first: auto-assign carrier/coverage, flag duplicate claims (no LLM needed)
- LLM agents in suggestion-only mode until output is validated: doc field extractor, claim summarizer, T&S next-step prompter
- Autonomous routine actions only after suggestion mode is trusted
- Model-agnostic LLM layer — OpenAI, Anthropic, Google adapters; different agents may use different models
- Litigation workflows are Phase 5+

---

## Key Decisions

- **Full-stack TypeScript** — React (Vite) frontend + Express backend in one repo. Keeps everything in one language.
- **Drizzle ORM** — Type-safe schema in `shared/schema.ts`, shared between frontend and backend. Apply changes with `npm run db:push`.
- **Redshift via Data API** — No persistent connection; queries run per-request via SSO-authenticated AWS profile.
- **S3 for document storage** — Presigned URLs for downloads. Local `uploads/` used in dev.
- **pg_trgm for fuzzy Pro search** — Trigram similarity for typo-tolerant name matching in local DB; prefix-truncation ILIKE for Redshift.
- **No AI doc summarization in Phase 2** — Deferred, not permanently ruled out. Phase 4 will include document field extraction via LLM once the document library is stable.

---

## Constraints

1. All secrets in `.env` — never in code
2. Redshift SSO sessions expire (~8 hours) — re-run `aws sso login` when Redshift queries fail with auth errors
3. Pro data from Redshift is **read-only** — never write back
4. `uploads/` is gitignored — local dev only, not for production
5. No AI document processing in Phase 2 — deferred to Phase 4 (AI Agents)

---

## Session Log

- 2026-02-27: Integrated cursor-build-template; onboarding docs created; live splash stats; name cleanup queued
