# BLACKPYRE HANDOFF — current as of v66 (July 2026)

You are a collaborator on BlackPyre, a fitness PWA at
`ryanlifts.github.io/Forge/` (repo: `ryanlifts/Forge`). This repository represents **v66**, built on the completed v57 Phase 4 foundation and the v58–v65 security, housekeeping, food-handoff, food-suggestion, data-protection, and elapsed-time timer releases. Confirm the GitHub Pages deployment/cache
before calling it live.

The two documents reproduced below (`ARCHITECTURE.md` and `DATA-MODEL.md`) live in the repo
root, are binding, and are current as of v66. Read them before proposing or writing code.

## v66 — optional progression and faster barcode scanning

Adds a Settings → Training toggle for automatic progression. The setting defaults on for legacy users; when off, the next session carries the last logged weights forward unchanged. With progression enabled, standard exercises preload 5 lb more only after all programmed sets reach their target, while exercise names containing `assisted` preload 5 lb less assistance. Barcode scanning now uses a square adaptive crop, 20 fps, and the browser-native BarcodeDetector through html5-qrcode when supported so horizontal and vertical retail barcodes can be read with the phone upright. Primary schemaVersion 2, Native Vault, workout data, and recovery format 1 are unchanged. Cache: blackpyre-v66. Tests: **506 (115 unit + 391 integration)**.

## v65 — completed timer resets to its last duration

Changes only the completed-state UX of the elapsed-time rest timer. When a countdown expires—while visible, after backgrounding or unlocking, or during a full relaunch/phone restart—the timer stops and resets to the exact duration used to start that countdown. It does not auto-restart and no longer displays `GO!`. The device-only `forge:rest-timer` format remains version 1 and now stores `durationSec`; completion replaces the running deadline with a deadline-free `ready` record. Primary schemaVersion 2, workout data, Native Vault, normal backups, LKG snapshots, and recovery format 1 are unchanged. Cache: blackpyre-v65. Tests: **493 (110 unit + 383 integration)**.

## v64 — elapsed-time rest timer

Fixes the Train rest timer on iPhone when the PWA is backgrounded, the screen is locked, the app is closed, or the phone is shut down. The timer no longer depends on receiving one JavaScript interval callback per second. A running timer now stores a fixed finish timestamp in the separate device-only `forge:rest-timer` record and recomputes the remaining time from the clock whenever the page wakes. Paused timers preserve their exact remainder, resume with a new finish timestamp, and survive a full app restart. If a timer expires while the app is unavailable, the next launch shows `GO!` and clears the temporary record. This does not change primary schemaVersion 2, workout data, normal backups, LKG snapshots, or recovery format 1. Cache: blackpyre-v64. Tests: **488 (109 unit + 379 integration)**.

## v63 — missing-primary data-protection hotfix

Closes the recovery gap exposed during testing when an established installation unexpectedly loses `forge:data` or `forge:cfg`. BlackPyre now detects missing primary state before defaults or onboarding can write, enters protected mode, pauses every normal save, and presents the best validated snapshot read-only. Empty/default state can never replace a populated recovery snapshot. Recovery now keeps three validated rolling generations (`forge:lkg`, `forge:lkg:previous`, `forge:lkg:older`) and chooses a populated snapshot ahead of a newer empty one. A permanent `forge:install` marker distinguishes an established installation from a truly fresh first launch. Settings adds verified manual snapshot restore plus a separately warned raw storage diagnostic export; recovery still quarantines exact prior primary strings and verifies read-back before success. The destructive readable/reset option is disabled during a missing-primary incident. No primary schema migration: `schemaVersion` remains 2; recovery records remain format 1 and the install marker uses format 1. Cache: blackpyre-v63. Tests: **478 (105 unit + 373 integration)**.

## v62 — expanded USDA-anchored food suggestions

