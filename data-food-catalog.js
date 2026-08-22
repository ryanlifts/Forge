"use strict";
// BlackPyre Food Catalog client contract.
//
// The bundled USDA starter catalog is always available through
// FOOD_SUGGESTION_CATALOG. Larger USDA branded-food shards are downloaded from
// a source-separated GitHub Release and cached by the native runtime. The web
// runtime uses a hash-identical GitHub Pages mirror because browsers require
// cross-origin readable responses. Open Food Facts remains an independently
// labeled fallback; its ODbL records
// are never merged into the USDA release.
const BLACKPYRE_FOOD_CATALOG = Object.freeze({
  schema:1,
  releaseManifestUrl:"https://github.com/ryanlifts/BlackPyre-Food-Catalog/releases/latest/download/manifest.json",
  webManifestUrl:"https://ryanlifts.github.io/BlackPyre-Food-Catalog/manifest.json",
  webBaseUrl:"https://ryanlifts.github.io/BlackPyre-Food-Catalog",
  sourceLabels:Object.freeze({
    usda:"USDA FoodData Central",
    off:"Open Food Facts",
  }),
  searchPrefixLength:2,
  barcodePrefixLength:2,
});
