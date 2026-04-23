# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Fantasy Sports Copilot is a **single Next.js 14 monolith** (App Router). No Docker, no microservices, no external databases required. The app runs entirely on `localhost:3000` with in-memory data stores.

### Running the app
- `npm run dev` starts the dev server on port 3000.
- The app works fully without any API keys. Without `OPENAI_API_KEY`, it uses a rule-based NLP fallback. Without Yahoo OAuth credentials, Yahoo-dependent features (roster, matchups, standings) gracefully degrade.
- A `.env.local` with `YAHOO_CONSUMER_KEY=fake_dev_key` and `YAHOO_CONSUMER_SECRET=fake_dev_secret` is sufficient for local development.

### Key commands
| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Unit tests | `npm test` (Vitest) |
| Build | `npm run build` |
| E2E tests | `npx playwright install chromium --with-deps && npm run test:e2e` |
| Format | `npm run format` |

### Non-obvious notes
- Lint produces warnings (mostly `@next/next/no-img-element`) but zero errors. These are expected.
- The build emits a harmless log line about `Dynamic server usage` for `/api/yahoo/league-players` due to cookie usage; this does not fail the build.
- Chat storage is in browser `localStorage`, not server-side.
- The in-memory data store resets on dev server restart.
- Playwright E2E tests require a separate `npx playwright install chromium --with-deps` step before first run.

### Repository structure conventions
- `docs/` — development notes, setup guides, troubleshooting (not user-facing docs).
- `data/` — static data files (CSV/JSON player lists, etc.).
- `scripts/` — utility scripts (Python data scrapers, shell deploy helpers, TS one-offs).
- Root should only contain config files (`package.json`, `tsconfig.json`, `next.config.js`, etc.), `README.md`, `AGENTS.md`, and application directories (`app/`, `components/`, `lib/`, `hooks/`, `contexts/`, `types/`, `public/`, `__tests__/`, `e2e/`).
- Do **not** add new markdown docs, scripts, or data files to the project root.
