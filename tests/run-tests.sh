#!/usr/bin/env bash
# BlackPyre permanent automated test gauntlet against the shipped app.
# Reproducible installs via the committed lockfile (npm ci). No build step, ever.
set -e
cd "$(dirname "$0")"
npm ci --silent
cd ..
node tests/brand-onboarding.test.js
node tests/weight-time-copyright.test.js
node tests/phase1-nutrition-safety.test.js
node tests/native-release-decisions.test.js
node tests/app-store-phase2.test.js
node tests/unit.test.js
node tests/integration.test.js
node tests/card-profiles.test.js
echo ""
echo "GAUNTLET GREEN — safe to ship."