Expands “What could I eat next?” from a narrow starter set into a bundled catalog of 120 common foods spanning animal protein, plant protein, grains/starches, produce, snacks, and fats. Each entry uses USDA Standard Reference 28 calories and macros per 100g, an exact listed serving gram weight, a five-digit USDA NDB number, and the full source description. The recommendation engine ranks that catalog alongside recents and My Foods, so prior history earns a familiarity bonus but is never required. The catalog ships with the app and works offline; ranking still makes no live USDA or AI request. Tapping a choice opens the existing serving/macros review and never auto-logs. Copy and FAQ now state the essential accuracy limit: these are reference averages for the named preparation, while brands, recipes, trimming, draining, and cooking can differ. No primary schema migration or stored food-shape change. Cache: blackpyre-v62. Tests: **456 (105 unit + 351 integration)**.

## v61 — local food suggestions

Adds an opt-in “What could I eat next?” card to today’s Food page. It runs entirely on-device and scores familiar recent foods, My Foods servings, and a curated set of built-in staples against the user’s remaining calories and macros. Weight-loss focus favors protein-forward and lower-calorie options; users can turn that focus off and exclude name fragments. Refresh rotates through other high-scoring choices. Tapping a suggestion opens the existing amount/macros review card and never logs automatically. Historical dates stay uncluttered, reached targets get an honest no-force message, and missing targets get setup guidance. No network request, AI dependency, primary schema migration, or stored food-shape change. Cache: blackpyre-v61. Tests: **441 (105 unit + 336 integration)**.

## v60 — default-on ChatGPT food handoff

The key-free ChatGPT food-estimate handoff is now visible by default for fresh and existing users whenever no live API key is active. A dedicated Settings toggle hides or restores only those food handoff tools; normal food logging and the selected live AI/coaching provider remain independent. A configured live provider key still uses the faster in-app AI food flow. The optional `foodHandoffOn` preference treats absent/true as enabled and false as hidden, is preserved across partial/older restores, and does not require a schema bump. FAQ and data-model documentation were updated. Cache: blackpyre-v60. Tests: **422 (105 unit + 317 integration)**.

## v59 — housekeeping (audit follow-through)

Removed the confirmed-dead loadJSON (zero references anywhere). migrateCfg was
NOT removed: verification found the permanent suite exercises it directly, so it
stays with a rationale comment — the audit's own "verify no dynamic references
first" rule working as intended. sw.js now documents why it never precaches
itself. Three structural protections joined the suite: single-writer discipline
(only 01-storage may write localStorage — enforced against the source of every
other slice), historical-edit-vs-draft isolation, and the LKG quota-sacrifice
path end to end (which testing proved is fully self-healing: sacrifice, save,
immediate snapshot rebuild). The wording-pin test convention is documented in
ARCHITECTURE.md. Settings' Data card gains one quiet approximate storage-use
line. Cache: blackpyre-v59. No storage, schema, or behavior changes beyond the
new Settings line.

## v58 — self-hosted barcode scanner (security)

The html5-qrcode 2.3.8 library is now vendored at vendor/html5-qrcode.min.js
(verified byte-for-byte against the npm registry authoritative shasum
0b0cdf7a9926cfd4be530e13a51db47592adfa0d; Apache-2.0 notice preserved at
vendor/html5-qrcode.LICENSE.txt). The scanner loader requests only the local
file; no third-party code loads at runtime anywhere in the app. The SW shell
precaches it, so the camera scanner library is also available offline.
Cache: blackpyre-v58. No storage, schema, or behavior changes.

## Current state

1. The permanent `/tests` gauntlet has **506 checks: 115 unit + 391 integration**. GitHub
   Actions runs it on every push. Tests are cumulative and are never deleted or weakened.
2. `tests/bella-reference.b64` is the frozen memorial byte truth. Exact identity and embed
   count 1 are test-enforced; never regenerate, re-render, edit, or replace it.
3. App structure remains markup/styles in `index.html`, four static data scripts, then
   `scripts/01-storage.js` through `scripts/07-boot.js` in strict order. Classic scripts,
   shared global scope, no ES modules, no build step — permanent.
4. Primary state remains `forge:cfg`, `forge:data`, `forge:program` at **schemaVersion 2**.
   Internal `forge:lkg`, `forge:lkg:previous`, `forge:lkg:older`, and `forge:quarantine` remain `recoveryFormatVersion:1`; `forge:install` and `forge:rest-timer` use independent `formatVersion:1` records.
