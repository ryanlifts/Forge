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
| v66 | No primary schema migration | Adds `cfg.autoProgressionOn` (fresh-install default `false`; missing legacy values migrate to `true`) so automatic progression can be disabled; assisted exercise names reduce assistance by 5 lb when progression is enabled |

Old backups from any era must continue restoring correctly; the permanent suite proves the
range-era path.

## AI response contracts

The coach may embed JSON blocks: `{"bpTargets":{calTarget,proTarget,carbGoal,fatGoal}}`
(legacy ranges tolerated via averaging) for an **Apply targets** action; a `program` object
for **Load**; and food estimates `{"foods":[{name,cal,pro,carb,fat}]}` with all four macros.
Parsing normalizes smart quotes, fences, and zero-width junk. Raw AI responses are never persisted.


### Training progression setting
`cfg.autoProgressionOn` is a boolean stored with normal settings. A fresh install starts at `false`; a pre-v66 settings record missing the field migrates to `true`; explicit `true` or `false` choices are preserved.
