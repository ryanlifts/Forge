#!/usr/bin/env bash
# BlackPyre permanent test gauntlet — run from the repo root or tests/
set -e
cd "$(dirname "$0")/.."
if [ ! -d node_modules/jsdom ]; then npm install jsdom --no-save --silent; fi
node tests/unit.test.js
node tests/integration.test.js
echo ""
echo "GAUNTLET GREEN — safe to ship."