5. Missing primary logs/settings on an established device enter protected mode before defaults can write; three rolling snapshots are retained and populated recovery can never be replaced by empty state.
6. Saved exercises persist immediately in `data.activeWorkoutDraft`; routine deletions have
   Undo; program replacement is confirmed; offline network-only actions fail fast.
7. ChatGPT food handoff is on by default without a key, has an independent Settings toggle,
   and yields to a configured live API key for API-based food logging.
8. Food suggestions are opt-in, target-aware, preference-filtered, offline-capable, and review-before-log; the bundled 120-food USDA reference catalog does not require prior food history or a live request.
9. v57 completes programmatic control names, semantic/keyboard bottom tabs, keyboard food
   results, named dynamic onboarding/workout/builder controls, and dialog focus entry/return.
10. Browser zoom remains enabled; visible focus behavior is preserved.
11. Cache: `blackpyre-v66`.

## Five-phase status

- **Phase 0 — DONE:** permanent tests, CI gate, architecture/data documentation.
- **Phase 1 — DONE (v42):** Bella deduplication and static-data extraction.
- **Phase 2 — DONE (v43):** seven ordered classic-script slices; proof preserved.
- **Phase 3 — DONE (v44–v46):** update toast, safe schema migrations/protected mode,
  validated LKG/quarantine/recovery.
- **Phase 4 — DONE (v47–v57):** progression, AI handoff, mobile/navigation, training and
  food integrity, FAQ accuracy, timer/program layout, interface simplification, workout
  drafts/action safety, and accessibility completion.

## v57 — accessibility completion and Phase 4 closeout

- Every shipped and dynamically rendered form control has a programmatic accessible name.
- Bottom navigation uses tablist/tab/tabpanel semantics, keeps `aria-selected` and
  `aria-hidden` synchronized, and supports Arrow keys plus Home/End.
- Food search and recent-food rows are native named buttons without changing selection flow.
- Full-screen overlays identify as modal dialogs, receive focus when opened, and return
  focus to their opener when closed.
- Dynamic onboarding, workout set, and program-builder controls receive contextual names.
- Important errors and status messages expose live-region semantics.
- FAQ documents keyboard and screen-reader support.
- No storage/schema, workout-history, food-history, backup, recovery, or program-format change.
- Tests: **398 (105 unit + 293 integration)**.

## Workflow constraints

Ryan deploys from GitHub's web UI, sometimes from a phone. Prefer whole-file/repo-mirror and
changed-files ZIP deliverables. One commit per release; wait for green checks; apply the update
notice or close/reopen as directed. Every release gets a plain-language report and stops for approval.

---
---

# ARCHITECTURE.md (verbatim from repo)

# BlackPyre Architecture

**Current as of v66 (July 2026).**

A single-page PWA: vanilla HTML/CSS/JS, no framework, no build step, localStorage only.
Deployed on GitHub Pages. Developed AI-assisted (Claude / ChatGPT) from a phone — every rule
below exists to keep that workflow safe.

## Invariants — do not violate, ever

