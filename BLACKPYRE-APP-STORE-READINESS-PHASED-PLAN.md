# BlackPyre iOS — Release Decision Record & Revised Phasing

**Version:** Revision 6.1, August 9, 2026
**Status: AUTHORITATIVE.** Commit this file to the native repository. Mark any earlier
plan (including the original six-phase plan) SUPERSEDED. This is the single shared
checklist; do not maintain a second copy.
**Supersedes:** the original TestFlight and App Store Readiness Plan
**Revision 6.1 verification:** preserves Revision 6's HealthKit decision while correcting
iOS backup exclusion, HealthKit read-authorization semantics, and reviewer-facing scope.
**Native:** `native-ios-main`, v101 at commit `28c20bd` · **Web:** `main`, v103

---

## Part A — Phase 0 decision record (APPROVED)

These decisions are made. Code work may begin. Anything not listed here is still open and
must not be decided inside an implementation thread.

### D-1. Direct AI provider access — REMOVED from native

**Decision:** Remove the direct OpenAI/Anthropic API path from the native iOS product.
Keep every copy/paste (handoff) workflow.

**What is removed:**
- API key entry fields for OpenAI and Anthropic
- Provider selection and model selection UI
- All direct calls to `api.openai.com` and `api.anthropic.com`
- Links to `platform.openai.com` and `console.anthropic.com`
- Storage and backup handling of `anthropicKey` / `openaiKey` on native

**What is kept — the AI coaching feature is NOT reduced:**
- Food estimation: `Copy prompt (text only)` → any AI → `Paste AI reply & review`
- Training plans: `Copy instructions for AI` → any AI → `Paste program from an AI`
  (still routed through the v77 review-before-replace flow)
- Progress reporting: `Copy report` (Markdown) and the Training JSON export by range
- All of the above work with ChatGPT, Claude, Gemini, or any future assistant, with no
  key, no account, and no cost to the user

**Implementation note:** remove the code path from the native branch. Do **not** ship a
build-time flag — a flagged-off variant differs from the build that was tested, and that
is how a flag bug reaches production. One tested build.

**Rationale:** with direct AI removed, no user health or nutrition data is transmitted by
the app to any third party. This is the decision that collapses most of Phase 1.

**Web also complete (corrected R4).** Direct API-key access was subsequently removed from
the web app as well, so both products are now copy/paste-only. The trigger was not App
Store policy — it was that the feature was unused (API access is too expensive for the
developer and for most prospective users), carried parity burden, and was unnecessary
given handoff. Verified on deployed web: zero provider endpoints, zero credential fields,
zero provider/model controls. Legacy credentials are scrubbed from persisted settings via
`scrubRetiredCredentials` inside the shared migration path — on a copy, with change
detection preceding the scrub so cleanup persists, and scoped precisely to the five
retired fields plus the retired `usdaKey`.

### D-2. Youth support (ages 13–17) — KEPT

**Decision:** Retain the youth energy equations, the 20/55/25 starting split, the
total-daily-movement activity mapping, the parent/guardian and pediatrician/RD
signposting, the under-13 and pregnancy/breastfeeding out-of-scope statements, and the
1,200 kcal floor with its "this floor does not mean it is appropriate for you" caveat.

**Rationale:** removing youth equations would not stop teenagers using the app; it would
only mean they receive adult equations that underestimate a growing teen's needs, with
none of the existing signposting. Category precedent indicates teen accessibility is routinely
approved for calorie trackers. The youth equations are a mitigating feature, not a
liability. (See the corrected age-rating note below: the app targets **13+**.)

**No user-facing "not for teenagers" warning is required or wanted.** Age expectations
already live in the calculator text and the FAQ legal section, which matches category
norms. Apple's age-rating questionnaire is a separate, mandatory step and is not a
user-facing disclosure.

