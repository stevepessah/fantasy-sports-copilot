---
name: run-and-test
description: Run, lint, test, and build the Fantasy Sports Copilot app. Use whenever starting the dev server, running unit or E2E tests, formatting, or verifying a change before committing.
---

# Run & test Fantasy Sports Copilot

Single Next.js 14 monolith (App Router). Runs entirely on `localhost:3000` with in-memory data stores. No Docker, no external database.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Unit tests | `npm test` (Vitest) |
| Build | `npm run build` |
| E2E tests | `npx playwright install chromium --with-deps && npm run test:e2e` |
| Format | `npm run format` |

## Before committing

Run in this order and make sure each is clean: `npm run lint`, then `npm test`, then `npm run build`.

## Non-obvious notes

- The app works with no API keys. Without `OPENAI_API_KEY` it uses a rule-based NLP fallback; without Yahoo OAuth creds, Yahoo features (roster, matchups, standings) gracefully degrade.
- A `.env.local` with `YAHOO_CONSUMER_KEY=fake_dev_key` and `YAHOO_CONSUMER_SECRET=fake_dev_secret` is enough for local dev.
- Lint emits warnings (mostly `@next/next/no-img-element`) but zero errors — those warnings are expected.
- The build logs a harmless `Dynamic server usage` line for `/api/yahoo/league-players` (cookie usage); it does not fail the build.
- Playwright needs `npx playwright install chromium --with-deps` once before the first E2E run.
- Chat storage is browser `localStorage`; the in-memory data store resets on dev server restart.
