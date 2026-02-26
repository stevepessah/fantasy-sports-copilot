## Cursor Cloud specific instructions

This is a Next.js 14 (App Router) single-service application. No database, Docker, or external services are required for development.

### Quick reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Build | `npm run build` |

See `README.md` and `QUICKSTART.md` for full usage instructions.

### Notes

- The app uses an **in-memory store** (`lib/db.ts`) — no database setup needed. Data resets on server restart.
- `OPENAI_API_KEY` is optional; the app falls back to a rule-based AI system without it.
- Yahoo Fantasy integration is optional and requires OAuth credentials.
- The build produces a non-fatal log about `cookies` in `/api/yahoo/league-players` during static generation — this is expected and does not affect functionality.
- Lint reports only warnings (no errors) — these are pre-existing and should not be treated as blockers.