**Age rating (corrected R4):** Apple's system now uses 4+, 9+, 13+, 16+, and 18+. The
old 12+ and 17+ tiers were removed, so any earlier "12+ is the norm" guidance is void.
The questionnaire now includes required questions on in-app controls, capabilities,
**medical or wellness topics**, and violent themes — BlackPyre's targets, youth
equations, and metabolism estimates fall under these and must be answered honestly.
Apple also allows setting a **higher** rating than it calculates when the app's own
policy requires a higher minimum age. Target **13+**, matching the app's own stated
scope, using the override if Apple calculates lower. The questionnaire is mandatory;
apps that have not completed it are blocked from submission.

### D-3. Device family — iPhone only for 1.0

Removes the iPad screenshot set, iPad QA matrix, and iPad-specific layout risk. The app
still installs and runs on iPad in iPhone compatibility mode; no user is locked out.

### D-4. Orientation — portrait only for 1.0

The UI is a phone-first single column and landscape has never been designed for. Revisit
only if landscape is deliberately designed and tested.

### D-5. Fonts — bundled locally

Remove the runtime `fonts.googleapis.com` stylesheet request (`index.html:14`) and the
font-domain caching in `sw.js`. Ship Oswald and IBM Plex Mono as local assets.

**Rationale:** it is the last third-party runtime request after D-1, it carries user IP
on every launch, and removing it makes the app fully self-contained offline — which also
strengthens the Guideline 4.2 position.

### D-6. Health data integration — IN 1.0 (reversed from R2–R5)

**Decision:** BlackPyre 1.0 ships health-data integration on iOS via HealthKit. Android
via Health Connect is planned as a later release but its **data contract is designed now**
(see D-11).

**Why this reversed.** Three reasons, in order of weight:

1. **It is the strongest available answer to Guideline 4.2.** BlackPyre is a Capacitor
   wrapper around a web app whose identical twin is publicly available free. Reading a
   user's Apple Health data is a capability the website categorically cannot have.
2. **It justifies the paid app.** A customer asking "why pay when the website is free"
   gets a concrete answer in one sentence.
3. It is genuine product value, and Ryan wants it.

**Approved scope — seven read signals plus one write, one release, and a contextual
HealthKit authorization flow:**

| Signal | Direction | What it changes in BlackPyre |
|---|---|---|
| Body weight | read | Offers the latest value for explicit confirmation; a confirmed entry feeds trend, goal progress, adaptive TDEE |
| Active energy | read | **Side-by-side** second opinion against logged-trend TDEE — never blended |
| Steps (daily total) | read | Objective evidence for/against the self-reported activity multiplier; directly supports the youth path, which is based on total daily movement |
| Sleep duration | read | Recovery signal |
| Resting heart rate | read | Recovery signal |
| HRV | read | Recovery signal |
| Workout HR (avg/max per session) | read | Intensity for the cardio card profiles (steadyTimeDistance, timedIntervals, distanceIntervals, conditioningRounds), which currently record duration/distance but nothing about effort |
| Workouts | **write** | Logged sessions appear in Apple Health and count toward rings |

**Explicitly out of scope:** live heart rate, beat-by-beat HR curves, standing hours,
step timelines, and any signal that only duplicates what the source app already displays
better.

**Governing rule (permanent):** *every imported signal must change an answer BlackPyre
gives.* Not appear on a screen — change an answer. This rule is now also a compliance
asset: Google Play requires that health permissions support specific, user-facing
features and prohibits requesting broader access than necessary.

**The synthesis is the feature.** No watch app can say "recovery has been below your
baseline for four days, you've missed sets on two of them, and you're 500 under
maintenance," because none of them hold the food log, the training history, and the
missed-set reasons together. That sentence is the product.

**Not an Apple Watch feature.** HealthKit is the iPhone's health database. The iPhone
itself provides steps; smart scales, Fitbit, Garmin, Oura, Whoop, Polar and others write
to it through their own apps. Marketing and FAQ wording should say BlackPyre reads what
the user's devices already record — not "Apple Watch support." Verify Fitbit's
write-through behavior specifically; its Apple Health support has historically been
partial.

