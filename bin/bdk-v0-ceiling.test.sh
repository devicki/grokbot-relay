#!/usr/bin/env bash
# v0 @cursor/bdk ceiling. No systemd, no /opt install, no npm download.
#   ./bin/bdk-v0-ceiling.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=grokbot-relay
source "$ROOT/bin/grokbot-relay"

fail=0
ok() { echo "ok  $1"; }
bad() { echo "FAIL $1" >&2; fail=1; }

expect_rc() { # desc want command...
  local desc="$1" want="$2" rc=0
  shift 2
  "$@" || rc=$?
  if [[ "$rc" == "$want" ]]; then ok "$desc"; else bad "$desc (rc $rc, want $want)"; fi
}

cli_case() { # desc want command...  sets CLI_OUT and CLI_ERR
  local desc="$1" want="$2"
  shift 2
  local out="" errf rc=0
  errf="$(mktemp)"
  out="$("$@" 2>"$errf")" || rc=$?
  CLI_OUT="$out"
  CLI_ERR="$(cat "$errf")"
  rm -f "$errf"
  if [[ "$rc" == "$want" ]]; then ok "$desc"; else
    bad "$desc (rc $rc, want $want)"
    printf 'stdout: %s\nstderr: %s\n' "$CLI_OUT" "$CLI_ERR" >&2
  fi
}

has() { # desc haystack pattern
  local desc="$1" hay="$2" pat="$3"
  if grep -q -e "$pat" <<< "$hay"; then ok "$desc"; else bad "$desc (missing /$pat/)"; printf '%s\n' "$hay" >&2; fi
}
has_not() {
  local desc="$1" hay="$2" pat="$3"
  if grep -q -e "$pat" <<< "$hay"; then bad "$desc (unexpected /$pat/)"; printf '%s\n' "$hay" >&2; else ok "$desc"; fi
}

if [[ "$BDK_V0_MAX" == "0.2.28" ]]; then ok "constant is 0.2.28"; else bad "constant is '$BDK_V0_MAX'"; fi

# Numeric compare, not string compare (0.10.0 and 0.2.100 are newer than 0.2.28).
expect_rc "0.3.0 > 0.2.28" 0 bdk_ver_gt 0.3.0 0.2.28
expect_rc "0.2.29 > 0.2.28" 0 bdk_ver_gt 0.2.29 0.2.28
expect_rc "0.2.28 not > 0.2.28" 1 bdk_ver_gt 0.2.28 0.2.28
expect_rc "0.2.27 not > 0.2.28" 1 bdk_ver_gt 0.2.27 0.2.28
expect_rc "0.2.8 not > 0.2.28" 1 bdk_ver_gt 0.2.8 0.2.28
expect_rc "0.2.100 > 0.2.28" 0 bdk_ver_gt 0.2.100 0.2.28
expect_rc "0.10.0 > 0.2.28" 0 bdk_ver_gt 0.10.0 0.2.28
expect_rc "1.0.0 > 0.2.28" 0 bdk_ver_gt 1.0.0 0.2.28
expect_rc "0.2.28+build not > 0.2.28" 1 bdk_ver_gt 0.2.28+build.1 0.2.28
expect_rc "0.2.28-rc.1 not > 0.2.28" 1 bdk_ver_gt 0.2.28-rc.1 0.2.28
expect_rc "0.2.29-rc.1 > 0.2.28" 0 bdk_ver_gt 0.2.29-rc.1 0.2.28
expect_rc "prerelease shorter < longer" 1 bdk_ver_gt 1.0.0-alpha 1.0.0-alpha.1
expect_rc "prerelease longer > shorter" 0 bdk_ver_gt 1.0.0-alpha.1 1.0.0-alpha
expect_rc "numeric pre < non-numeric" 1 bdk_ver_gt 1.0.0-1 1.0.0-a
expect_rc "beta.2 < beta.11" 1 bdk_ver_gt 1.0.0-beta.2 1.0.0-beta.11
expect_rc "rc.1 < release" 1 bdk_ver_gt 1.0.0-rc.1 1.0.0
expect_rc "invalid compare" 2 bdk_ver_gt latest 0.2.28

expect_rc "refuse 0.3.0" 0 bdk_v0_above_ceiling 0.3.0
expect_rc "refuse 0.2.29" 0 bdk_v0_above_ceiling 0.2.29
expect_rc "refuse 0.10.0" 0 bdk_v0_above_ceiling 0.10.0
expect_rc "allow 0.2.28" 1 bdk_v0_above_ceiling 0.2.28
expect_rc "allow 0.2.27" 1 bdk_v0_above_ceiling 0.2.27
expect_rc "allow 0.2.28-rc.1" 1 bdk_v0_above_ceiling 0.2.28-rc.1
expect_rc "refuse garbage" 0 bdk_v0_above_ceiling latest
expect_rc "refuse empty" 0 bdk_v0_above_ceiling ""

msg="$(bdk_v0_ceiling_msg 0.3.0)"
has "ceiling names the package" "$msg" "@cursor/bdk@0.3.0"
has "ceiling names the max" "$msg" "0.2.28"
has "ceiling points at v1" "$msg" "v1 relay"
has "ceiling points at Agent SDK 0.3" "$msg" "Agent SDK 0.3"
has "ceiling points at the spike" "$msg" "docs/spike-bdk-0.3.md"
has "ceiling says nothing installed" "$msg" "Nothing was installed"

dec="$(bdk_v0_check_decision 0.2.28 0.3.0)"
has "check reports a newer SDK" "$dec" "past the v0 ceiling"
has "check points at v1" "$dec" "v1 relay"
has_not "check does not offer bdk-upgrade past the ceiling" "$dec" "bdk-upgrade"

