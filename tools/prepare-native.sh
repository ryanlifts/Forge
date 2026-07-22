#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf www
mkdir -p www

cp \
  index.html \
  manifest.json \
  sw.js \
  apple-touch-icon.png \
  icon-192.png \
  icon-512.png \
  data-faq.js \
  data-foods.js \
  data-quotes.js \
  data-suggestions.js \
  www/

cp -R scripts vendor www/

npx cap sync ios

echo "Native BlackPyre assets prepared and synchronized."
