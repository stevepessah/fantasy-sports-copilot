---
name: add-feature
description: Add a feature end-to-end in Fantasy Sports Copilot following the repo's file-organization conventions. Use when creating new UI, business logic, API routes, hooks, contexts, types, or their tests.
---

# Add a feature end-to-end

Place each piece of a feature in the correct directory. The project root must only hold config files and application directories — never put scripts, docs, or data files in the root.

## Where things go

| Piece | Location |
|---|---|
| React components | `components/` |
| Business logic / library code (AI, parsers, API clients, utils) | `lib/` |
| React hooks (SWR, custom) | `hooks/` |
| React contexts / providers | `contexts/` |
| API route handlers | `app/api/` |
| Shared TypeScript types | `types/` |
| Static assets (images, icons) | `public/` |
| Static datasets (CSV/JSON) | `data/` |
| Utility scripts (Python/shell/TS one-offs) | `scripts/` |
| Markdown docs, guides, notes | `docs/` |
| Unit / component tests | `__tests__/` (Vitest) |
| E2E tests | `e2e/` (Playwright) |

## Workflow

1. Model the data with shared types in `types/` when it's reused across modules.
2. Put pure logic and API clients in `lib/`; keep components thin.
3. Add server endpoints as route handlers under `app/api/`.
4. Fetch data in components via SWR hooks in `hooks/`.
5. Add a Vitest unit/component test in `__tests__/` for new logic and components; add an `e2e/` Playwright spec for user-facing flows.
6. Verify with the `run-and-test` skill: `npm run lint`, `npm test`, `npm run build`.

## Conventions

- TypeScript throughout; validate external input with `zod`.
- Match the styling approach already used in neighboring components (Tailwind + `clsx`/`tailwind-merge`).
- Do not add new markdown docs, scripts, or data files to the project root.
