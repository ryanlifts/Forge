#!/usr/bin/env bash
# BlackPyre permanent test gauntlet - 95 automated checks against the shipped app.
# Reproducible installs via the committed lockfile (npm ci). No build step, ever.
set -e
cd "$(dirname "$0")"
npm ci --silent
cd ..
node tests/unit.test.js
node tests/integration.test.js
echo ""
echo "GAUNTLET GREEN — safe to ship."
