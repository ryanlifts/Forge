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