### D-11. Health data storage contract — source-agnostic, device-only

**Decision:** one written contract, two platform adapters. Same treaty pattern as the
exercise model.

- **Storage: a native cache outside WebView local storage.** Use a dedicated native bridge
  and a cache file (for example, under `Library/Caches`) identified as
  `forge:health-cache`. **Never** place imported health data in `forge:data`, normal
  BlackPyre backups, LKG rotation, or quarantine. Imported health data is a cache of a
  source that still exists elsewhere — if lost, re-sync. A HealthKit weight can prefill
  the weigh-in form, but it enters primary BlackPyre data only after the user explicitly
  confirms the entry.
- **Exclude the cache from every backup path.** Apple's Guideline 5.1.3(ii) forbids
  storing personal health information in iCloud. Excluding health data from BlackPyre's
  exported backup is necessary but not sufficient: the native cache must also set
  `NSURLIsExcludedFromBackupKey` / `URLResourceKey.isExcludedFromBackupKey` on every
  save so it cannot enter an iOS/iCloud device backup. Tests must verify both boundaries.
- **Aggregates only, never raw samples.** Daily totals; per-session HR average and max.
  Beat-by-beat curves are thousands of samples per workout and would exhaust local storage
  within months. With aggregates the whole feature is a few hundred numbers a year.
- **No primary schema bump.** The contract lives outside `SCHEMA_VERSION`, with its own
  `healthFormatVersion:1`, like `recoveryFormatVersion`.
- **The contract is a shared artifact.** Commit it to the native repository now. The
  future Android/Health Connect adapter must adopt the stored shapes byte-identically;
  adapters differ, but the contract may not. That is the point of writing it before the
  Android work begins.

### D-7. Commercial model — PAID (revised)

**Decision:** BlackPyre 1.0 is a **paid product**, not free.

**Model (revised R4): one-time paid download is the recommended 1.0 model.** Apple
expects auto-renewing subscriptions to deliver ongoing value and to work across a user's
devices. BlackPyre is deliberately local, account-free, and server-free, which makes a
recurring charge harder to justify to both Apple and customers — "support and updates" is
what any paid app already owes. A one-time purchase matches the product's actual shape,
carries no ongoing obligation, and removes nearly all of Phase 4a. Revisit subscriptions
only if BlackPyre later adds genuine recurring value (cloud sync, regularly updated
programming, or another continuing service). Price itself remains deferred (D-8).

- No advertising, no analytics SDK, no BlackPyre server, no account required
- Enroll in the **App Store Small Business Program** (15% commission instead of 30%;
  a formal enrollment, not automatic —
  apply in App Store Connect)
- Requires the **Paid Applications agreement**: banking details and tax forms completed
  in App Store Connect before any paid product can ship
- Initial countries/regions: **still open — Ryan to confirm**

**Consequence:** this decision forces D-9 (web app). A paid iOS app cannot compete with a
free, identical, publicly hosted web version.

### D-8. One-time purchase price — DEFERRED, deliberately

Decide *that it is paid* now, because that unblocks submission planning. The **model** is
now decided (one-time purchase, D-7). The **one-time purchase price** remains deferred until the
app is in front of real users. There is no term, trial, or renewal structure to decide.
Price is changeable after launch; a rejected or delayed submission is not.

Implementation consequence for Phase 1: **build no paywall or feature-gating layer yet.**
Gating is new machinery with a new class of bug (paying user locked out) and it is not
required to reach TestFlight. Purchase mechanics land in their own phase (Phase 4a).

### D-9. Web app — must be resolved before submission

The public web build at `ryanlifts.github.io/Forge` is currently the same product, free.
Three options, to be decided before Phase 4:

1. **Retire it.** Cleanest commercially. Also removes the GitHub Pages constraint that
   forces the repository to stay public — the repo could then become private, which has
   been wanted since v41 and was previously impossible.
2. **Reduce it** to a clearly limited version (e.g. logging only, no programs/AI tools).
3. **Keep it** and accept competing with yourself.

