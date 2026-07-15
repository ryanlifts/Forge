# BLACKPYRE HANDOFF — current as of v45 (July 2026)

You are a collaborator on BlackPyre, a fitness PWA at
ryanlifts.github.io/Forge/ (repo: ryanlifts/Forge). Live version: v45
(Phase 3 release 2 of 3 complete).

The two documents included below (ARCHITECTURE.md and DATA-MODEL.md) live in the
repo root, are binding, and are current as of v45. Read them before proposing or
writing code.

## Current state

1. A permanent test suite lives in /tests: 170 automated checks (72 unit,
   98 integration) that boot the real shipped app in jsdom. GitHub Actions
   runs it on every push — a green check means "tests passed."
   Tests are cumulative: new features add checks in the same release;
   existing checks are never deleted or weakened.
2. tests/bella-reference.b64 is the frozen byte truth of the memorial image.
   The suite enforces byte-identity and an exact embed count of 1. Never
   regenerate, re-render, or edit this file or the embedded image.
3. App structure: index.html (markup+styles) loads three data payloads then
   seven app slices (scripts/01-storage.js … scripts/07-boot.js) in strict
   order. All are classic scripts sharing one global scope. No ES modules,
   no build step — permanent.
4. Stored state uses the permanent keys forge:cfg, forge:data, forge:program.
   v45 establishes whole-state schemaVersion 1, a pure prepare pipeline,
   protected read-only boot behavior, strict newer-version protection, and
   one shared boot/restore migration path.

## Restructuring plan status

- Phase 0 (DONE): permanent test suite, CI gate, architecture/data documents.
- Phase 1 (DONE, v42): Bella mask deduped byte-identically; QUOTES,
  LOCAL_DB/ALT_MAP, and FAQ extracted to data files.
- Phase 2 (DONE, v43): main JS sliced into scripts/01–07 in original order.
  The migration was proven byte-identical; the historical proof is preserved
  in tests/PHASE2-PROOF.md.
- Phase 3 (IN PROGRESS, three independently approved releases):
  - v44 (DONE): first-install-safe update toast, once-per-session display,
    exactly-once reload, session-only dismissal.
  - v45 (DONE): formal whole-state schemaVersion 1; parse/migrate/validate/
    serialize rehearsal on copies; separate commit with unchanged-key skips,
    settings-last ordering, and best-effort rollback; protected mode on boot
    failure/newer data; save-path snapshot re-sync; restore through the same
    pipeline; bad/newer backups refused without poisoning a healthy app;
    partial-envelope and protected partial-export rules; 48 new permanent
    checks (122 → 170).
  - v46 (NEXT, NOT STARTED): quarantine + last-known-good recovery. A revised
    plan must be presented and explicitly approved before any implementation.
- Phase 4: usability review.

Every release passes the full gauntlet, receives a plain-language report, and
STOPS for Ryan's approval. Do not begin v46 without explicit approval.

## Workflow constraints

Ryan deploys from GitHub's web UI, sometimes from a phone. Prefer whole-file
or repo-mirror deliverables over large pasted patches. One commit per release;
wait for the green check; then use the v44 toast or close/reopen the installed
app as directed. The service-worker cache name bumps every release.

---
---

# ARCHITECTURE.md (verbatim from repo)

# BlackPyre Architecture

**Current as of v45 (July 2026).**

A single-page PWA: vanilla HTML/CSS/JS, no framework, no build step, localStorage only.
Deployed on GitHub Pages. Developed AI-assisted (Claude / ChatGPT) from a phone — every rule
below exists to keep that workflow safe.

## Invariants — do not violate, ever

