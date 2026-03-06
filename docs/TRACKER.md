# Task Tracker — Incidentally

**Single source of truth. Updated at every task close.**

Status: ✅ Done · 🔧 In progress · ⬜ Not started · 🚫 Blocked

---

## Phase 1 — Core (Complete)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Core incident CRUD (create, read, update, delete) | ✅ | |
| 1.2 | New incident flow with step-by-step wizard | ✅ | |
| 1.3 | Pro search with Redshift integration | ✅ | Two-tier: local pg_trgm + Redshift ILIKE |
| 1.4 | Shift calendar highlighting on new incident (W2/1099 colors) | ✅ | W2=Moss, 1099=Coral |
| 1.5 | Shift auto-population (Partner, State, Address, Pay Rate, Shift Length) | ✅ | |
| 1.6 | Internal incident numbering (YYYYMMDDNN-SS-CC) | ✅ | |
| 1.7 | Incident list with sortable, resizable columns and clickable rows | ✅ | |
| 1.8 | Incident detail page (Overview, Case Strategy, Financials, Risk Analytics, Documents tabs) | ✅ | |
| 1.9 | Document library (upload with drag-and-drop, download via presigned URL, delete) | ✅ | S3 + local fallback |
| 1.10 | Smart Pro ID backfill scripts (fuzzy name matching, Redshift shift lookup) | ✅ | Near-matches flagged for review |
| 1.11 | Backfill scripts for shift location, pay rate, shift length | ✅ | Parallelized with p-limit |
| 1.12 | Instawork brand color palette applied throughout UI | ✅ | |
| 1.13 | Splash page with live stats from real database | ✅ | /api/public/stats endpoint |
| 1.14 | Data Insights dashboard (claims by status, stage, state, injury type, month) | ✅ | |
| 1.15 | Risk Analytics tab (correlations, breakdowns) | ✅ | |
| 1.16 | CSV bulk import | ✅ | |
| 1.17 | Spreadsheet data sync (one-time historical data backfill) | ✅ | |
| 1.18 | Pro Falcon admin links from Pro Details card | ✅ | Falcon URL pattern |
| 1.19 | Partner address backfill from shift location | ✅ | |

---

## Phase 2 — Enhancements & Integrations (Active)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Database name cleanup (claimant/Pro names with extra characters or artifacts) | 🔧 | In review |
| 2.2 | Google Drive document import (match files to open incidents, store in doc library) | ⬜ | No AI summary; architecture decided |
| 2.3 | Google Workspace sign-on (replace placeholder auth with real Google OAuth) | ⬜ | |
| 2.4 | Pro Details card: shift count stats (total / W2 / 1099) and open claims check | ⬜ | Paused during cleanup |
| 2.5 | Data Insights dashboard rework (better global summaries, split Financials page) | ⬜ | |
| 2.6 | Company Settings page (insurance policies, company info, carrier mappings) | ⬜ | Schema designed |

---

## Phase 3 — Future Features

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Pro History / earnings lookback (1-year, W2 vs 1099 weekly averages) | ⬜ | Paused; display format TBD |
| 3.2 | Reporting and data export | ⬜ | |
| 3.3 | Real user authentication + role-based permissions (T&S vs Legal roles) | ⬜ | Depends on 2.3 |
| 3.4 | User Home page with workflow prompts (built from current placeholder) | ⬜ | Depends on 3.3 |
| 3.5 | Document library: Gmail ingestion (forwarding email → auto-attach to claim) | ⬜ | Phase 3 only after 2.2 solid |
| 3.6 | More Redshift data integrations | ⬜ | TBD |

---

## Ideas / Future

- Automated claim routing based on injury type and state
- SLA tracking and overdue alerts
- Settlement calculator / reserve recommendations
- Integration with TPA (Third Party Administrator) systems