**Sequencing rule (firm):** do not take the web app down before App Store approval. Until
Apple approves 1.0, the web build is the only shipping product and the only fallback if
review goes badly. Keep it live through at least the first weeks post-launch.

**If retired, existing PWA users need a migration path:** in-app notice, explicit
"back up now, restore on iOS" instruction, and a wind-down period. Their data lives in
browser storage tied to that origin; an installed PWA keeps working from cache for a
while but is one "clear site data" away from total loss. Cross-platform backup/restore
already handles the migration — the risk is people not knowing to do it.

### D-10. Android — not in this program, not foreclosed

Android is **not** part of the iOS 1.0 effort. Recorded so it is a decision rather than an
omission. Two existing paths remain available: the web app installs on Android today as a
PWA (which is a real reason not to retire it hastily), and Capacitor can target Android
from the same native codebase when a Play Store listing is wanted. Revisit after iOS 1.0.

---

## Part B — Still open (decide before Phase 2 ends)

Files exposure is no longer open: the current native package has
`UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` enabled, and Phase 2
item 6 keeps that capability with disclosure. Full local reset is also an implementation
requirement in Phase 2, not an undecided product question.

1. **Initial countries and regions.**
2. **Support contact address** for the support page and App Review contact.
3. **Web app disposition** (D-9) — retire, reduce, or keep. Required before Phase 4.
4. **One-time purchase price** (D-8) — required before Phase 4a, not before. There is no
   term and no trial structure to decide.
5. **COMPLETE — Health plugin selection.** The exact-pinned Capacitor Health Extended
   plugin is registry-integrity verified, licensed, and covered by permanent tests and
   third-party notices.

Workout write-back is decided: **it ships in 1.0.** BlackPyre writes only a newly logged,
same-day completed session whose exercise data contains an explicit recorded duration of
1 minute through 12 hours. It never substitutes time spent on the workout draft screen.
Edits, historical entries, drafts, planned durations, incomplete sessions, and strength
or mixed sessions without an explicit total duration are ineligible.
The final release gate is a physical Apple Health write/read-back check on RAW and the
same check on the TestFlight candidate.

---

## Part C — Revised phasing

### Phase 1 — Implement the approved decisions (code)

One release, gated and reviewed as usual.

- Remove the direct-provider AI path from native (D-1)
- Rework the Settings AI card so copy/paste reads as **the** design, not a fallback: no
  provider picker, no key field, no model rows
- Update native FAQ wording to remove key/provider references
- Bundle fonts locally; remove font domains from the service worker (D-5)
- Apply device-family and orientation settings (D-3, D-4)
- Audit and remove the obsolete `armv7` required-device capability
- Make the camera permission string match barcode scanning exactly
- Permanent tests: **assert the shipped native source contains no `api.anthropic.com`,
  no `api.openai.com`, no key-entry elements, and no provider links** — this is the check
  that survives a future refactor accidentally reintroducing them
- **No paywall, no purchase code, no feature gating in this phase** (D-8)
- Bump cache; full gauntlet green; Claude reviews the diff before it ships

**Exit:** clean gauntlet, reviewed diff, physical smoke test on device.

### Phase 2 — Privacy artifacts and iOS package hardening

**Status: COMPLETE — August 9, 2026.** Native build 2 and web cache v104 passed their
full permanent gauntlets. The final signed Release archive passed Xcode store validation
and independent signature verification. Privacy/support/notices pages, local erasure,
Open Food Facts correction and attribution, native backup exclusion, release artifacts,
and dependency hardening are implemented. Phase 2a is next.

Ordered. Items 1–2 are upload blockers; do them first.

1. **`PrivacyInfo.xcprivacy` (upload blocker).** No app-level manifest exists; the build
   contains only two empty Capacitor/Cordova framework manifests. Generate an Xcode
   privacy report against the current Capacitor package, add the correct required-reason
   declarations, and validate a signed Release archive. Uploads with undeclared
   required-reason APIs are rejected before review.
