# Preview Testing Workflow

A foolproof way to validate changes on a **live, production-like Vercel Preview
deployment** — so you never have to ship to `main`/prod just to check something
works.

Every pull request already gets its own isolated Vercel Preview URL (via the
Vercel ↔ GitHub integration). This workflow automatically runs the E2E/smoke
suite against that URL and reports pass/fail on the PR.

---

## TL;DR

1. Open a PR. Vercel builds a Preview deployment and posts its URL.
2. The **Preview Tests** GitHub Action fires on the successful deploy, runs
   Playwright against the real preview URL, and reports status on the PR.
3. Green check → the change is validated in a prod-like environment. Merge with
   confidence. Red check → download the `preview-playwright-report` artifact.

No secrets are required unless your previews are behind Vercel Deployment
Protection (see [Deployment Protection](#deployment-protection)).

---

## What was added

| Piece | Path | Purpose |
|---|---|---|
| CI workflow | `.github/workflows/preview-tests.yml` | Runs tests against a live preview on every successful preview deploy (and on-demand). |
| Playwright targeting | `playwright.config.ts` | Reads `PLAYWRIGHT_BASE_URL`/`BASE_URL`; skips the local dev server for remote targets; injects a Vercel bypass header when provided. |
| Smoke spec | `e2e/smoke.spec.ts` | `@smoke`-tagged critical-path checks that pass without any credentials. |
| Smoke script | `scripts/smoke-test.sh` | `curl`-only health check usable anywhere (no browser install). |
| npm scripts | `package.json` | `test:smoke` (Playwright `@smoke`), `smoke` (curl script). |

---

## The layered safety net

Validation runs at three levels, fastest → most thorough:

1. **Pre-merge unit/build gate** — existing `CI` workflow (`ci.yml`): lint,
   type-check, unit tests, build, and E2E against localhost.
2. **Preview smoke** — `curl` or `@smoke` Playwright checks that the deployed
   app is alive and serving critical endpoints (`/`, `/api/health`,
   `/api/yahoo/status`).
3. **Preview E2E** — the full Playwright suite runs against the exact preview
   URL, exercising the real serverless functions, env vars, and edge/runtime
   behavior that localhost can't fully reproduce.

Because layer 3 runs against the identical build/runtime Vercel will promote to
production, a green preview run is strong evidence prod will behave the same.

---

## How the automatic run works

`.github/workflows/preview-tests.yml` triggers on GitHub's `deployment_status`
event. When Vercel finishes a preview deployment it reports status to GitHub,
and the workflow:

1. Filters for `state == 'success'` and a non-production environment.
2. Resolves the URL from `environment_url` (falling back to `target_url`).
3. Checks out the exact deployed commit (`deployment.sha`).
4. Waits for `/api/health` to answer (polls up to ~150s).
5. Runs `npm run test:e2e` with `PLAYWRIGHT_BASE_URL` set to the preview URL.
6. Uploads the `preview-playwright-report` artifact (pass or fail).

> Because `deployment_status` workflows always use the copy of the file on the
> **default branch**, this workflow only triggers automatically once it has been
> merged to `main`. Until then, use the manual run below to try it out.

### Prerequisite: connect Vercel to GitHub

The automatic trigger depends on the Vercel Git integration creating GitHub
Deployments. This is the recommended setup already described in
`docs/VERCEL_DEPLOYMENT.md` (import the repo at vercel.com). No Vercel token or
GitHub Actions deploy step is needed — Vercel builds the preview, this workflow
only tests it.

---

## Running preview tests manually

### From the GitHub UI

Actions → **Preview Tests** → **Run workflow**:

- `base_url`: any deployment URL (a preview, a `vercel` CLI deploy, or prod).
- `suite`: `smoke` (fast) or `e2e` (full).

### From your machine (against any URL)

```bash
# Fast curl smoke check — no browser needed
npm run smoke -- https://your-app-git-branch.vercel.app
# or
BASE_URL=https://your-app-git-branch.vercel.app npm run smoke

# Playwright @smoke subset against a preview
PLAYWRIGHT_BASE_URL=https://your-app-git-branch.vercel.app npm run test:smoke

# Full Playwright E2E against a preview
PLAYWRIGHT_BASE_URL=https://your-app-git-branch.vercel.app npm run test:e2e
```

When `PLAYWRIGHT_BASE_URL` (or `BASE_URL`) is set, Playwright does **not** start
a local dev server — it tests the remote deployment directly. Leave it unset to
run against localhost as before.

### Create an ad-hoc preview from the CLI

If you want a preview without opening a PR:

```bash
vercel            # deploys a preview, prints the URL
# then:
npm run smoke -- <printed-url>
```

---

## Deployment Protection (required setup for private previews)

By default Vercel protects preview deployments behind "Vercel Authentication".
Unauthenticated requests are **redirected (`302`) to `https://vercel.com/sso-api...`**
(sometimes `401`/`403`), so CI cannot reach the app and the **E2E against
preview** job fails fast with an error pointing here.

Fix with ONE of these:

1. **Recommended — keep previews private, let CI in:** Vercel → Project →
   Settings → Deployment Protection → **Protection Bypass for Automation**.
   Generate the secret, then add it as a GitHub Actions repository secret named
   `VERCEL_AUTOMATION_BYPASS_SECRET` (repo → Settings → Secrets and variables →
   Actions). Both the workflow and `playwright.config.ts` automatically send the
   `x-vercel-protection-bypass` header when it's set. Locally, export the same
   variable before running the scripts.
2. **Or make previews public:** disable Deployment Protection for the Preview
   environment.

You can confirm the symptom yourself:

```bash
curl -sS -o /dev/null -D - https://<your-preview>.vercel.app/api/health | grep -i '^location'
# location: https://vercel.com/sso-api?url=...   <-- protection is on
```

---

## Reading results

- **PR status check:** the workflow surfaces as a check named "Preview Tests /
  E2E against preview".
- **Artifact:** open the failed run → download `preview-playwright-report`. It
  contains the HTML report with traces/screenshots for failures.
- **Local report:** after a local Playwright run, open `playwright-report/`
  (`npx playwright show-report`).

---

## Extending the smoke suite

Tag any new critical-path Playwright test with `@smoke` in its title/`describe`
to include it in the fast preview check:

```ts
test.describe('@smoke my critical flow', () => {
  test('does the thing', async ({ page }) => { /* ... */ })
})
```

Keep `@smoke` tests credential-free and fast so they run reliably against fresh
preview deployments.

---

## Testing Yahoo login on a preview

Real Yahoo OAuth needs its `redirect_uri` registered in the Yahoo Developer app,
which is why previews need a small one-time setup. The `@auth` E2E test
(`e2e/yahoo-auth.spec.ts`) validates the login entry point automatically on every
preview, and the full manual login flow is documented in
[`docs/YAHOO_PREVIEW_TESTING.md`](./YAHOO_PREVIEW_TESTING.md).
