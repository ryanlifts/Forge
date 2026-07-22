# BlackPyre Architecture

**Current as of v63 (July 2026).**

A single-page PWA: vanilla HTML/CSS/JS, no framework, no build step, localStorage only.
Deployed on GitHub Pages. Developed AI-assisted (Claude / ChatGPT) from a phone — every rule
below exists to keep that workflow safe.

## Invariants — do not violate, ever

1. **Repo name and URL never change** — installed PWAs break.
2. **Primary localStorage keys `forge:data`, `forge:cfg`, `forge:program` never rename.** Internal recovery/installation keys `forge:lkg`, `forge:lkg:previous`, `forge:lkg:older`, `forge:quarantine`, and `forge:install` are also permanent once shipped — see DATA-MODEL.md.
3. **No build step.** Files are edited as plain text and deployed as-is. Classic scripts only — **no ES modules** (the codebase uses one shared global scope by design).
4. **Service-worker cache name bumps every release** (`blackpyre-vNN` in sw.js). No bump = users never get the update.
5. **Deploy ritual:** all changed files in **one commit** → wait for the green check → use the update notice or close/reopen the installed app as directed.
6. **Every release passes the gauntlet first:** `bash tests/run-tests.sh`. No green, no ship.
7. **Intentional brand language is whitelisted** ("Forge your body", "Session Forged", "Day Forged", "PR FORGED", forge-as-verb in quotes). Everything else says BlackPyre.
8. **The Easter egg is a memorial.** The handwriting image is embedded byte-for-byte and is never re-rendered, traced, or substituted with a font. Treat that CSS block and its data as read-only.
9. **Privacy rules:** normal backups exclude Anthropic/OpenAI keys; food photos live in memory only; raw AI responses are parsed then discarded; nothing logs without user confirmation. Device-only recovery records may contain API keys so they can restore the device exactly. Any user-triggered raw recovery export carries a separate privacy warning and must be stored securely.

## Files

| File | Role |
|---|---|
| `index.html` | Markup + styles only (~172 KB in v57); loads the data files then the 7 app slices; includes protected/recovery UI, semantic tabs/dialogs/live regions, Home/Settings disclosures, offline notice, compact program identity, persistent-workout-draft controls, the consolidated Train-only rest dock, the default-on ChatGPT food-handoff toggle, and opt-in USDA-anchored food-suggestion controls |
| `scripts/01-storage.js` | primary/recovery keys, defaults, schema 0→1→2 preparation, commit/rollback, established-install detection, three-generation rolling LKG lifecycle, missing-primary protection, structured diagnosis, quarantine transaction, protected-mode guards, shared Undo service, state, AI-setting restore preservation, food-suggestion defaults, accessibility naming/dialog focus/tab keyboard behavior, network-status UI, predictable view activation/tabs |
| `scripts/02-food.js` | bars, meals, food logging, keyboard-operable food/recent result buttons, deterministic next-food suggestions using a bundled 120-food USDA reference catalog plus familiar foods (remaining-target scoring, exact listed servings, exclusions, review-before-log), clear manual-entry validation, shared deletion Undo, offline local-search/barcode/scanner fast-fail |
| `scripts/03-train.js` | training sessions, durable saved-exercise drafts with Resume/Discard, compact current-program identity and confirmed replacement, exercise-level Save/Completed/Edit integrity, named dynamic workout/program-builder controls, protected session-type changes, clear validation, conservative auto-progression, aligned mobile set controls and touch targets |
| `scripts/04-weight.js` | weight chart, weigh-in/saved-meal Undo, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, consolidated manual rest timer with duration chooser, share |
| `scripts/05-ai.js` | USDA/barcode lookups, usual-meal, schedule UI, kudos, offline direct-AI fast-fail, confirmed AI/pasted program replacement, measurement Undo, coach chat, check-in, default-on/Settings-toggleable key-free food handoff with live-API preference and first-item review positioning, AI report, analytics |
| `scripts/06-settings.js` | setup wizard, FAQ, macro calculator, grouped settings including food-suggestion preferences, normal/partial/raw/diagnostic exports, backup restore, manual recovery-snapshot restore, recovery status and quarantine cleanup with automatic disclosure when attention is needed |
| `vendor/html5-qrcode.min.js` | Vendored barcode scanner (npm-verified 2.3.8, Apache-2.0 notice adjacent). Precached; never fetched from a CDN |
| `scripts/07-boot.js` | dash, Easter egg, protected/recovery panel orchestration, network-status initialization, approved update toast, boot |
| `data-quotes.js` | QUOTES vault — classic script, loads before the app slices, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-suggestions.js` | 120-food USDA Standard Reference suggestion catalog with per-100g calories/macros, exact serving grams, NDB numbers, and full source descriptions — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/PHASE2-PROOF.md` | Permanent historical record of the Phase 2 byte-identity proof |
| `tests/` | Permanent gauntlet — 478 automated checks (105 unit + 373 integration), reproducible jsdom lockfile, and `bella-reference.b64` (frozen memorial byte truth; never edited). Not precached |
| `.github/workflows/tests.yml` | Runs the gauntlet on every push |
| `DATA-MODEL.md` | Primary storage schema, recovery-record contracts, and migration history |

