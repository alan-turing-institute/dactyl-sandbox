#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
EXPECTED_CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fetch() {
  path="$1"
  curl -fsS -D "$TMP_DIR/headers" -o "$TMP_DIR/body" "$BASE_URL$path"
}

header_value() {
  # Strip CRLF and header name, preserving the value exactly after optional whitespace.
  awk -v name="$1" 'BEGIN { IGNORECASE=1 } tolower($0) ~ "^" tolower(name) ":" { sub("^[^:]*:[[:space:]]*", ""); sub("\r$", ""); print; exit }' "$TMP_DIR/headers"
}

assert_header() {
  name="$1"
  expected="$2"
  actual="$(header_value "$name")"
  if [ "$actual" != "$expected" ]; then
    printf 'Expected %s to be [%s], got [%s]\n' "$name" "$expected" "$actual" >&2
    exit 1
  fi
}

fetch /
case "$(header_value "Content-Type" | tr '[:upper:]' '[:lower:]')" in
  text/html*) ;;
  *) printf 'Unexpected / Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "X-Content-Type-Options" "nosniff"
assert_header "X-Frame-Options" "DENY"
assert_header "Referrer-Policy" "no-referrer"
assert_header "Permissions-Policy" "camera=(), microphone=(), geolocation=()"
assert_header "Content-Security-Policy" "$EXPECTED_CSP"
grep -q '<!doctype html>' "$TMP_DIR/body"

fetch /app.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /app.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /analytics.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /analytics.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /analytics-config.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /analytics-config.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"
grep -q 'DACTYL_ANALYTICS_CONFIG' "$TMP_DIR/body"

fetch /calendar-export.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /calendar-export.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /contextual-empty-states.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /contextual-empty-states.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /daily-catch.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /daily-catch.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /premium-hooks.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /premium-hooks.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /recurrence.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /recurrence.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /first-task-onboarding.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /first-task-onboarding.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /quick-add-parser.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /quick-add-parser.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /triage-mode.js
case "$(header_value "Content-Type")" in
  application/javascript*|text/javascript*) ;;
  *) printf 'Unexpected /triage-mode.js Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

fetch /styles.css
case "$(header_value "Content-Type")" in
  text/css*) ;;
  *) printf 'Unexpected /styles.css Content-Type: %s\n' "$(header_value "Content-Type")" >&2; exit 1 ;;
esac
assert_header "Content-Security-Policy" "$EXPECTED_CSP"

status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/nonexistent")"
if [ "$status" != "404" ]; then
  printf 'Expected /nonexistent HTTP 404, got %s\n' "$status" >&2
  exit 1
fi

printf 'HTTP smoke checks passed for %s\n' "$BASE_URL"