2. **First signed Release archive** passing Organizer/App Store validation. Debug signing
   working is not evidence that Release signing does.
3. **Publish privacy policy and support pages**, with real contact information, and add an
   in-app privacy-policy link. Both the App Store Connect link and the in-app link are
   required.
4. **Add "Erase all BlackPyre data."** No complete local reset exists today. Must be
   double-confirmed, must respect protected mode's destructive-reset guard, and must state
   that uninstalling also removes local backups unless they were copied elsewhere. This is
   what makes the privacy policy's deletion section honest.
5. **Open Food Facts compliance and correction.**
   - **Defect: remove or replace the `cgi/search.pl` fallback (`scripts/02-food.js:348` (native; web equivalent at 02-food.js:447)).**
     OFF's legacy Perl search backend is deprecated and has been returning HTTP 503
     globally. The fallback cannot succeed; it only adds a timeout before failure. Primary
     text search already uses Search-a-licious (`search.openfoodfacts.org`), which is the
     correct modern endpoint. On primary failure, go to manual entry.
   - Barcode reads use `/api/v2/product/`; v3 is current (v3.6). Migration is optional and
     **not** a 1.0 blocker — schedule it, don't rush it.
   - **Append** BlackPyre identification to the standard WebKit user agent on the native
     side (`WKWebView` `applicationNameForUserAgent`, not a wholesale `customUserAgent`
     replacement — replacing the entire string risks compatibility problems with other
     services). The web build cannot set this at all; `User-Agent` is a forbidden header
     in browsers.
   - Register BlackPyre's API usage with OFF; verify rate-limit behavior.
   - Add explicit ODbL attribution and licensing text.
6. **Files exposure — keep enabled, disclose.** `UIFileSharingEnabled` and
   `LSSupportsOpeningDocumentsInPlace` remain on: Files-based backup is real native
   capability and supports the Guideline 4.2 position. The privacy policy must state that
   backups are visible in Files and are removed on uninstall unless copied elsewhere.
   Mark app-owned backup files as excluded from automatic iOS/iCloud device backup;
   copying or sharing a backup elsewhere remains an explicit user action.
7. **COMPLETE — regression checks only.** The following shipped in Phase 1 and must be
   re-verified on the release candidate, not re-implemented: fonts and both font licenses
   bundled locally with no Google Fonts runtime request; iPhone-only; portrait-only; arm64
   with no `armv7` requirement; camera permission string exactly *"BlackPyre uses your
   camera only to scan food barcodes."*; marketing version 1.0, build 1; 1024×1024 icon
   with no alpha channel; iOS 26 SDK build.
9. **Data-flow map** covering: local storage; Open Food Facts (search, barcode); the
   **YouTube exercise-video search** (native `scripts/05-ai.js:75`; web `05-ai.js:70` — opens an external browser with
   an exercise name in the query string); static research links; camera (local scanning
   only — vendored library, no network); local notifications; backup/import/export/share/
   recovery files.
10. **Draft App Privacy answers — do not default to "No data collected."** Apple counts
    search history as a data type, and third-party handling counts. Barcode requests,
    search terms, and IP exposure to OFF must be evaluated conservatively. Conversely,
    HealthKit data processed only on device is not "collected" under Apple's App Privacy
    label definition; document it in the privacy policy and permission strings without
    incorrectly declaring off-device collection.
11. **Copy corrections.** The offline banner still says connected AI features need a
    connection (native `index.html:816`; web `index.html:894`); direct AI is gone and handoffs work offline. Fix the
    banner and any matching FAQ wording in both products.
12. **Dependencies.** Resolve the high-severity `brace-expansion` advisory in the
    build-time Capacitor CLI chain (not shipped runtime code, but fix it). Take the
    controlled Capacitor 8.4.2 → 8.5.0 updates deliberately, then re-run both gauntlets and
    re-validate the archive. Confirm `vendor/html5-qrcode.min.js` is still the
    npm-verified 2.3.8 build.
