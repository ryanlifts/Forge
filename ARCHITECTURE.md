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
