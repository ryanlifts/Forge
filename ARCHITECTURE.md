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
| `index.html` | Markup + styles only (~147 KB after Phase 2); loads the data files then the 7 app slices |
| `scripts/01-storage.js` | storage keys & defaults, migrations, pure helpers, state, tabs |
| `scripts/02-food.js` | bars, meals, food logging |
| `scripts/03-train.js` | training sessions, programs |
| `scripts/04-weight.js` | weight chart, motivation render, e1RM/PR engine, TDEE, streak, finish day, plate math, share |
| `scripts/05-ai.js` | USDA/barcode lookups, usual-meal, schedule UI, kudos, AI engine, coach chat, check-in, handoff, AI report, analytics |
| `scripts/06-settings.js` | setup wizard, FAQ render, macro calculator, settings |
| `scripts/07-boot.js` | dash, Easter egg, boot |
| `data-quotes.js` | QUOTES vault — classic script, loads before the main script, shares global scope |
| `data-foods.js` | LOCAL_DB food database + ALT_MAP exercise swaps — classic script |
| `data-faq.js` | FAQ content — classic script |
| `sw.js` | Offline shell (cache-first), OFF API network-only, cache name = release version |
| `manifest.json` | PWA identity — name/short_name **BlackPyre** |
| `icon-*.png`, `apple-touch-icon.png` | Gold dumbbell icons |
| `tests/` | Permanent gauntlet — 112 automated checks (62 unit + 50 integration) plus `package.json`/`package-lock.json` pinning jsdom for reproducible runs, and `bella-reference.b64` (frozen byte truth of the memorial image — never edited). Not precached |
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
**in the original order**. Migration proof: strip the strict-mode directives added to
slices 02–07 (01's is original), concatenate in order, and the result equals the v42
inline JS exactly — 189,847 characters, 190,324 UTF-8 bytes, sha256 63ea5e9b… . This is
enforced as a permanent suite check that must be consciously retired in the first
approved post-v43 commit that legitimately changes a slice. Slice names describe their *dominant* content; exact contents are in
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
  streak, migrations, AI-reply parsing, bar thresholds, dates).
- Integration suite: fresh-user boot, ID resolution/duplication, no-fake-values sweep,
  logging/kudos/finish-day, settings/schedule flows, barcode fallback matrix,
  backup→restore→migration round-trip, handoff paste flow, Easter egg timing.
- The permanent suite is **112 automated checks** and only grows. When adding a feature: add
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
