#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001/api/v1}"

ok_count=0
fail_count=0

test_case() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected="$4"
  local token="${5:-}"
  local body="${6:-}"

  local tmp
  tmp="$(mktemp)"

  local auth_args=()
  if [[ -n "$token" ]]; then
    auth_args=(-H "Authorization: Bearer ${token}")
  fi

  local code
  if [[ -n "$body" ]]; then
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "${BASE_URL}${url}" \
      -H 'Content-Type: application/json' \
      "${auth_args[@]}" \
      -d "$body")
  else
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "${BASE_URL}${url}" \
      "${auth_args[@]}")
  fi

  if [[ "$code" == "$expected" ]]; then
    echo "[PASS] ${name} (${code})"
    ok_count=$((ok_count + 1))
  else
    echo "[FAIL] ${name} expected=${expected} got=${code}"
    echo "        response=$(cat "$tmp")"
    fail_count=$((fail_count + 1))
  fi

  rm -f "$tmp"
}

echo "== Backend smoke test at ${BASE_URL} =="

test_case "health" GET "/health" 200

auth_response=$(curl -sS -X POST "${BASE_URL}/auth/google/callback" \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6InN0dWRlbnQxQGhjbXV0ZS5lZHUudm4iLCJuYW1lIjoiU3R1ZGVudCBPbmUiLCJzdWIiOiJzdWJfc21va2VfdGVzdCJ9.sig"}')

STUDENT_TOKEN=$(node -e "const r=JSON.parse(process.argv[1]); process.stdout.write((r?.data?.accessToken)||'')" "$auth_response")

if [[ -z "$STUDENT_TOKEN" ]]; then
  echo "[FAIL] auth callback did not return access token"
  echo "$auth_response"
  exit 1
fi

test_case "auth me" GET "/auth/me" 200 "$STUDENT_TOKEN"

tbm_auth=$(curl -sS -X POST "${BASE_URL}/auth/google/callback" \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6InRibUBoY211dGUuZWR1LnZuIiwibmFtZSI6IlRCTSBPbmUiLCJzdWIiOiJzdWJfdGJtX3Rlc3QifQ.sig"}')
TBM_TOKEN=$(node -e "const r=JSON.parse(process.argv[1]); process.stdout.write((r?.data?.accessToken)||'')" "$tbm_auth")

if [[ -z "$TBM_TOKEN" ]]; then
  echo "[FAIL] tbm auth callback did not return access token"
  echo "$tbm_auth"
  exit 1
fi

test_case "list topics" GET "/topics?page=1&size=5" 200 "$TBM_TOKEN"
test_case "list periods" GET "/periods?page=1&size=5" 200 "$TBM_TOKEN"
test_case "list notifications (student)" GET "/notifications?page=1&size=5" 200 "$STUDENT_TOKEN"
test_case "scores summary" GET "/topics/tp_001/scores/summary" 200 "$TBM_TOKEN"
test_case "exports list" GET "/exports?page=1&size=5" 200 "$TBM_TOKEN"

echo "== Smoke result: PASS=${ok_count} FAIL=${fail_count} =="

if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