1. **Repo name and URL never change** — installed PWAs break.
2. **Primary localStorage keys `forge:data`, `forge:cfg`, `forge:program` never rename.** Internal device keys `forge:lkg`, `forge:lkg:previous`, `forge:lkg:older`, `forge:quarantine`, `forge:install`, and `forge:rest-timer` are also permanent once shipped — see DATA-MODEL.md.
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
| `scripts/01-storage.js` | primary/recovery keys, device-only rest-timer persistence, defaults, schema 0→1→2 preparation, commit/rollback, established-install detection, three-generation rolling LKG lifecycle, missing-primary protection, structured diagnosis, quarantine transaction, protected-mode guards, shared Undo service, state, AI-setting restore preservation, food-suggestion defaults, accessibility naming/dialog focus/tab keyboard behavior, network-status UI, predictable view activation/tabs |
| `scripts/02-food.js` | bars, meals, food logging, keyboard-operable food/recent result buttons, deterministic next-food suggestions using a bundled 120-food USDA reference catalog plus familiar foods (remaining-target scoring, exact listed servings, exclusions, review-before-log), clear manual-entry validation, shared deletion Undo, offline local-search/barcode/scanner fast-fail |
| `scripts/03-train.js` | training sessions, durable saved-exercise drafts with Resume/Discard, compact current-program identity and confirmed replacement, exercise-level Save/Completed/Edit integrity, named dynamic workout/program-builder controls, protected session-type changes, clear validation, conservative auto-progression, aligned mobile set controls and touch targets |
| `scripts/04-weight.js` | weight chart, weigh-in/saved-meal Undo, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, consolidated manual rest timer with duration chooser and elapsed-time/restart recovery, share |
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
| `tests/` | Permanent gauntlet — 506 automated checks (115 unit + 391 integration), reproducible jsdom lockfile, and `bella-reference.b64` (frozen memorial byte truth; never edited). Not precached |
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

## Storage safety conventions (v45–v66)

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
- `forge:rest-timer` is a separate format-1 device-only runtime record. It stores either an absolute
  finish timestamp or a paused remainder, so iOS suspension and full app/phone restarts do not stop
  elapsed time. It is excluded from primary schema, normal backups, and LKG rotation.
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
- The permanent suite is **506 automated checks** and only grows. New features add tests in
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

---

# DATA-MODEL.md (verbatim from repo)

# BlackPyre Data Model

**Current as of v66 (July 2026). Primary schemaVersion: 2. Recovery format: 1.**

## Storage keys

BlackPyre has three permanent **primary user-state keys**:

| Key | Contents |
|---|---|
| `forge:cfg` | Configuration and targets (object) |
| `forge:data` | All logged data (object) |
| `forge:program` | Loaded training program (object) |

v46–v66 add permanent **internal, device-only keys**:

| Key | Contents |
|---|---|
| `forge:lkg` | Current validated last-known-good whole-state snapshot |
| `forge:lkg:previous` | Previous validated whole-state snapshot |
| `forge:lkg:older` | Older validated whole-state snapshot |
| `forge:quarantine` | One exact pre-recovery copy of unsafe primary strings plus diagnosis |
| `forge:install` | Established-install marker used to distinguish data loss from a true first run |
| `forge:rest-timer` | Temporary running/paused/ready rest-timer state that survives suspension and restart |

All nine primary/internal names are load-bearing once shipped and must not be renamed casually. The `forge:`
prefix predates the BlackPyre rebrand and is intentionally preserved. The legacy read-only
fallback `ryan-cut:data` may supply logs when `forge:data` is missing; BlackPyre never renames,
removes, or modifies that legacy key.

## Whole-state schemaVersion

`schemaVersion` is physically stored in `forge:cfg`, but versions the complete **primary**
state and normal backup envelope: settings, logged data, and program.

| Raw value | Meaning / behavior in v66 |
|---|---|
| property absent or integer `0` | Pre-versioning legacy state; run numbered migrations from step 0 |
| integer `1` | v45–v55 state; migrate 1 → 2 by adding an empty active-workout draft field |
| integer `2` | Current primary schema; no migration step |
| integer greater than `2` | Newer primary data; protected boot / refused restore; no downgrade path |
| anything else | Invalid; protected boot / refused restore |

The version is read from raw parsed settings before `DEFAULT_CFG` merges. A migration stamps
its destination only after that complete step succeeds. `DEFAULT_CFG` does not contain
`schemaVersion`, so defaults cannot disguise legacy data as current.

## Recovery-record version

`forge:lkg`, `forge:lkg:previous`, `forge:lkg:older`, and `forge:quarantine` are not
primary state and do not use `schemaVersion`. They carry strict `recoveryFormatVersion: 1`.
`forge:install` and `forge:rest-timer` are not recovery records and each uses its own `formatVersion: 1`.