dec="$(bdk_v0_check_decision 0.2.27 0.3.0)"
has "below ceiling uses update" "$dec" "grokbot-relay update"
has_not "below ceiling does not offer bdk-upgrade to latest" "$dec" "bdk-upgrade"

dec="$(bdk_v0_check_decision 0.2.27 0.2.28)"
has "within ceiling still offers bdk-upgrade" "$dec" "sudo grokbot-relay bdk-upgrade"
has_not "within ceiling is not described as past the max" "$dec" "past the v0 ceiling"

dec="$(bdk_v0_check_decision 0.2.28 0.2.28)"
has "at the ceiling is up to date" "$dec" "Up to date within the v0 ceiling"
has_not "at the ceiling does not offer bdk-upgrade" "$dec" "bdk-upgrade"

dec="$(bdk_v0_check_decision none 0.3.0)"
has_not "uninstalled + newer SDK does not offer bdk-upgrade" "$dec" "bdk-upgrade"

dec="$(bdk_v0_check_decision 0.3.0 0.3.0)"
has "installed above ceiling is called out" "$dec" "already above the v0 ceiling"
has_not "installed above ceiling does not offer bdk-upgrade" "$dec" "bdk-upgrade"

help="$(cmd_help)"
has "help names the ceiling" "$help" "$BDK_V0_MAX"
has "help says the command refuses" "$help" "refused before npm install"
has "help points at the spike" "$help" "docs/spike-bdk-0.3.md"

if grep -q '"@cursor/bdk": "0.2.28"' "$ROOT/relay/package.json"; then
  ok "live pin stays 0.2.28"
else
  bad "live pin changed"
fi

# --target never calls npm. A fake npm fails the test if it is invoked.
fake="$(mktemp -d)"
log="$fake/npm.log"
cat > "$fake/npm" <<'EOF'
#!/bin/sh
echo "$@" >> "$NPM_LOG"
if [ "$1" = view ]; then
  printf '%s\n' "${NPM_FAKE_VERSION:-0.3.0}"
  exit 0
fi
echo "unexpected npm $*" >&2
exit 99
EOF
chmod +x "$fake/npm"

PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run refuses 0.3.0 without npm" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.3.0
has "dry-run 0.3.0 stderr is the ceiling" "$CLI_ERR" "Nothing was installed"
has "dry-run 0.3.0 names v1" "$CLI_ERR" "v1 relay"
has "dry-run 0.3.0 names the spike" "$CLI_ERR" "docs/spike-bdk-0.3.md"
if [[ ! -s "$log" ]]; then ok "dry-run --target does not call npm"; else bad "npm was called: $(cat "$log")"; fi

: > "$log"
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run refuses 0.2.29" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.2.29
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run refuses 0.10.0" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.10.0
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run refuses 0.2.100" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.2.100
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run allows 0.2.28" 0 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.2.28
has "allow message says no install" "$CLI_OUT" "No install"
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run allows 0.2.27" 0 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.2.27
if [[ ! -s "$log" ]]; then ok "allowed --target still does not call npm"; else bad "npm was called: $(cat "$log")"; fi

: > "$log"
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "--target without dry-run is refused" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --target 0.2.28
has_not "--target without dry-run does not ask for root" "$CLI_ERR" "needs root"
if [[ ! -s "$log" ]]; then ok "--target without dry-run does not call npm"; else bad "npm was called: $(cat "$log")"; fi

PATH="$fake:$PATH" NPM_LOG="$log" cli_case "dry-run --pin is refused" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run --target 0.2.28 --pin
has "dry-run --pin explains itself" "$CLI_ERR" "does not change files"

: > "$log"
PATH="$fake:$PATH" NPM_LOG="$log" NPM_FAKE_VERSION=0.3.0 cli_case "dry-run of npm latest 0.3.0 refuses before install" 1 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run
has "npm latest 0.3.0 hits the ceiling" "$CLI_ERR" "@cursor/bdk@0.3.0"
has "npm latest refusal installed nothing" "$CLI_ERR" "Nothing was installed"
if grep -q '^view ' "$log" && ! grep -q install "$log"; then ok "npm latest path is view, not install"; else bad "npm log: $(cat "$log")"; fi

: > "$log"
PATH="$fake:$PATH" NPM_LOG="$log" NPM_FAKE_VERSION=0.2.28 cli_case "dry-run of npm latest 0.2.28 is allowed" 0 \
  "$ROOT/bin/grokbot-relay" bdk-upgrade --dry-run
has "npm latest 0.2.28 would install nothing in dry-run" "$CLI_OUT" "No install"
if grep -q '^view ' "$log" && ! grep -q install "$log"; then ok "allowed latest is still only npm view"; else bad "npm log: $(cat "$log")"; fi

: > "$log"
PATH="$fake:$PATH" NPM_LOG="$log" cli_case "bdk-check reports 0.3.0 and does not offer the upgrade" 0 \
  "$ROOT/bin/grokbot-relay" bdk-check
has "bdk-check shows latest" "$CLI_OUT" "latest    @cursor/bdk: 0.3.0"
has "bdk-check shows the ceiling" "$CLI_OUT" "v0 max    @cursor/bdk: 0.2.28"
has "bdk-check says past the ceiling" "$CLI_OUT" "past the v0 ceiling"
has_not "bdk-check does not invite bdk-upgrade" "$CLI_OUT" "bdk-upgrade"
if grep -q install "$log"; then bad "bdk-check ran npm install"; else ok "bdk-check does not npm install"; fi

rm -rf "$fake"

if (( fail )); then
  echo "bdk-v0-ceiling: $fail check(s) failed" >&2
  exit 1
fi
echo "bdk-v0-ceiling: all checks passed"
