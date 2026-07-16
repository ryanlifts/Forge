# BLACKPYRE HANDOFF — current as of v57 (July 2026)

You are a collaborator on BlackPyre, a fitness PWA at
`ryanlifts.github.io/Forge/` (repo: `ryanlifts/Forge`). This repository represents **v57**,
the Phase 4 accessibility-completion and closeout release built on the completed v46
hardening foundation and v47–v56 usability work. Confirm the GitHub Pages deployment/cache
before calling it live.

The two documents reproduced below (`ARCHITECTURE.md` and `DATA-MODEL.md`) live in the repo
root, are binding, and are current as of v57. Read them before proposing or writing code.

## Current state

1. The permanent `/tests` gauntlet has **398 checks: 105 unit + 293 integration**. GitHub
   Actions runs it on every push. Tests are cumulative and are never deleted or weakened.
2. `tests/bella-reference.b64` is the frozen memorial byte truth. Exact identity and embed
   count 1 are test-enforced; never regenerate, re-render, edit, or replace it.
3. App structure remains markup/styles in `index.html`, three static data scripts, then
   `scripts/01-storage.js` through `scripts/07-boot.js` in strict order. Classic scripts,
   shared global scope, no ES modules, no build step — permanent.
4. Primary state remains `forge:cfg`, `forge:data`, `forge:program` at **schemaVersion 2**.
   Internal `forge:lkg` and `forge:quarantine` remain `recoveryFormatVersion:1`.
5. Saved exercises persist immediately in `data.activeWorkoutDraft`; routine deletions have
   Undo; program replacement is confirmed; offline network-only actions fail fast.
6. v57 completes programmatic control names, semantic/keyboard bottom tabs, keyboard food
   results, named dynamic onboarding/workout/builder controls, and dialog focus entry/return.
7. Browser zoom remains enabled; visible focus behavior is preserved.
8. Cache: `blackpyre-v57`.

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

**Current as of v57 (July 2026).**

A single-page PWA: vanilla HTML/CSS/JS, no framework, no build step, localStorage only.
Deployed on GitHub Pages. Developed AI-assisted (Claude / ChatGPT) from a phone — every rule
below exists to keep that workflow safe.

## Invariants — do not violate, ever

