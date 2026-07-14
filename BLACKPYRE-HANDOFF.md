# BLACKPYRE HANDOFF — post-Phase 1 (July 2026)

You are a collaborator on BlackPyre, a fitness PWA at
ryanlifts.github.io/Forge/ (repo: ryanlifts/Forge). Live version: v42 (Phase 1 complete).

The two documents included below (ARCHITECTURE.md and DATA-MODEL.md) live in the
repo root, are binding, and are current. Read them before proposing or writing
any code.

## Current state

1. A permanent test suite lives in /tests: 104 automated checks (62 unit,
   42 integration) that boot the real shipped app in jsdom. GitHub Actions
   runs it on every push — a green check means "tests passed."
   Tests are cumulative: new features must add checks in the same release,
   and existing checks are never deleted or weakened.
2. tests/bella-reference.b64 is the frozen byte truth of the memorial
   image. The suite enforces byte-identity and an exact embed count (now 1).
   Never regenerate, re-render, or edit this file or the embedded image.
3. The app is no longer strictly single-file: index.html (~332 KB) plus three
   classic-script data payloads (data-quotes.js, data-foods.js, data-faq.js)
   that load before the main script and share the global scope. No ES modules,
   no build step — that is permanent.

## Restructuring plan status (five phases, each gated on Ryan's approval)

- Phase 0 (DONE): test suite + CI gate + documentation. Zero app changes.
- Phase 1 (DONE, shipped as v42): Bella's mask deduped via one CSS custom
  property (still embedded, byte-identical, count 2 -> 1); QUOTES / LOCAL_DB /
  ALT_MAP / FAQ extracted to the three data files; sw.js SHELL precaches them;
  index.html 482 KB -> 332 KB.
- Phase 2 (NEXT, not started): slice the main JS at existing section markers
  into ~7 numbered classic scripts IN CURRENT ORDER, proven by byte-identical
  concatenation. No ES modules. No reorganizing.
- Phase 3: hardening (storage quarantine, last-known-good, schemaVersion,
  update toast). Phase 4: usability review.

Every phase ships as its own version, passes the full gauntlet, ends with a
plain-language report, and STOPS for Ryan's approval. Do not start or continue
a phase without his explicit go.

## Workflow constraints (unchanged)

Ryan deploys from GitHub's web UI (sometimes phone — avoid asking him to paste
large machine-generated files), one commit per release, close/reopen the
installed app twice after deploying. SW cache name bumps every release.
Whole-file deliverables preferred. Run or reason through the gauntlet before
declaring anything safe.

---
---

# ARCHITECTURE.md (verbatim from repo)

# BlackPyre Architecture

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
| `index.html` | The app shell: markup, styles, logic (~332 KB after Phase 1; Phase 2 will slice the JS) |
| `data-quotes.js` | QUOTES vault — classic script, loads before the main script, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/` | Permanent gauntlet — 104 automated checks (62 unit + 42 integration) plus `package.json`/`package-lock.json` pinning jsdom for reproducible runs, and `bella-reference.b64` (frozen byte truth of the memorial image — never edited). Not precached |
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

Section headers look like `// ================== NAME ==================` — keep them; they are
the planned Phase-2 slice boundaries.

## Testing conventions

- Run with `bash tests/run-tests.sh` — it does `npm ci` against the committed lockfile
  (reproducible, no floating versions), then runs both suites. This is test tooling only;
  the app itself has zero dependencies and no build step.
- Harness (`tests/harness.js`) boots the **shipped** app in jsdom and inlines any local
  `<script src>` / stylesheet first, so the suite keeps working after the Phase-2 slicing.
  Inlining tolerates extra attributes in any order; Phase 2 should still prefer the plain
  canonical forms `<script src="NAME.js"></script>` and
  `<link rel="stylesheet" href="NAME.css">` with double quotes and repo-relative paths.
  External (http/https) URLs are never inlined.
- Memorial integrity is enforced by test: the embedded handwriting must match
  `tests/bella-reference.b64` byte-for-byte, with an exact embed count (2 today; 1 after the
  Phase-1 dedup — that count is the only permitted edit, the reference file never changes).
- Unit suite: pure math and parsers (Mifflin-St Jeor, Epley, schedule sums, macro scaling,
  streak, migrations, AI-reply parsing, bar thresholds, dates).
- Integration suite: fresh-user boot, ID resolution/duplication, no-fake-values sweep,
  logging/kudos/finish-day, settings/schedule flows, barcode fallback matrix,
  backup→restore→migration round-trip, handoff paste flow, Easter egg timing.
- The permanent suite is **104 automated checks** and only grows. When adding a feature: add
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

Everything BlackPyre stores lives in three localStorage keys on the user's device.
**These key names are load-bearing and must never be renamed** (installed apps hold user data under them):

| Key | Contents |
|---|---|
| `forge:cfg` | Configuration & targets (object) |
| `forge:data` | All logged data (object) |
| `forge:program` | The loaded training program (object) |

The `forge:` prefix predates the BlackPyre rebrand and is intentionally preserved (invariant I-2).

---

## forge:cfg

Merged over `DEFAULT_CFG` at boot. `0` means "unset" for personal fields — the app must never
treat unset values as real numbers (see Migration History).

| Field | Type | Meaning | Notes |
|---|---|---|---|
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
| `restSec` / `customRestSec` / `customRests` | number / number / object | Rest-timer defaults and per-exercise overrides | |
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

`{cfg, data, program}` as JSON. **`anthropicKey`, `openaiKey` are stripped on export.**
On restore: `migrateTargets(backup.cfg)` runs **before** the defaults merge; the device's current
AI settings (`anthropicKey, openaiKey, aiProvider, aiModelAnth, aiModelOai`) survive unless the
backup explicitly contains replacements.

## Migration history (order matters)

| When | What | How |
|---|---|---|
| v25 | FORGE → BlackPyre rebrand | Storage keys intentionally unchanged |
| v34 | Range targets → exact | `calLo/calHi → calTarget` (midpoint), `proLo/proHi → proTarget`, via `migrateTargets(raw)` — **must run on the raw object before the `DEFAULT_CFG` merge**, or defaults mask real values |
| v35 | `calSchedMode:"weekend"` → `"frisat"` | In `migrateCfg()` |
| v36+ | Fake defaults removed | Personal fields default to 0/unset; every consumer guards (`nutritionTargetsReady()`, goal-weight checks) |

Old backups from any era must restore correctly; the integration suite proves the range-era path.

## AI response contracts

The coach may embed ```json blocks: `{"bpTargets":{calTarget, proTarget, carbGoal, fatGoal}}`
(legacy `calLo/calHi/proLo/proHi` tolerated via averaging) renders an **Apply targets** button;
a `program` object renders a **Load** button. Food estimates: `{"foods":[{name, cal, pro, carb, fat}]}` —
all four macros required per entry; parsing normalizes smart quotes, fences, and zero-width junk.
Raw AI responses are never persisted.