| Raw recovery value | Behavior |
|---|---|
| missing | No record available; healthy operation continues |
| malformed / invalid format | Record is not consumed; healthy live state is not poisoned |
| integer `1` with a valid shape | Current record; validate/use under the rules below |
| integer greater than `1` | Newer record; older BlackPyre may not use, delete, sacrifice, or overwrite it |
| anything else | Invalid; never coerced or guessed |

Recovery records are excluded from normal backups and rejected by both normal backup restore
and the protected backup-import path.

---

## forge:cfg

Merged over `DEFAULT_CFG` at boot. `0` means “unset” for personal fields; consumers must not
treat unset values as real measurements or targets.

| Field | Type | Meaning | Notes |
|---|---|---|---|
| `schemaVersion` | integer | Generation of complete primary state | Current = `2`; strict interpretation above |
| `setupDone` | bool | Onboarding completed or skipped | |
| `disclaimerAccepted` | string date | Date disclaimer gate was accepted | Gate blocks normal app until set |
| `startWt` | number | Starting bodyweight (lb) | 0 = unset |
| `goalWt` | number | Goal bodyweight (lb) | 0 = unset |
| `calTarget` | number | Exact daily calorie target | 0 = unset; schedule disabled |
| `proTarget` | number | Exact daily protein goal (g) | Never red for exceeding |
| `carbGoal` / `fatGoal` | number | Exact daily carb/fat targets (g) | |
| `calSchedMode` | string | `same` \| `frisat` \| `satsun` \| `frisatsun` \| `custom` | Presets derive live from `calTarget` |
| `calSchedDays` | number[7] \| null | Sun→Sat calories, custom mode only | Weekly total may be under, never over, `calTarget×7` |
| `accent` | string | Theme accent key | Invalid values heal to gold |
| `calcInputs` | object | Last macro-calculator inputs | Convenience prefill |
| `splitState` | object | Macro split `{mode,p,c,f}` | |
| `lastTargetWt` | number | Weight at last target calculation | Drives readjust prompt |
| `adjustPromptedAt` | number/date | Last readjust prompt | Prevents nagging |
| `liftGoals` | object | `{exerciseName: goal e1RM}` | |
| `restSec` / `customRestSec` / `customRests` | number / number / array-or-object | Rest defaults and custom choices | Legacy tolerated |
| `measureOn` / `waterOn` | bool | Optional tracking toggles | |
| `usdaKey` | string | Personal USDA API key | Overrides shared key |
| `anthropicKey` / `openaiKey` | string | BYOK AI keys | Excluded from normal/readable exports; may exist in device-only recovery records |
| `aiProvider` | string | `anthropic` \| `openai` \| `handoff` | Controls live AI/coaching provider |
| `foodHandoffOn` | bool | Show key-free ChatGPT food handoff when no live API key is active | Absent or `true` = enabled; `false` = hidden |
| `foodSuggestionsOn` | bool | Show target-aware next-food suggestions from the bundled USDA reference catalog plus familiar foods on today's Food page | Default `false`; opt-in only |
| `foodSuggestionsWeightLoss` | bool | Favor protein-forward and lower-calorie candidates in suggestion scoring | Default `true`; has no effect while suggestions are off |
| `foodSuggestionsAvoid` | string | Comma/newline-separated name fragments excluded from suggestions | Simple name filter, not an allergy guarantee |
| `aiModelAnth` / `aiModelOai` | string | Optional model overrides | |
| `lastCoachDate` | string date | Last weekly coach check-in | |

The v62 suggestion catalog lives in `data-suggestions.js`, not in `forge:cfg` or `forge:data`. Each entry keeps per-100g reference macros, an exact serving gram weight, its USDA NDB number, and the full USDA source description. Suggestions therefore require no schema migration or new stored-food shape.

## forge:data

