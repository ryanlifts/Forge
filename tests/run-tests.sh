#!/usr/bin/env bash
# BlackPyre permanent test gauntlet against the shipped app.
# Reproducible installs via the committed lockfile (npm ci). No build step, ever.
set -e
cd "$(dirname "$0")"
npm ci --silent
cd ..
node tests/phase1-nutrition-safety.test.js
node tests/phase1-food-entry-safety.test.js
node tests/phase2-keyless-food-data.test.js
node tests/phase2-label-scanner.test.js
node tests/phase2-web-label-scanner.test.js
node tests/unit.test.js
node tests/integration.test.js
node tests/v84-ui-polish.test.js
node tests/card-profiles.test.js
node tests/manual-food-slider.test.js
echo ""
echo "GAUNTLET GREEN — safe to ship."
