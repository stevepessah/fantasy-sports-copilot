#!/usr/bin/env bash
#
# smoke-test.sh — lightweight, dependency-free smoke check for any deployment.
#
# Validates that a running instance (local dev, Vercel preview, or prod) is
# serving its critical endpoints. Uses only `curl`, so it works anywhere without
# installing Playwright/browsers.
#
# Usage:
#   scripts/smoke-test.sh [BASE_URL]
#   BASE_URL=https://my-preview.vercel.app scripts/smoke-test.sh
#
# If previews are behind Vercel Deployment Protection, export a bypass secret:
#   VERCEL_AUTOMATION_BYPASS_SECRET=xxxxx scripts/smoke-test.sh https://...
#
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-${PLAYWRIGHT_BASE_URL:-http://localhost:3000}}}"
BASE_URL="${BASE_URL%/}"

HEADER_ARGS=()
if [ -n "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  HEADER_ARGS+=(-H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}")
fi

echo "Running smoke tests against: ${BASE_URL}"
echo "-------------------------------------------"

fail=0

check() {
  local name="$1" path="$2" expected="$3"
  local code
  code=$(curl -sS -m 30 -o /dev/null -w '%{http_code}' \
    "${HEADER_ARGS[@]}" "${BASE_URL}${path}" 2>/dev/null || echo "000")
  if [[ " ${expected} " == *" ${code} "* ]]; then
    printf '  PASS  %-16s %-22s -> %s\n' "${name}" "${path}" "${code}"
  else
    printf '  FAIL  %-16s %-22s -> %s (expected: %s)\n' "${name}" "${path}" "${code}" "${expected}"
    fail=1
  fi
}

# Homepage must serve HTML.
check "Homepage"     "/"                 "200"
# Health endpoint: 200 (ok) or 503 (degraded) both mean the app is alive.
check "Health"       "/api/health"       "200 503"
# Yahoo status always returns 200 with an `authenticated` field.
check "Yahoo status" "/api/yahoo/status" "200"

echo "-------------------------------------------"
if [ "${fail}" -ne 0 ]; then
  echo "Smoke tests FAILED"
  exit 1
fi
echo "All smoke tests PASSED"
