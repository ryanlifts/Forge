# BlackPyre Architecture

**Current as of v46 (July 2026).**

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
| `index.html` | Markup + styles only (~156 KB in v46); loads the data files then the 7 app slices; includes protected/recovery UI |
| `scripts/01-storage.js` | primary/recovery keys, defaults, pure prepare-state migration pipeline, commit/rollback, LKG lifecycle, structured diagnosis, quarantine transaction, protected-mode guards, state, tabs |
| `scripts/02-food.js` | bars, meals, food logging |
| `scripts/03-train.js` | training sessions, programs |
| `scripts/04-weight.js` | weight chart, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, share |
| `scripts/05-ai.js` | USDA/barcode lookups, usual-meal, schedule UI, kudos, AI engine, coach chat, check-in, handoff, AI report, analytics |
| `scripts/06-settings.js` | setup wizard, FAQ, macro calculator, settings, normal/partial/raw exports, restore, recovery status and quarantine cleanup |
| `scripts/07-boot.js` | dash, Easter egg, protected/recovery panel orchestration, approved update toast, boot |
| `data-quotes.js` | QUOTES vault — classic script, loads before the app slices, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/PHASE2-PROOF.md` | Permanent historical record of the Phase 2 byte-identity proof |
| `tests/` | Permanent gauntlet — 253 automated checks (87 unit + 166 integration), reproducible jsdom lockfile, and `bella-reference.b64` (frozen memorial byte truth; never edited). Not precached |
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
  API-key boundaries, read-back failure, update toast, and Easter egg timing.
- The permanent suite is **253 automated checks** and only grows. New features add tests in
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
