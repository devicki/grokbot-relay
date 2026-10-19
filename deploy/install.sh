#!/usr/bin/env bash
# Thin wrapper: sudo ./deploy/install.sh [--port N]  ==  sudo bin/grokbot-relay install [--port N]
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/bin/grokbot-relay" install "$@"