1. **Repo name and URL never change** — installed PWAs break.
2. **localStorage keys `forge:data`, `forge:cfg`, `forge:program` never renamed** — see DATA-MODEL.md.
3. **No build step.** Files are edited as plain text and deployed as-is. Classic scripts only — **no ES modules** (the codebase uses one shared global scope by design).
4. **Service-worker cache name bumps every release** (`blackpyre-vNN` in sw.js). No bump = users never get the update.
5. **Deploy ritual:** all changed files in **one commit** → wait for the green check (now: tests passed) → close and reopen the installed app twice.
6. **Every release passes the gauntlet first:** `bash tests/run-tests.sh`. No green, no ship.
7. **Intentional brand language is whitelisted** ("Forge your body", "Session Forged", "Day Forged", "PR FORGED", forge-as-verb in quotes). Everything else says BlackPyre.
8. **The Easter egg is a memorial.** The handwriting image is embedded byte-for-byte and is never re-rendered, traced, or substituted with a font. Treat that CSS block and its data as read-only.
9. **Privacy rules:** API keys never leave the device except to their own provider and are excluded from backups; food photos live in memory only; raw AI responses are parsed then discarded; nothing logs without user confirmation.

## Files

| File | Role |
|---|---|
| `index.html` | Markup + styles only (~147 KB after Phase 2); loads the data files then the 7 app slices |
| `scripts/01-storage.js` | storage keys/defaults, pure prepare-state migration pipeline, commit/rollback, protected-mode guards, state, tabs |
| `scripts/02-food.js` | bars, meals, food logging |
| `scripts/03-train.js` | training sessions, programs |
| `scripts/04-weight.js` | weight chart, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, share |
| `scripts/05-ai.js` | USDA/barcode lookups, usual-meal, schedule UI, kudos, AI engine, coach chat, check-in, handoff, AI report, analytics |
| `scripts/06-settings.js` | setup wizard, FAQ, macro calculator, settings, backup/export and shared-pipeline restore |
| `scripts/07-boot.js` | dash, Easter egg, protected-mode banner, update toast, boot |
| `data-quotes.js` | QUOTES vault — classic script, loads before the main script, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/PHASE2-PROOF.md` | Permanent historical record of the Phase 2 byte-identity proof |
| `tests/` | Permanent gauntlet — 170 automated checks (72 unit + 98 integration) plus `package.json`/`package-lock.json` pinning jsdom for reproducible runs, and `bella-reference.b64` (frozen byte truth of the memorial image — never edited). Not precached |
| `.github/workflows/tests.yml` | Runs the gauntlet on every push |
| `DATA-MODEL.md` | Storage schema + migration history |

## index.html section map (JS, in execution order)

storage keys & defaults → migrations → pure helpers → state → tabs → bars →
FOOD (meals, logging, USDA/OFF/barcode, usual-meal, kudos, schedule UI) →
*(QUOTES / LOCAL_DB / ALT_MAP / FAQ now live in the data-*.js files, loaded first)* →
TRAIN (sessions, e1RM/PR engine, plate math, rest timer, programs/share) →
WEIGHT (chart, measurements, adaptive TDEE, projections) →
streak → finish day → AI ENGINE (BYOK, multi-provider) →
coach chat → weekly check-in → handoff mode → AI report → analytics →
setup wizard → FAQ → macro calculator → settings → dash → easter egg → boot.

Section headers look like `// ================== NAME ==================` — keep them.
The Phase-2 slicing cut the original inline JS at these markers into scripts/01–07
**in the original order**. The migration was proven byte-identical to the v42 inline JS
(sha256 63ea5e9b…, 190,324 UTF-8 bytes / 189,847 characters); the live hash check was
retired in v44 — the first release to intentionally edit a slice — and the complete proof
and method are preserved permanently in tests/PHASE2-PROOF.md. Lasting structural
invariants (script order, strict mode, tag attributes, slice opening markers) remain
enforced by the suite; they verify different, permanent properties, while the hash
verified the historical migration. Slice names describe their *dominant* content; exact contents are in
the file table above — 04 and 05 intentionally contain some food/progress sections that
sat between markers in the original order, because Phase 2 never reorders code.