| Field | Shape | Meaning |
|---|---|---|
| `food` | `{ "YYYY-MM-DD": [entry] }` | `entry={name,cal,pro,carb,fat,meal}` |
| `workouts` | `[{date,day,title,sets:{ex:[{w,r}]},notes}]` | v51 saves only sets from explicitly saved exercises; legacy string sets still parse |
| `weights` | `[{date,lbs}]` | One per date; chart/TDEE/projections |
| `measure` | `[{date,waist,chest,arm}]` | Optional; one per date |
| `water` | `{ "YYYY-MM-DD": count }` | Optional |
| `finished` | `{ "YYYY-MM-DD": true }` | Never counts toward streak alone |
| `myFoods` | `{barcode:{name,brand,cal100,pro100,carb100,fat100,...}}` | Personal barcode library; checked before network |
| `recents` | `[item]` (max 20) | Quick re-log list |
| `foodCounts` | `{foodKey:n}` | Usual-meal detector |
| `mealCounts` | `{meal:{foodKey:n}}` | Per-meal frequency |
| `meals` | array/object legacy-tolerant | Saved meal combinations |
| `meta` | `{lastBackup,logsSince}` | Backup reminder bookkeeping |
| `activeWorkoutDraft` | `null` or `{date,day,title,programName,sets,notes,updatedAt}` | Durable saved-exercise draft; contains only exercises explicitly saved with valid sets; cleared after successful session logging or confirmed discard |

## forge:program

`{name, author, days:[{id, title, exercises:[{name, sets, reps, ...}]}]}`. It can be loaded
from JSON, pasted from an AI, or proposed in a coach JSON block. Export fallback filename:
`blackpyre-program`.

## Rolling last-known-good snapshots

`forge:lkg`, `forge:lkg:previous`, and `forge:lkg:older` use the same record shape:

```json
{
  "recoveryFormatVersion": 1,
  "savedAt": "ISO timestamp",
  "source": "boot or save/restore source",
  "strings": {
    "cfg": "serialized prepared settings",
    "data": "serialized prepared logs",
    "program": "serialized prepared program"
  },
  "legacyData": "exact active ryan-cut:data string or null"
}
```

Rules:
- Created/refreshed only after healthy boot, successful primary save, successful normal
  restore, or successful protected recovery.
- Built by rereading persisted storage and passing the complete state through pure
  `prepareState()`; unsaved in-memory changes are never snapshotted.
- Identical state retains the existing timestamp and causes no redundant write.
- A changed healthy snapshot rotates current → previous → older before the new current is
  written; a failed rotation/replacement is rolled back best-effort.
- Protected mode, failed primary save, invalid persisted state, or unexpectedly missing
  primary data cannot refresh any generation.
- If any validated generation contains user records, an empty/default candidate cannot
  replace it. Recovery selection prefers a populated generation, then the newest timestamp.
- LKG failure never turns a successful primary save into a failure. Existing generations are
  restored best-effort if replacement/read-back fails, and Settings reports unavailable.
- If a primary save fails specifically for quota, the current-format `forge:lkg` may be
  sacrificed and that live save retried once; previous/older generations remain available.
  Quarantine and newer recovery records are never sacrificed.
- The records are device-only and may contain AI keys. Normal/readable exports still remove them.


## forge:install

Current record shape:

```json
{
  "formatVersion": 1,
  "establishedAt": "ISO timestamp",
  "lastHealthyAt": "ISO timestamp",
  "schemaVersion": 2
}
```

The marker is written only after a healthy validated snapshot exists. It contains no user logs
or API keys. Together with existing settings, snapshots, or quarantine, it proves that missing
`forge:data` or `forge:cfg` is a recovery incident rather than a first run. A marker with a newer
format is treated as established evidence and is never overwritten by this version. A true fresh
install has no primary/internal evidence; v65 writes a complete three-key default primary state
before creating the first snapshot and marker.

## forge:rest-timer

This is device-only runtime state, separate from primary user data and recovery snapshots.
It is written when the manual Train rest timer starts, pauses, resumes, gains time, or completes.
After completion it keeps only the last started duration in a ready record; tapping End or choosing
another idle duration removes that temporary record.

Running record:

```json
{
  "formatVersion": 1,
  "status": "running",
  "endAt": 2000000090000,
  "remainingSec": 90,
  "durationSec": 90,
  "savedAt": 2000000000000
}
```

Paused record:

```json
{
  "formatVersion": 1,
  "status": "paused",
  "remainingSec": 45,
  "durationSec": 90,
  "savedAt": 2000000045000
}
```

