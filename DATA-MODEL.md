# BlackPyre Data Model

**Current as of v45 (July 2026). Current schemaVersion: 1.**

Everything BlackPyre stores lives in three localStorage keys on the user's device.
**These key names are load-bearing and must never be renamed** (installed apps hold user data under them):

| Key | Contents |
|---|---|
| `forge:cfg` | Configuration & targets (object) |
| `forge:data` | All logged data (object) |
| `forge:program` | The loaded training program (object) |

The `forge:` prefix predates the BlackPyre rebrand and is intentionally preserved (invariant I-2).

## Whole-state schemaVersion

`schemaVersion` is physically stored in `forge:cfg`, but it versions the complete stored
state — settings, logged data, program, and the backup envelope that carries them.

| Raw value | Meaning / behavior in v45 |
|---|---|
| property absent or integer `0` | Pre-versioning legacy state; run numbered migrations from step 0 |
| integer `1` | Current schema; no migration write |
| integer greater than `1` | Newer BlackPyre data; protected mode on boot, refused on restore |
| anything else | Invalid; protected mode on boot, refused on restore |

The version is read from the raw parsed settings before `DEFAULT_CFG` is merged. A migration
stamps its destination version only after that complete step succeeds. `DEFAULT_CFG` does
not contain `schemaVersion`, so defaults can never disguise legacy data as current.

---

## forge:cfg

Merged over `DEFAULT_CFG` at boot. `0` means "unset" for personal fields — the app must never
treat unset values as real numbers (see Migration History).

| Field | Type | Meaning | Notes |
|---|---|---|---|
| `schemaVersion` | integer | Generation of the complete stored state | Current = `1`; strict interpretation above |
| `setupDone` | bool | Onboarding wizard completed or skipped | |
| `disclaimerAccepted` | string date | Date the disclaimer gate was accepted | Gate blocks app until set |
| `startWt` | number | Starting bodyweight (lb) for the journey | 0 = unset. Set by wizard (current weight) or Settings. First contrary weigh-in may rebase it |
| `goalWt` | number | Goal bodyweight (lb) | 0 = unset. Journey/chart/goal-line hidden until both weights > 0 |
| `calTarget` | number | **Exact** daily calorie target (max on a cut) | 0 = unset → bars replaced by guidance, schedule disabled |
| `proTarget` | number | Exact daily protein goal (g) | Never shown red for exceeding |
| `carbGoal` / `fatGoal` | number | Exact daily carb / fat targets (g) | |
| `calSchedMode` | string | `same` \| `frisat` \| `satsun` \| `frisatsun` \| `custom` | Presets **derive live** from `calTarget` — never stored as arrays |
| `calSchedDays` | number[7] \| null | Sun→Sat daily calories, **custom mode only** | Custom weekly total may be under, never over, `calTarget×7` |
| `accent` | string | Theme accent key | Default `gold`; invalid values heal to gold |
| `calcInputs` | object | Last calculator inputs `{sex,age,ft,inches,act,goal}` | Convenience prefill only |
| `splitState` | object | Macro split `{mode:"rec"\|"preset"\|"custom", p,c,f}` | Percentages when not "rec" |
| `lastTargetWt` | number | Bodyweight when targets were last (re)calculated | Drives the TDEE re-adjust prompt |
| `adjustPromptedAt` | number/date | Last time the re-adjust prompt was shown | Prevents nagging |
| `liftGoals` | object | `{ [exerciseName]: goal e1RM lb }` | |
| `restSec` / `customRestSec` / `customRests` | number / number / number[] | Rest-timer defaults and custom preset choices | |
| `measureOn` / `waterOn` | bool | Optional feature toggles (measurements, water) | Set in wizard or Settings |
| `usdaKey` | string | Personal USDA API key | Overrides the embedded shared key |
| `anthropicKey` / `openaiKey` | string | BYOK AI keys | **Excluded from backups**; restore preserves the device's current values |
| `aiProvider` | string | `anthropic` \| `openai` \| `handoff` | `handoff` = no key, copy/paste with ChatGPT |
| `aiModelAnth` / `aiModelOai` | string | Optional per-provider model overrides | |
| `lastCoachDate` | string date | Last weekly coach check-in | Card reappears after 7 days |

## forge:data

