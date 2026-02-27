# ClaimsTracker - Workers' Compensation Claims Management

## Overview
Full-stack web application for tracking workers' compensation injury claims through a two-stage pipeline: initial injury intake (Trust & Safety specialists) through active claims management (Legal). Replaces spreadsheet-based tracking for ~1,200+ claims.

## Tech Stack
- **Frontend:** React + TypeScript, Tailwind CSS, shadcn/ui, wouter routing, TanStack Query, Recharts
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL via Drizzle ORM
- **Auth:** Replit Auth (OpenID Connect)

## Project Structure
```
client/src/
  App.tsx              - Main app with routing & auth gate
  components/
    app-sidebar.tsx    - Navigation sidebar
    ui/                - shadcn/ui components
  hooks/
    use-auth.ts        - Auth hook for Replit Auth
  pages/
    landing.tsx        - Landing page for unauthenticated users
    dashboard.tsx      - Dashboard with stats & charts
    claims-list.tsx    - Main claims table with filters
    claim-detail.tsx   - Full claim view with tabbed sections
    claim-new.tsx      - New claim intake form

server/
  index.ts             - Express server entry
  routes.ts            - API routes (all /api prefixed)
  storage.ts           - DatabaseStorage implementing IStorage
  db.ts                - Drizzle + pg pool setup
  seed.ts              - Sample data seeding
  replit_integrations/auth/ - Replit Auth module

shared/
  schema.ts            - Drizzle schemas, types, Zod validation
  models/auth.ts       - Auth-related tables (users, sessions)
```

## Database Tables
- `claims` - Core claim records with full lifecycle tracking
- `claim_notes` - Append-only notes and action items per claim
- `claim_status_history` - Audit trail of status/stage transitions
- `users` - Auth users (Replit Auth)
- `sessions` - Session storage

## Key Features
- Dashboard with summary cards and charts (status pie, monthly bar)
- Claims list with filter presets, search, CSV export
- Claim detail with tabs: Overview, Case Strategy, Notes, Compliance, History
- Stage transitions: intake → active_claim → litigation → settled → closed
- Conditional field display based on worker type (W2/1099) and state (GA/CA)
- Compliance checklist with state-specific items
- Action items with target dates and completion tracking

## Commands
- `npm run dev` - Start dev server
- `npm run db:push` - Push schema changes to database
