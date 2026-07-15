# BLACKPYRE HANDOFF — current as of v47 (July 2026)

You are a collaborator on BlackPyre, a fitness PWA at
`ryanlifts.github.io/Forge/` (repo: `ryanlifts/Forge`). This repository represents **v47**,
a focused Phase 4 usability release built on the completed v46 hardening foundation.
Confirm the GitHub Pages deployment/cache before calling it live on a user's device.

The two documents reproduced below (`ARCHITECTURE.md` and `DATA-MODEL.md`) live in the repo
root, are binding, and are current as of v47. Read them before proposing or writing code.

## Current state

1. The permanent `/tests` gauntlet has **267 checks: 95 unit + 172 integration**. It boots
   the shipped app in jsdom; GitHub Actions runs it on every push. Tests are cumulative and
   are never deleted or weakened to make a release pass.
2. `tests/bella-reference.b64` is the frozen memorial byte truth. The suite enforces exact
   byte identity and embed count 1. Never regenerate, re-render, edit, or replace it.
3. App structure remains markup/styles in `index.html`, three static data scripts, then
   `scripts/01-storage.js` through `scripts/07-boot.js` in strict load order. Classic scripts,
   shared global scope, no ES modules, no build step — permanent.
4. Primary state remains in `forge:cfg`, `forge:data`, `forge:program`, with whole-state
   `schemaVersion:1`. Internal device-only `forge:lkg` and `forge:quarantine` remain on
   strict `recoveryFormatVersion:1`; v47 changes no storage shape or migration behavior.
5. v47 changes two user-facing behaviors only: auto-progression now requires at least the
   programmed set count and the top of a rep range at one positive weight; ChatGPT handoff
   paste/review uses 16px text, keeps the log action accessible, and returns to the top ready
   for another entry after logging.
6. The approved v44 update toast and v45-v46 storage/recovery systems remain unchanged.
   The service-worker cache for this release is `blackpyre-v47`.

## Five-phase plan status

- **Phase 0 — DONE:** permanent tests, GitHub Actions gate, architecture/data documentation.
- **Phase 1 — DONE (v42):** Bella mask deduplicated in-file, byte-identical; quotes, foods,
  ALT_MAP, and FAQ extracted to classic data scripts.
- **Phase 2 — DONE (v43):** JavaScript split into seven classic scripts in original order;
  byte-identity proof preserved in `tests/PHASE2-PROOF.md`.
- **Phase 3 — DONE:**
  - **v44:** first-install-safe update toast.
  - **v45:** formal schemaVersion, safe migration preparation/commit, protected mode.
  - **v46:** validated LKG, quarantine, diagnosis, and controlled recovery.
- **Phase 4 — IN PROGRESS:**
  - **v47:** focused fixes for workout auto-progression and ChatGPT handoff food logging.
  - The broader friction/usability review remains open. Do not begin another release without
    Ryan's explicit approval.

## Workflow constraints

Ryan deploys from GitHub's web UI, sometimes from a phone. Prefer whole-file/repo-mirror and
changed-files ZIP deliverables rather than pasted patches. One commit per release; wait for
the green check; then use the existing update toast or close/reopen as directed. Every
release gets a plain-language report and stops for approval.

---
---

# ARCHITECTURE.md (verbatim from repo)

# BlackPyre Architecture

**Current as of v47 (July 2026).**

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
| `index.html` | Markup + styles only (~156 KB in v47); loads the data files then the 7 app slices; includes protected/recovery UI |
| `scripts/01-storage.js` | primary/recovery keys, defaults, pure prepare-state migration pipeline, commit/rollback, LKG lifecycle, structured diagnosis, quarantine transaction, protected-mode guards, state, tabs |
| `scripts/02-food.js` | bars, meals, food logging |
| `scripts/03-train.js` | training sessions, programs, conservative set-count/top-of-range auto-progression |
| `scripts/04-weight.js` | weight chart, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, share |
| `scripts/05-ai.js` | USDA/barcode lookups, usual-meal, schedule UI, kudos, AI engine, coach chat, check-in, handoff food flow, AI report, analytics |
| `scripts/06-settings.js` | setup wizard, FAQ, macro calculator, settings, normal/partial/raw exports, restore, recovery status and quarantine cleanup |
| `scripts/07-boot.js` | dash, Easter egg, protected/recovery panel orchestration, approved update toast, boot |
| `data-quotes.js` | QUOTES vault — classic script, loads before the app slices, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/PHASE2-PROOF.md` | Permanent historical record of the Phase 2 byte-identity proof |
| `tests/` | Permanent gauntlet — 267 automated checks (95 unit + 172 integration), reproducible jsdom lockfile, and `bella-reference.b64` (frozen memorial byte truth; never edited). Not precached |
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
  `forge:program`) and is physically stored in `forge:cfg`; current primary schema = 1.
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
- Unit suite: pure math/parsers, schema preparation, strict recovery-record parsing,
  structured diagnostics, candidate summaries, and version-separation rules.
- Integration suite: all historic app flows plus protected zero-write behavior, mutation
  re-sync, interrupted commits, LKG create/refresh/failure/quota rules, area diagnosis,
  all three recovery sources, quarantine ordering/retention/export/deletion, legacy fallback,
  API-key boundaries, read-back failure, conservative workout progression, handoff paste/log
  positioning, update toast, and Easter egg timing.
- The permanent suite is **267 automated checks** and only grows. New features add tests in
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

**Current as of v47 (July 2026). Primary schemaVersion: 1. Recovery format: 1.**

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

| Raw value | Meaning / behavior in v47 |
|---|---|
| property absent or integer `0` | Pre-versioning legacy state; run numbered migrations from step 0 |
| integer `1` | Current primary schema; no migration step |
| integer greater than `1` | Newer primary data; protected boot / refused restore; no downgrade path |
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
| `schemaVersion` | integer | Generation of complete primary state | Current = `1`; strict interpretation above |
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
| `workouts` | `[{date,day,title,sets:{ex:[{w,r}]},notes}]` | Legacy string sets still parse |
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

Old backups from any era must continue restoring correctly; the permanent suite proves the
range-era path.

## AI response contracts

The coach may embed JSON blocks: `{"bpTargets":{calTarget,proTarget,carbGoal,fatGoal}}`
(legacy ranges tolerated via averaging) for an **Apply targets** action; a `program` object
for **Load**; and food estimates `{"foods":[{name,cal,pro,carb,fat}]}` with all four macros.
Parsing normalizes smart quotes, fences, and zero-width junk. Raw AI responses are never persisted.