13. **Consolidated third-party notice** covering fonts, the barcode scanner, Capacitor and
    its plugins, and IONFilesystemLib.
14. **Build numbering:** marketing version stays 1.0; increment build 1 → 2 → 3 for every
    upload.

**Exit:** clean signed Release archive passing validation, live privacy/support URLs,
drafted App Privacy answers, validated privacy manifest, OFF fallback defect resolved.

### Phase 2a — Health data integration (iOS)

Sequenced **after** Phase 2's privacy work (which this feature depends on) and **before**
Phase 4 store preparation. Do not let it block Phase 2; do not start Phase 4 without it.

1. **Write the contract first** (D-11) as `HEALTH-DATA-CONTRACT.md` in the native
   repository. Define the stored shape for each of the seven signals plus write-back, the
   native cache boundary, `healthFormatVersion:1`, aggregate-only rule, explicit iOS
   backup exclusion, and the statement that a Health Connect adapter must fit it unchanged.
2. **Select and vendor the Capacitor HealthKit plugin.** Verify against the npm registry
   shasum, record the checksum, bundle its license, and add it to the third-party notice.
   Same discipline as the barcode scanner.
3. **HealthKit entitlement**; `NSHealthShareUsageDescription` and (if write-back ships)
   `NSHealthUpdateUsageDescription`. Strings must describe actual use plainly.
4. **Permission handling.** Reads and writes are granted separately and per data type — a
   user may grant weight and deny HRV. HealthKit intentionally does not reveal whether
   read access was denied; a denied read appears exactly like no matching data. Therefore
   every signal must degrade to an honest **"No accessible data"** state with manual
   fallback, never claim that permission was denied, never show an unexplained empty
   chart, and never crash. Write authorization may be checked normally.
5. **Source-failure honesty.** When no accessible data is returned, offer neutral
   troubleshooting: check the Health app, the source device/app, and Health permissions.
   Do not claim which condition caused it. A Fitbit that is not writing to Apple Health
   will otherwise look like a BlackPyre bug.
6. **Active energy is displayed beside logged-trend TDEE, never blended into it.** The
   logged-trend method stays the authority for targets. A persistent gap is information —
   surfacing it is the value.
7. **Write-back** writes only real logged sessions with actual durations (5.1.3(ii)).
8. **Privacy policy gains a health-data section**: what is read, that imported HealthKit
   data stays on device, never enters BlackPyre backups or iCloud/device backups, is never
   used for advertising, and how to revoke access in iOS Settings.
9. **Permanent tests:** contract round-trips for all seven signals; aggregate-only
   enforcement; each read type denied independently and verified through the same
   no-accessible-data behavior as an empty store; write-denial handling; health data
   absent from BlackPyre backup files, LKG, quarantine, and iOS/iCloud device backups
   (verify the exclusion resource value after every save); no primary schema change; TDEE
   unchanged when active energy is present.

**Exit:** all signals verified on a physical device with real watch/scale data, every
permission-denied path exercised, health data proven absent from every backup artifact,
gauntlet green, diff reviewed.

### Phase 3 — Release QA

Adds two dimensions the original plan omitted.

- **Clean install with zero data**, walked end to end: onboarding → first food log →
  first workout → first backup. This *has* been done before by manual delete-and-reinstall;
  what remains is repeating it **on the final TestFlight candidate**, installed through
  TestFlight rather than Xcode.
- **Upgrade-in-place** from the currently installed native build
- Full functional matrix as originally written (food, barcode verify/correct, zero-value
  nutrition, training entry/removal/draft/resume, weight, notifications allowed/denied,
  backup/restore/corrupt-file recovery, offline, backgrounding and forced termination
  during saves)
- Accessibility matrix: VoiceOver, larger text, display zoom, contrast, Reduce Motion,
  focus visibility, touch targets, safe areas, small-screen devices
- Device minimum: the current test device, one small-screen phone (SE/mini class — real
  risk given 16px typography and safe-area work), and the oldest supported iOS version
