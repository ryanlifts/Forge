# BlackPyre Data Model

**Current as of v46 (July 2026). Primary schemaVersion: 1. Recovery format: 1.**

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

| Raw value | Meaning / behavior in v46 |
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

Old backups from any era must continue restoring correctly; the permanent suite proves the
range-era path.

## AI response contracts

The coach may embed JSON blocks: `{"bpTargets":{calTarget,proTarget,carbGoal,fatGoal}}`
(legacy ranges tolerated via averaging) for an **Apply targets** action; a `program` object
for **Load**; and food estimates `{"foods":[{name,cal,pro,carb,fat}]}` with all four macros.
Parsing normalizes smart quotes, fences, and zero-width junk. Raw AI responses are never persisted.
