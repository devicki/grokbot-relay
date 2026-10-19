#!/usr/bin/env bash
# Thin wrapper: ./deploy/connect-claude.sh  ==  grokbot-relay connect-claude
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/bin/grokbot-relay" connect-claude "$@"