Completed/ready record:

```json
{
  "formatVersion": 1,
  "status": "ready",
  "durationSec": 90,
  "savedAt": 2000000090000
}
```

Rules:
- A running timer is calculated from `endAt - Date.now()`, not from the number of interval callbacks.
  Background suspension therefore cannot freeze elapsed time.
- A paused timer preserves the exact rounded-up seconds remaining and resumes from a new finish time.
- `durationSec` is the exact duration used to start that countdown; adding time does not replace it.
- The record survives a full app or phone restart. If its finish time has already passed, the app stops,
  clears `endAt`, and stores a ready record so the display resets to `durationSec` without auto-restarting.
- It is excluded from primary schemaVersion, normal backups, LKG snapshots, quarantine, and migrations.
- A newer format is never overwritten or removed by an older app.

## forge:quarantine

Current record shape:

```json
{
  "recoveryFormatVersion": 1,
  "quarantinedAt": "ISO timestamp",
  "diagnostic": {"stage":"...","part":"...","code":"...","reason":"..."},
  "originals": {
    "cfg": "exact raw string or null",
    "data": "exact raw string or null",
    "program": "exact raw string or null",
    "legacyData": "exact active fallback string or null"
  }
}
```

Rules:
- Created only after a complete recovery candidate validates and immediately before any
  primary recovery commit.
- Exact record is read back and compared before primary writes are allowed.
- A different existing quarantine is never silently overwritten. Explicit replacement is
  required; a verified quarantine created during the current recovery incident is retained
  across retries so failed recovery cannot replace the true originals.
- Commit/rollback/read-back failure leaves protected mode active and retains quarantine.
- Successful recovery also retains quarantine until the user explicitly exports/deletes it
  in Settings. Deletion touches neither primary state nor LKG.
- Quarantine may contain API keys. Export requires a privacy warning and uses a distinct
  `blackpyre-RAW-RECOVERY-YYYY-MM-DD.json` filename.

## Normal backup envelope

Normal backup is `{cfg, data, program}` JSON; its generation is announced by
`cfg.schemaVersion`. Rolling snapshots, quarantine, the installation marker, and rest-timer state are never included.
`anthropicKey` and `openaiKey` are stripped.

Normal restore uses the shared `prepareState()` path. Device AI fields
(`anthropicKey`, `openaiKey`, `aiProvider`, `aiModelAnth`, `aiModelOai`, `foodHandoffOn`) survive unless the
backup explicitly contains that field. Food-suggestion preferences are ordinary non-secret cfg
fields and travel in normal backups. An absent envelope member leaves the corresponding device
area untouched. Bad/invalid/newer backups and recovery records are refused without placing a
healthy app into protected mode.

## Protected recovery and exports

For corruption/validation failures or unexpectedly missing established primary data, recovery
appears before disclaimer/onboarding. Missing-primary incidents disable the readable reset path;
the user must restore a validated snapshot or their own backup. Empty defaults cannot replace a
populated snapshot.

For other corruption/validation failures, recovery appears before disclaimer/onboarding. Newer
primary schema and storage-read failures offer no write-capable recovery.

Recovery sources:
1. validated LKG;
2. conservative readable-state candidate (keep usable whole areas, reset unusable areas);
3. normal backup file. In recovery mode, absent backup members come from readable live areas
   or defaults. AI fields use readable current settings first, otherwise validated LKG;
   explicitly present backup fields win.

Every candidate passes `prepareState()` before quarantine. Primary recovery commits through
the settings-last commit path and is successful only after exact primary read-back and a
second full preparation.

Protected readable export is `blackpyre-PARTIAL-YYYY-MM-DD.json`; it may be incomplete,
strips Anthropic/OpenAI keys, and does not update backup metadata. If quarantine cannot be
stored/verified, a separately warned and confirmed raw export may stand in as the preservation
fallback. The app cannot verify a browser download and states that limit honestly.

## Migration history (order matters)