## index.html section map (JS, in execution order)

storage keys & defaults → migrations/recovery vault → pure helpers → state → tabs → bars →
FOOD (meals, logging, bundled USDA-anchored remaining-target food suggestions, USDA/OFF/barcode, usual-meal, kudos, schedule UI) →
*(QUOTES / LOCAL_DB / ALT_MAP / FOOD_SUGGESTION_CATALOG / FAQ live in the data-*.js files, loaded first)* →
TRAIN (sessions, e1RM/PR engine, plate math, rest timer, programs/share) →
WEIGHT (chart, measurements, adaptive TDEE, projections) →
streak → finish day → AI ENGINE (BYOK, multi-provider) →
coach chat → weekly check-in → handoff mode → AI report → analytics →
setup wizard → FAQ → macro calculator → settings/backup/recovery → dash → Easter egg → protected/recovery boot → update toast.

Section headers look like `// ================== NAME ==================` — keep them.
The Phase-2 slicing cut the original inline JS at these markers into scripts/01–07
**in the original order**. The migration was proven byte-identical to the v42 inline JS
(sha256 63ea5e9b…, 190,324 UTF-8 bytes / 189,847 characters); the live hash check was
retired in v44 — the first release to intentionally edit a slice — and the complete proof
and method are preserved permanently in `tests/PHASE2-PROOF.md`. Lasting structural
invariants (script order, strict mode, tag attributes, slice opening markers) remain
enforced by the suite.

Slice rules from here on:
- The slices are the source of truth and are edited directly. Execution order is
  01 → 07 and is load-bearing; never reorder the `<script src>` tags in index.html.
- Classic scripts share one global scope, but each file is a separate parsing/evaluation
  unit. Every local classic script begins with `"use strict";` — test-enforced.
- Declarations and slice boundaries remain unchanged unless an approved plan covers them.
  New sections belong where their execution order requires; further splitting is a plan-level decision.

## Storage safety conventions (v45–v63)

- `schemaVersion` versions the complete primary state (`forge:cfg`, `forge:data`,
  `forge:program`) and is physically stored in `forge:cfg`; current primary schema = 2. v56 adds `forge:data.activeWorkoutDraft` so completed exercises survive reload before session finalization.
- Boot preserves the original primary strings and runs parse → numbered migration → tolerant
  validation → serialization on copies in pure `prepareState()`, then commits separately.
- Present unparseable/invalid/newer primary data enters protected mode before disclaimer/setup.
  Save routines restore the protected in-memory snapshot and perform no normal write.
- Normal restore uses the same preparation pipeline. Bad/newer backups are refused without
  poisoning a healthy app; absent envelope members leave that device area untouched.
- v63 maintains three validated device-only LKG generations at `forge:lkg`,
  `forge:lkg:previous`, and `forge:lkg:older`. They refresh only from successfully persisted,
  fully prepared primary state; unsaved memory is never snapshotted. A populated generation
  cannot be replaced by an empty/default candidate.