- **Deployment target must be honest.** The minimum was raised from untested iOS 15 to
  **iOS 16.1** on August 12, 2026, matching the Live Activity foundation. Validate the
  final TestFlight build on iOS 16.1 or the oldest available 16.x device before release;
  a deployment setting and successful compilation do not replace floor-version testing.
- Notification permission allowed **and denied**; offline and reconnect; backgrounding and
  forced termination during saves; backup/restore/corrupt-file recovery **on a clean
  install**
- **Health permissions**: granted, denied, partially granted (some types allowed, others
  refused), and revoked in iOS Settings *after* being granted — the app must survive
  revocation mid-life without data loss or crash

**Exit:** no release-blocking or high-severity defects; documented results per device class.

### Phase 4 — App Store Connect preparation

**Status: COMPLETE — August 12, 2026.** Product-page metadata, privacy and compliance
answers, review notes, U.S.-only initial availability, continued web-app support, and the
fictional 6.9-inch screenshot master set are prepared. Private review-contact values are
direct-entry App Store Connect fields and are intentionally excluded from version control.
Authentication, commercial setup, signing, and upload continue in Phases 4a and 5.

As originally written, with these emphases:

- Category: Health & Fitness; **age rating: target 13+** (see D-2), questionnaire
  completed honestly including the medical/wellness questions
- **HealthKit review material**: privacy policy covering health data (required for
  HealthKit apps), and review notes describing which types are read, why each is needed,
  and that nothing leaves the device
- **Regulated-medical-device declaration** for the U.S., UK, and EEA — required for the
  Health & Fitness category. BlackPyre appears not to be a regulated medical device, so
  the expected answer is "No," but the declaration is mandatory
- **Export compliance answers** (HTTPS-only use generally falls under the standard
  exemption, but the question is mandatory and blocks submission)
- **Content-rights declaration** covering Open Food Facts data
- DSA trader status if distributing in the EU
- Screenshots from fictional data only, matching the submitted build; iPhone only
- Copyright: © 2026 Ryan Allen Wilsey. All rights reserved.
- **Guideline 4.2 matters more now that the app is paid.** Apple is more skeptical of
  paid apps that resemble wrapped websites, and the web version's disposition (D-9) will
  be visible to a reviewer. Resolve D-9 before submitting.
- **Review notes must lead with native capability (Guideline 4.2).** The identical app is
  publicly available free on the web, and a reviewer may find it. Name the native-only
  capabilities individually with one line each on how to exercise them:
  Apple Health integration · camera barcode scanning · local notifications for rest
  timers · Files-based backup/import/share · full offline operation · the Native Vault
  recovery system.
- Review notes should also state: **no account exists** (so Apple's account-deletion
  requirement does not apply), no BlackPyre server, data stored locally with a full
  "Erase all data" option, camera used only for barcode scanning, and that AI features are
  copy/paste to the user's own assistant with **no data transmitted by the app**.
- Two sentences on youth support: youth-specific equations exist so teen users receive
  age-appropriate estimates rather than adult ones, with parent/guardian and clinician
  signposting.

**Exit:** every field complete, all URLs live, screenshots match the build.

### Phase 4a — Paid distribution setup (one-time purchase)

Scope collapsed by D-7. A one-time paid download requires **no** StoreKit entitlement
code, no restore-purchases flow, no receipt validation, no paywall, and no lapsed-state
handling. Apple gates the download itself; the app ships with all features included and
all data local. This phase is commercial setup only — no application code changes.

- Sign the **Paid Applications Agreement**
- Provide **banking information** and complete **tax forms** in App Store Connect
- Enroll in the **Small Business Program** (15% commission rather than 30%; a formal
  enrollment, not automatic)
- Set the **one-time purchase price** (D-8)
- Confirm **countries and regions**
- Verify paid availability: the app shows as purchasable in the intended storefronts