| When | What | How |
|---|---|---|
| v25 | FORGE → BlackPyre rebrand | Primary storage keys intentionally unchanged |
| v34 | Range targets → exact | `calLo/calHi → calTarget`, `proLo/proHi → proTarget`; must run on raw cfg before defaults |
| v35 | `calSchedMode:"weekend"` → `"frisat"` | `migrateCfg()` |
| v36+ | Fake defaults removed | Personal fields default to 0/unset; consumers guard |
| v45 | Whole-state primary schema 0 → 1 | Pure prepare pipeline, strict versioning, protected boot, shared boot/restore path |
| v46 | Recovery format 1 introduced; primary schema remains 1 | Device-only LKG, structured diagnosis, quarantine-before-write, validated recovery/read-back |
| v47 | No storage-schema change | Focused Phase 4 progression and AI handoff usability fixes only |
| v48 | No storage-schema change | Mobile train-input zoom prevention and corrected AI review scroll positioning |
| v49 | No storage-schema change | Training-session integrity: only completed sets save, session-type changes protect drafts, invalid logs explain what is missing |
| v50 | No storage-schema change | Daily-first Train layout, predictable navigation/scroll targets, 16px editable controls, and larger workout touch targets |
| v51 | No storage-schema change | Exercise-level Save/Completed/Edit state and food-flow safeguards; stored workout/food shapes unchanged |
| v52 | No storage-schema change | FAQ-only accuracy refresh |
| v53 | No storage-schema change | Mobile set-row alignment patch |
| v54 | No storage-schema change | Manual rest controls and compact current-program/Manage layout |
| v55 | No storage-schema change | Consolidated floating rest timer, Home/Settings disclosure hierarchy, accessibility touch targets, and offline status clarity |
| v56 | Whole-state primary schema 1 → 2 | Adds `forge:data.activeWorkoutDraft` for durable saved-exercise work; migration adds `null`, stamps settings last, and never promotes the read-only `ryan-cut:data` fallback into `forge:data` implicitly |
| v57 | No storage-schema change | Accessibility completion: named controls, semantic/keyboard tabs, keyboard food results, and dialog focus behavior; stored data remains unchanged |
| v58 | No storage-schema change | Barcode scanner library self-hosted; stored data unchanged |
| v59 | No storage-schema change | Housekeeping and approximate browser-storage visibility; stored data unchanged |
| v60 | No primary schema migration | Optional `foodHandoffOn` preference added; absent or `true` means enabled, so existing/fresh users receive the key-free food handoff without rewriting stored cfg |
| v61 | No primary schema migration | Adds opt-in `foodSuggestionsOn`, weight-loss scoring preference, and name-exclusion text; all are ordinary cfg defaults and stored food/log shapes remain unchanged |
| v62 | No primary schema migration | Adds a static 120-food USDA Standard Reference suggestion catalog outside localStorage; cfg fields and stored food/log shapes remain unchanged |
| v63 | No primary schema migration; recovery protections expanded | Adds established-install marker, missing-primary protected boot/runtime detection, three rolling LKG generations, populated-snapshot retention, manual snapshot restore, and exact storage diagnostic export |
| v64 | No primary schema migration; device-only timer format 1 added | Stores running rest timers by absolute finish time and paused timers by remaining seconds so suspension and restart cannot freeze them |
| v65 | No primary schema migration; timer format 1 extended compatibly | Adds `durationSec` plus a deadline-free `ready` status so expiration resets to the exact last started duration instead of showing a completion word |
| v66 | No primary schema migration | Adds `cfg.autoProgressionOn` (legacy/default `true`), assisted-load progression direction, and faster orientation-friendly barcode scanning |

Old backups from any era must continue restoring correctly; the permanent suite proves the
range-era path.

## AI response contracts

The coach may embed JSON blocks: `{"bpTargets":{calTarget,proTarget,carbGoal,fatGoal}}`
(legacy ranges tolerated via averaging) for an **Apply targets** action; a `program` object
for **Load**; and food estimates `{"foods":[{name,cal,pro,carb,fat}]}` with all four macros.
Parsing normalizes smart quotes, fences, and zero-width junk. Raw AI responses are never persisted.
