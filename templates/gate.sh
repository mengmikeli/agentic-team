#!/usr/bin/env bash
set -euo pipefail
# Quality gate — customize per project. Exit 0 = pass, non-zero = fail.
# Copy to .team/gate.sh and edit for your project's toolchain.

npm test
npm run check 2>/dev/null || true
npm run build