**Exit:** agreements signed, banking and tax complete, Small Business Program enrolled,
price and territories set, paid availability verified.

**Not in scope for 1.0:** subscriptions, free trials, introductory pricing, in-app
purchases, and any feature gating. Revisit only if BlackPyre later adds genuine recurring
value (see D-7).

### Phase 5 — Internal TestFlight

- Upload the first signed Release archive; resolve processing and export-compliance warnings
- Test install and update **through TestFlight**, not a local Xcode install
- Run one complete onboarding-to-backup lifecycle
- Increment the build number for every replacement build

**Exit:** one stable build passing the full smoke test on representative devices.

### Phase 6 — External TestFlight

- Small first cohort. **At least one tester who is not Ryan** — ideally someone
  unfamiliar with how the app is supposed to work. A first-run experience either survives
  contact with a stranger or it does not.
- Beta App Review for the first external build
- Track defects by severity and build number

**Exit:** external approval, successful upgrade testing, no unresolved blockers.

### Phase 7 — Submission and controlled release

- Submit the proven TestFlight build; manual release for 1.0
- Keep a reviewer-response document ready covering health/nutrition guidance, barcode data
  sources, local storage, the copy/paste AI workflow, youth equations, and backup/recovery
- Hotfix branch and build-number procedure ready before release

---

### Phase 8 — Android (planned, after iOS 1.0 ships)

Not part of the iOS 1.0 program. Recorded here so the architecture accounts for it.

- Capacitor already targets Android from the same native codebase; this is adding a build
  target, not writing a second app.
- **Health Connect** is the Android health repository — on-device, encrypted, part of the
  OS since Android 14, supported back to Android 9. Google Fit's APIs are retired, so this
  is the only path.
- **Google's health requirements are stricter than Apple's.** Required: the **Health apps
  declaration form** in Play Console before distribution; per-data-type declarations
  justifying *why* each is needed; adherence to the rule that permissions must support
  specific user-facing features with no broader access than necessary; a **disclaimer in
  the app description** that BlackPyre is not a medical device and does not diagnose,
  treat, cure, or prevent any condition, plus a reminder to consult a professional; and a
  privacy policy URL **identical** in Play Console, in the app, and on the website.
- The D-11 contract means the Android work is an **adapter**, not a migration.
- Play also has a Small Business equivalent worth enrolling in; verify current terms.
- **Until Android ships, the PWA is the only BlackPyre available to Android users** — a
  concrete argument for not retiring the web app (D-9).

## What changed from the original plan

| Area | Original | Revised |
|---|---|---|
| Direct AI | Recommended disabling via public-build variant | **Removed from native entirely**; no build variant |
| Youth 13–17 | Flagged as high scrutiny | **Kept**; reassessed as a mitigating feature, not a liability |
| Privacy manifest | Phase 1 task | **Upload blocker**, validated early in Phase 2 |
| Privacy scope | Large (AI transmission, fonts, OFF) | **Reduced before R6**; HealthKit adds sensitive on-device scope with explicit no-export/no-iCloud boundaries |
| Fonts | Noted | **Decision D-5**, bundled locally |
| QA | Device matrix | Adds **clean-install** and **upgrade-in-place** paths |
| Testers | Internal group | Adds **a non-Ryan external tester** as a requirement |
| Guideline 4.2 | Mentioned | **Elevated**; identical free website exists and reviewers may find it |
| Health data | Deferred (old D-6) | **In 1.0 (new D-6)** — 7 read signals + workout write-back, new Phase 2a |
| Health storage | Not addressed | **D-11** — source-agnostic contract, device-only, aggregates only, never in backups |
| Android | Deferred (old D-10) | **Planned, Phase 8**; contract designed now so it is an adapter, not a migration |
| Commercial model | Free, no IAP | **Paid (D-7)**; price deferred (D-8) |
| Purchase work | Not addressed | **Phase 4a is commercial setup only** — no purchase code for a one-time download |
| Web app | "Later" | **D-9, decide before Phase 4**; never retire before approval |