1. **Repo name and URL never change** — installed PWAs break.
2. **Primary localStorage keys `forge:data`, `forge:cfg`, `forge:program` never rename.** The v46 internal recovery keys `forge:lkg` and `forge:quarantine` are also permanent once shipped — see DATA-MODEL.md.
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
| `index.html` | Markup + styles only (~172 KB in v57); loads the data files then the 7 app slices; includes protected/recovery UI, semantic tabs/dialogs/live regions, Home/Settings disclosures, offline notice, compact program identity, persistent-workout-draft controls, and the consolidated Train-only rest dock |
| `scripts/01-storage.js` | primary/recovery keys, defaults, schema 0→1→2 preparation, commit/rollback, LKG lifecycle, structured diagnosis, quarantine transaction, protected-mode guards, shared Undo service, state, accessibility naming/dialog focus/tab keyboard behavior, network-status UI, predictable view activation/tabs |
| `scripts/02-food.js` | bars, meals, food logging, keyboard-operable food/recent result buttons, clear manual-entry validation, shared deletion Undo, offline local-search/barcode/scanner fast-fail |
| `scripts/03-train.js` | training sessions, durable saved-exercise drafts with Resume/Discard, compact current-program identity and confirmed replacement, exercise-level Save/Completed/Edit integrity, named dynamic workout/program-builder controls, protected session-type changes, clear validation, conservative auto-progression, aligned mobile set controls and touch targets |
| `scripts/04-weight.js` | weight chart, weigh-in/saved-meal Undo, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, consolidated manual rest timer with duration chooser, share |
| `scripts/05-ai.js` | USDA/barcode lookups, usual-meal, schedule UI, kudos, offline direct-AI fast-fail, confirmed AI/pasted program replacement, measurement Undo, coach chat, check-in, handoff food flow with first-item review positioning, AI report, analytics |
| `scripts/06-settings.js` | setup wizard, FAQ, macro calculator, grouped settings, normal/partial/raw exports, restore, recovery status and quarantine cleanup with automatic disclosure when attention is needed |
| `scripts/07-boot.js` | dash, Easter egg, protected/recovery panel orchestration, network-status initialization, approved update toast, boot |
| `data-quotes.js` | QUOTES vault — classic script, loads before the app slices, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/PHASE2-PROOF.md` | Permanent historical record of the Phase 2 byte-identity proof |
| `tests/` | Permanent gauntlet — 398 automated checks (105 unit + 293 integration), reproducible jsdom lockfile, and `bella-reference.b64` (frozen memorial byte truth; never edited). Not precached |
| `.github/workflows/tests.yml` | Runs the gauntlet on every push |
| `DATA-MODEL.md` | Primary storage schema, recovery-record contracts, and migration history |

## index.html section map (JS, in execution order)

storage keys & defaults → migrations/recovery vault → pure helpers → state → tabs → bars →
FOOD (meals, logging, USDA/OFF/barcode, usual-meal, kudos, schedule UI) →
*(QUOTES / LOCAL_DB / ALT_MAP / FAQ live in the data-*.js files, loaded first)* →
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

## Storage safety conventions (v45–v46)

- `schemaVersion` versions the complete primary state (`forge:cfg`, `forge:data`,
  `forge:program`) and is physically stored in `forge:cfg`; current primary schema = 2. v56 adds `forge:data.activeWorkoutDraft` so completed exercises survive reload before session finalization.
- Boot preserves the original primary strings and runs parse → numbered migration → tolerant
  validation → serialization on copies in pure `prepareState()`, then commits separately.
- Present unparseable/invalid/newer primary data enters protected mode before disclaimer/setup.
  Save routines restore the protected in-memory snapshot and perform no normal write.
- Normal restore uses the same preparation pipeline. Bad/newer backups are refused without
  poisoning a healthy app; absent envelope members leave that device area untouched.
- v46 maintains one validated device-only LKG at `forge:lkg`. It refreshes only from
  successfully persisted, fully prepared primary state; it never snapshots unsaved memory.
- Before any protected recovery overwrites primary storage, exact originals are written to
  `forge:quarantine` and read back byte-for-byte. Recovery succeeds only after primary
  read-back equality and a second `prepareState()` validation.
- LKG/quarantine use strict `recoveryFormatVersion:1`, separate from primary schemaVersion.
  Newer recovery records are never consumed, deleted, or overwritten by an older app.
- localStorage is not transactional. Primary commit skips unchanged keys, writes settings
  last, and attempts rollback. Quarantine-first ordering and post-write verification bound
  risk but do not claim true atomicity.

## Testing conventions

- Run with `bash tests/run-tests.sh` — it does `npm ci` against the committed lockfile,
  then runs both suites. Test tooling only; the app still has zero runtime dependencies.
- Harness (`tests/harness.js`) boots the **shipped** app in jsdom and inlines local scripts/
  styles. It records `setItem`, `removeItem`, and `clear` calls across all five BlackPyre keys.
- Memorial integrity is enforced byte-for-byte against `tests/bella-reference.b64`, with
  an exact embed count of 1. The reference file never changes.
- Unit suite: pure math/parsers, schema preparation including 1→2 draft migration/validation, strict recovery-record parsing,
  structured diagnostics, candidate summaries, and version-separation rules.
- Integration suite: all historic app flows plus protected zero-write behavior, mutation
  re-sync, interrupted commits, LKG create/refresh/failure/quota rules, area diagnosis,
  all three recovery sources, quarantine ordering/retention/export/deletion, legacy fallback,
  API-key boundaries, read-back failure, durable workout-draft save/resume/discard/failure behavior, exercise-level workout saving, protected session-type changes, routine-deletion Undo, manual-food validation, confirmed program replacement, offline network fast-fail, conservative progression, compact program identity/separate management, consolidated Train-only rest duration/control dock, Home/Settings disclosure hierarchy, offline status transitions, practical compact-control touch targets, predictable tab/session positioning, 16px editable controls, complete control naming, semantic/keyboard bottom tabs, keyboard food results, dialog focus entry/return, dynamic onboarding/workout/builder accessibility, handoff paste/log and first-item review positioning, update toast, and Easter egg timing.
- The permanent suite is **398 automated checks** and only grows. New features add tests in
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
---

# DATA-MODEL.md (verbatim from repo)

# BlackPyre Data Model

**Current as of v57 (July 2026). Primary schemaVersion: 2. Recovery format: 1.**

## Storage keys

BlackPyre has three permanent **primary user-state keys**:

| Key | Contents |
|---|---|
| `forge:cfg` | Configuration and targets (object) |
| `forge:data` | All logged data (object) |
| `forge:program` | Loaded training program (object) |

v46 adds two permanent **internal, device-only recovery keys**:

| Key | Contents |
|---|---|
| `forge:lkg` | One rolling, validated last-known-good whole-state snapshot |
| `forge:quarantine` | One exact pre-recovery copy of unsafe primary strings plus diagnosis |

All five names are load-bearing once shipped and must not be renamed casually. The `forge:`
prefix predates the BlackPyre rebrand and is intentionally preserved. The legacy read-only
fallback `ryan-cut:data` may supply logs when `forge:data` is missing; BlackPyre never renames,
removes, or modifies that legacy key.

## Whole-state schemaVersion

`schemaVersion` is physically stored in `forge:cfg`, but versions the complete **primary**
state and normal backup envelope: settings, logged data, and program.

| Raw value | Meaning / behavior in v57 |
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

`forge:lkg` and `forge:quarantine` are not primary state and do not use `schemaVersion`.
They carry strict `recoveryFormatVersion: 1`.

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
| `aiProvider` | string | `anthropic` \| `openai` \| `handoff` | |
| `aiModelAnth` / `aiModelOai` | string | Optional model overrides | |
| `lastCoachDate` | string date | Last weekly coach check-in | |

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

## forge:lkg

Current record shape:

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
- Protected mode, failed primary save, or invalid persisted state cannot refresh it.
- LKG failure never turns a successful primary save into a failure. The old record is
  restored best-effort if replacement/read-back fails, and Settings reports unavailable.
- If a primary save fails specifically for quota, current-format LKG may be sacrificed and
  that live save retried once. Quarantine and newer recovery records are never sacrificed.
- It is device-only and may contain AI keys. Normal and readable exports still remove them.

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
`cfg.schemaVersion`. `forge:lkg` and `forge:quarantine` are never included.
`anthropicKey` and `openaiKey` are stripped.

Normal restore uses the shared `prepareState()` path. Device AI fields
(`anthropicKey`, `openaiKey`, `aiProvider`, `aiModelAnth`, `aiModelOai`) survive unless the
backup explicitly contains that field. An absent envelope member leaves the corresponding
device area untouched. Bad/invalid/newer backups and recovery records are refused without
placing a healthy app into protected mode.

## Protected recovery and exports

For corruption/validation failures, recovery appears before disclaimer/onboarding. Newer
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

Old backups from any era must continue restoring correctly; the permanent suite proves the
range-era path.

## AI response contracts

The coach may embed JSON blocks: `{"bpTargets":{calTarget,proTarget,carbGoal,fatGoal}}`
(legacy ranges tolerated via averaging) for an **Apply targets** action; a `program` object
for **Load**; and food estimates `{"foods":[{name,cal,pro,carb,fat}]}` with all four macros.
Parsing normalizes smart quotes, fences, and zero-width junk. Raw AI responses are never persisted.