Slice rules from here on:
- The slices are the source of truth and are edited directly. Execution order is
  01 → 07 and is load-bearing; never reorder the `<script src>` tags in index.html.
- Classic scripts, shared global scope — but each file is a SEPARATE parsing and
  evaluation unit (strict-mode directives, hoisting, and directive prologues are
  per-file). Declarations and slice boundaries must remain unchanged unless a future
  approved plan specifically covers them. Every local classic script begins with
  `"use strict";` — enforced by the suite.
- New sections go into whichever slice their document position falls in; if a slice
  grows unwieldy, splitting it further is a plan-level decision, not a drive-by.

## Storage safety conventions (v45)

- `schemaVersion` versions the complete stored state (`forge:cfg`, `forge:data`, and
  `forge:program`) and is physically stored in `forge:cfg`; current schema = 1.
- Boot reads the original three strings, runs parse → numbered migration → tolerant
  validation → serialization on copies in pure `prepareState()`, then commits separately.
- Present unparseable/invalid/newer data enters protected mode before disclaimer/setup.
  All three save routines restore the protected in-memory snapshot and perform no write.
- Restore uses the same preparation pipeline. Bad/newer backups are refused without
  changing the healthy running app; absent envelope members leave that device area untouched.
- localStorage is not transactional. Commit skips unchanged keys, writes settings last,
  and attempts rollback on failure; the suite proves the documented interrupted-commit path.

## Testing conventions

- Run with `bash tests/run-tests.sh` — it does `npm ci` against the committed lockfile
  (reproducible, no floating versions), then runs both suites. This is test tooling only;
  the app itself has zero dependencies and no build step.
- Harness (`tests/harness.js`) boots the **shipped** app in jsdom and inlines any local
  `<script src>` / stylesheet first, so the suite keeps working after the Phase-2 slicing.
  Inlining tolerates extra attributes in any order; the shipped app uses the plain
  canonical forms `<script src="NAME.js"></script>` and
  `<link rel="stylesheet" href="NAME.css">` with double quotes and repo-relative paths.
  External (http/https) URLs are never inlined.
- Memorial integrity is enforced by test: the embedded handwriting must match
  `tests/bella-reference.b64` byte-for-byte, with an exact embed count of 1 (a single CSS custom
  property serves both mask prefixes). The reference file never changes.
- Unit suite: pure math and parsers (Mifflin-St Jeor, Epley, schedule sums, macro scaling,
  streak, prepare-state/schema migrations, AI-reply parsing, bar thresholds, dates).
- Integration suite: fresh-user boot, ID resolution/duplication, no-fake-values sweep,
  logging/kudos/finish-day, settings/schedule flows, barcode fallback matrix,
  backup→restore→migration round-trip, protected-mode zero-write matrix and mutation re-sync,
  interrupted-commit healing, handoff paste flow, Easter egg timing, update toast.
- The permanent suite is **170 automated checks** and only grows. When adding a feature: add
  its checks in the same release. Tests are cumulative, never recreated. (Historical note:
  before Phase 0, roughly 700 ad-hoc checks were written and discarded across v29–v41 —
  that figure describes the old throwaway process, not this suite.)
- jsdom quirks: stub `URL.createObjectURL`, ignore `scrollTo` warnings, `select()` runs via
  rAF (wait ≥50 ms), boot must pass the disclaimer + wizard for fresh-user tests.

## Editing rules for AI assistants

- Patch with exact-string anchors and **assert the anchor exists before writing**; if an
  assertion fails, re-read the file — another assistant may have edited nearby.
- Never splice by index ranges across section boundaries without diff-verifying what was removed.
- `node --check` the extracted JS after every edit; run the full gauntlet before packaging.
- Package = the changed files, one folder + zip; diff packaged against working copy before delivery.
- Do not rename IDs, storage fields, or functions as "cleanup" — every rename is a feature-sized change.

---
---

# DATA-MODEL.md (verbatim from repo)

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