| Field | Shape | Meaning |
|---|---|---|
| `food` | `{ "YYYY-MM-DD": [entry] }` | `entry = {name, cal, pro, carb, fat, meal}`; `meal ∈ breakfast/lunch/dinner/snacks/other` |
| `workouts` | `[{date, day, title, sets:{ex:[{w,r}]}, notes}]` | Set rows are structured; legacy string sets (`"275x5"`) still parse |
| `weights` | `[{date, lbs}]` | One per date; drives chart, TDEE, projections |
| `measure` | `[{date, waist, chest, arm}]` | Optional; one per date |
| `water` | `{ "YYYY-MM-DD": count }` | Optional |
| `finished` | `{ "YYYY-MM-DD": true }` | Finish-day flags. **Never count toward the streak by themselves** |
| `myFoods` | `{ [barcode]: {name, brand, cal100, pro100, carb100, fat100, servingG?, servingLabel?} }` | Personal barcode library — checked **before** any network lookup |
| `recents` | `[item]` (max 20) | Recently logged foods for quick re-log |
| `foodCounts` | `{ [foodKey]: n }` | Frequency counts feeding the "usual meal" detector |
| `mealCounts` | `{ [meal]: { [foodKey]: n } }` | Per-meal frequency for the same detector |
| `meals` | object | Saved meal combos |
| `meta` | `{lastBackup, logsSince}` | Backup reminder bookkeeping |

## forge:program

`{name, author, days:[{id, label, exercises:[{name, sets, reps, ...}]}]}` — loadable from any
JSON file or pasted from any AI; the coach can propose one via a ```json block containing
`program`. Fallback filename on export: `blackpyre-program`.

## Backup envelope

`{cfg, data, program}` as JSON. The envelope's generation is announced by
`cfg.schemaVersion`. **`anthropicKey`, `openaiKey` are stripped on normal export.**

Restore uses the same `prepareState()` pipeline as boot. Presence is tested before defaults
merge: device AI settings (`anthropicKey`, `openaiKey`, `aiProvider`, `aiModelAnth`,
`aiModelOai`) survive unless the backup explicitly contains that field. An envelope member
that is absent leaves the device's corresponding area completely untouched; a present member
replaces that area only after the whole supplied state prepares successfully. Bad, invalid,
or newer-version backups are refused with zero writes and do not place a healthy app in
protected mode.

In protected mode, normal backup is replaced by an explicitly confirmed partial export named
`blackpyre-PARTIAL-YYYY-MM-DD.json`. It contains only the readable in-memory snapshot, may be
incomplete, and does not update backup bookkeeping.

## Migration history (order matters)

| When | What | How |
|---|---|---|
| v25 | FORGE → BlackPyre rebrand | Storage keys intentionally unchanged |
| v34 | Range targets → exact | `calLo/calHi → calTarget` (midpoint), `proLo/proHi → proTarget`, via `migrateTargets(raw)` — **must run on the raw object before the `DEFAULT_CFG` merge**, or defaults mask real values |
| v35 | `calSchedMode:"weekend"` → `"frisat"` | In `migrateCfg()` |
| v36+ | Fake defaults removed | Personal fields default to 0/unset; every consumer guards (`nutritionTargetsReady()`, goal-weight checks) |
| v45 | Formal whole-state schema version 0 → 1 | Pure prepare pipeline wraps the existing target/config migrations, validates and serializes copies, then stamps `schemaVersion:1`; boot failures preserve storage in protected mode |

Old backups from any era must restore correctly; the integration suite proves the range-era path.

## v45 protected migration behavior

Boot preserves the original three storage strings, prepares disposable copies, and commits
only after parse, migration, validation, and serialization all succeed. Pre-commit failure
performs zero writes. Protected mode suppresses disclaimer/onboarding, blocks restore, and
guards `save()`, `saveCfg()`, and `saveProgram()`; a blocked mutation is restored from the
frozen session snapshot and rerendered so it does not appear saved.

localStorage cannot atomically transact three keys. Commit therefore skips byte-identical
keys, writes data/program before the schema-stamped settings, and attempts rollback to the
original strings if a write throws. This is best-effort, not a claim of true atomicity.

## AI response contracts

The coach may embed ```json blocks: `{"bpTargets":{calTarget, proTarget, carbGoal, fatGoal}}`
(legacy `calLo/calHi/proLo/proHi` tolerated via averaging) renders an **Apply targets** button;
a `program` object renders a **Load** button. Food estimates: `{"foods":[{name, cal, pro, carb, fat}]}` —
all four macros required per entry; parsing normalizes smart quotes, fences, and zero-width junk.
Raw AI responses are never persisted.