- `forge:install` records that the device completed a healthy boot. On an established device,
  unexpectedly missing logs or settings enter protected mode before defaults or onboarding can
  write. The best populated validated snapshot is shown read-only and destructive reset is disabled.
- Before any protected or user-requested snapshot recovery overwrites primary storage, exact
  originals are written to `forge:quarantine` and read back byte-for-byte. Recovery succeeds
  only after primary read-back equality and a second `prepareState()` validation.
- All three LKG generations and quarantine use strict `recoveryFormatVersion:1`, separate
  from primary schemaVersion. The installation marker uses its own `formatVersion:1`. Newer
  recovery records are never consumed, deleted, or overwritten by an older app.
- localStorage is not transactional. Primary commit skips unchanged keys, writes settings
  last, and attempts rollback. Quarantine-first ordering and post-write verification bound
  risk but do not claim true atomicity.

## Testing conventions

- Run with `bash tests/run-tests.sh` — it does `npm ci` against the committed lockfile,
  then runs both suites. Test tooling only; the app still has zero runtime dependencies.
- Harness (`tests/harness.js`) boots the **shipped** app in jsdom and inlines local scripts/
  styles. It records `setItem`, `removeItem`, and `clear` calls across primary and internal BlackPyre storage keys.
- Memorial integrity is enforced byte-for-byte against `tests/bella-reference.b64`, with
  an exact embed count of 1. The reference file never changes.
- Unit suite: pure math/parsers, schema preparation including 1→2 draft migration/validation, strict recovery-record parsing,
  structured diagnostics, candidate summaries, and version-separation rules.
- Integration suite: all historic app flows plus protected zero-write behavior, mutation
  re-sync, interrupted commits, missing-primary boot/runtime protection, established-install
  marking, three-generation LKG rotation/populated-snapshot retention/manual restore, area diagnosis,
  all three recovery sources, quarantine ordering/retention/export/deletion, exact diagnostic export, legacy fallback,
  API-key boundaries, read-back failure, durable workout-draft save/resume/discard/failure behavior, exercise-level workout saving, protected session-type changes, routine-deletion Undo, manual-food validation, confirmed program replacement, offline network fast-fail, conservative progression, compact program identity/separate management, consolidated Train-only rest duration/control dock, Home/Settings disclosure hierarchy, offline status transitions, practical compact-control touch targets, predictable tab/session positioning, 16px editable controls, complete control naming, semantic/keyboard bottom tabs, keyboard food results, dialog focus entry/return, dynamic onboarding/workout/builder accessibility, default-on food handoff/toggle/restore behavior, deterministic opt-in food suggestions (120-item USDA reference catalog, exact servings, remaining targets, familiar-food bonus, exclusions, refresh, historical-date hiding, and review-before-log), handoff paste/log and first-item review positioning, update toast, and Easter egg timing.
- **Wording-pin convention (v59):** tests that pin user-facing or FAQ text must pin only
  short, load-bearing guarantee phrases ("never starts automatically", "does not start or
  reset"), never full sentences, layout-adjacent wording, or phrasing that a routine copy
  edit would touch. Release-pinned assertions (like the exact SW cache string) are advanced
  each release as part of the bump — that advance is maintenance, not weakening.
- The permanent suite is **478 automated checks** and only grows. New features add tests in
  the same release; existing checks are never deleted or weakened. The roughly 700 checks
  written before Phase 0 were old throwaway checks, not this permanent suite.
- jsdom quirks: stub `URL.createObjectURL`, ignore `scrollTo` warnings, `select()` runs via
  rAF (wait ≥50 ms), and fresh-user tests must pass disclaimer + setup.

## Editing rules for AI assistants

- Patch with exact-string anchors and **assert the anchor exists before writing**; if an
  assertion fails, re-read the file.
- Never splice by index ranges across section boundaries without diff-verifying removals.
- `node --check` every local JS file after edits; run the full gauntlet before packaging.
- Package changed files in one folder + zip; diff the package against the working copy.
- Do not rename IDs, storage fields, keys, or functions as “cleanup” — each rename is a feature-sized change.
