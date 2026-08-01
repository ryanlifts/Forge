# BlackPyre iOS — App Store Readiness Phased Plan

Status date: 2026-08-01

Native repository: `~/Documents/Forge`
Starting verification baseline: 935 automated tests passing (168 unit, 711 integration, 56 exercise-card profile checks), 203 exercises covered, unsigned Release build passing.

## Progress

| Phase | Status | Evidence |
|---|---|---|
| 1 — Nutrition safety and honest estimates | Complete | 993 automated checks passed; unsigned Release and signed RAW builds succeeded; installed and launched on RAW; web-parity handoff complete |
| 2 — Keyless food data | Not started | Awaiting Phase 2 start |
| 3 — Privacy and AI | Not started | Awaiting Phase 3 start |
| 4 — Platform security | Not started | Awaiting Phase 4 start |
| 5 — Native polish | Not started | Awaiting Phase 5 start |
| 6 — App Store release | Not started | Awaiting Phase 6 start |

## Working rules

- Native iOS work stays in `~/Documents/Forge`; the web repository is not used by this plan.
- The protected Xcode signing/project configuration is not changed unless separately approved.
- Every phase follows: read-only inspection → implementation → targeted tests → full tests → unsigned Release build when the phase affects the shipped app.
- No staging, commit, push, deployment, TestFlight upload, or App Store submission occurs without explicit approval at that point.
- Every completed phase produces a self-contained web-parity handoff. The handoff records the user-visible contract, edge cases, source locations, tests, authoritative references, and any intentionally native-only behavior.

## Phase 1 — Nutrition safety and honest estimates

Status: complete on 2026-08-01.

Goal: make calorie guidance safe, consistent, and accurately worded before wider release.

Scope:

- Validate calculator inputs for ages 13–100 before calculating.
- Give ages 13–17 the complete calculator, macro, apply, and scheduling experience using the 2023 Dietary Reference Intake youth energy equation and a 20% protein / 55% carbohydrate / 25% fat Recommended starting split.
- Translate teen activity conservatively from total daily movement: Moderate uses Low active, Active requires high daily movement plus frequent exercise, and Very active requires vigorous daily activity or hard training.
- Enforce a 1,200 kcal/day self-directed-use floor in calculator results, manual targets, schedule presets, custom schedules, and log-derived target proposals.
- Preserve the existing green registered-tap feedback only after a valid calculation.
- Keep validation explanations beside Calculate or Save settings, identify invalid fields semantically, and clear an error when its inputs change.
- Persist the calculator's own validated weight input across relaunches instead of replacing it with the starting weight or latest weigh-in; retain that fallback only for legacy settings without a saved calculator weight.
- Replace overconfident “actual/measured/more accurate” metabolism language with a clearly labeled estimate.
- Require a stronger log history before showing the estimate, reject implausible results, and make the result review-only instead of silently changing targets.
- Update first-run setup, Settings notes, first-use disclaimer, and FAQ to describe the same contract.
- Add regression tests for valid boundaries, rejected inputs, unsafe schedules, estimate eligibility, and review-before-save behavior.

Exit criteria:

- Targeted nutrition-safety tests pass.
- Full unit, integration, and exercise-card profile suites pass.
- Unsigned Release build passes.
- Signed Debug build installs and launches on RAW for acceptance testing.
- `BLACKPYRE-PHASE-01-NUTRITION-SAFETY-WEB-PARITY.md` is complete.

## Phase 2 — Keyless food data and nutrition-source resilience

Goal: remove the App Store and operational risk created by the bundled USDA API key and the expectation that users obtain their own key.

Scope:

- Remove the bundled USDA key from shipped source and scrub key-centric onboarding/help language.
- Decide and implement the production food-source order: expanded local/offline staples, Open Food Facts for packaged foods/barcodes, and USDA only through an app-controlled service if retained.
- Add source labels, freshness/failure behavior, nutrition normalization, duplicate handling, and clear manual-entry fallback.
- Add resilience, rate-limit, timeout, offline, and malformed-response tests.
- Update setup and FAQ so food search works without asking users to create a USDA developer account.

Exit criteria:

- No shared USDA credential ships in the app bundle.
- Core food logging and an honest no-network fallback remain usable.
- Targeted and full tests plus unsigned Release build pass.
- `BLACKPYRE-PHASE-02-FOOD-DATA-WEB-PARITY.md` is complete.

## Phase 3 — Privacy, AI, support, and account-free release policy

Goal: make data handling and optional AI features defensible in App Review and understandable to users.

Scope:

- Finalize the App Store AI model: secure native key storage, provider handoff, or removal of direct bring-your-own-key entry from the public build.
- Complete the privacy manifest and App Privacy questionnaire source inventory.
- Publish/prepare privacy policy, terms, support contact, support URL, and data-deletion/reset instructions appropriate to an account-free app.
- Align backup, restore, local-vault, app-deletion, AI transmission, and data-retention wording across UI, FAQ, and store disclosures.
- Add privacy-critical tests for exports, key exclusion/storage, clear-data behavior, and external transmissions.

Exit criteria:

- Privacy disclosures match observed runtime behavior.
- No sensitive credential is stored in ordinary web storage in the public release path.
- Targeted and full tests plus unsigned Release build pass.
- `BLACKPYRE-PHASE-03-PRIVACY-AI-WEB-PARITY.md` is complete.

## Phase 4 — Platform security and dependency modernization

Goal: remove avoidable technical-release risk and bring the native shell up to supported production standards.

Scope:

- Update Capacitor and native dependencies in controlled increments.
- Review navigation allowlists, external-link handling, transport security, content security policy, permissions, and plugin surface.
- Replace externally hosted runtime fonts/assets with bundled assets where appropriate.
- Run migration, cold-start, offline, backup/recovery, and plugin regression tests after updates.

Exit criteria:

- Supported dependencies and a documented security baseline.
- No unapproved remote navigation or unnecessary permission path.
- Targeted and full tests plus unsigned Release build pass.
- `BLACKPYRE-PHASE-04-PLATFORM-SECURITY-WEB-PARITY.md` is complete.

## Phase 5 — Native product polish and store presentation

Goal: finish user-facing quality and prepare complete App Store materials.

Scope:

- Complete an FAQ-to-feature audit after Phases 1–4 and remove every stale or overstated answer.
- Perform VoiceOver, Dynamic Type, reduced motion, contrast, keyboard, safe-area, orientation, and device-size checks.
- Make and document the iPhone/iPad support decision; fix iPad layouts if iPad remains supported.
- Finalize app name/subtitle, category, age rating inputs, keywords, description, screenshots, preview strategy, icon, launch presentation, version, and build numbering.
- Complete a physical-device acceptance matrix for clean install, upgrade, offline use, backup/restore, notifications, camera/barcode, and interrupted saves.

Exit criteria:

- No critical accessibility or device-layout failures.
- Store metadata and assets are review-ready and match actual behavior.
- Targeted and full tests plus signed-device validation and Release build pass.
- `BLACKPYRE-PHASE-05-NATIVE-POLISH-WEB-PARITY.md` is complete.

## Phase 6 — TestFlight, App Store submission, and release operations

Goal: prove the release candidate and submit it with a repeatable operating checklist.

Scope:

- Create the approved signed archive and validate entitlements, privacy manifest, symbols, version/build, and included assets.
- Upload to App Store Connect, complete export-compliance/privacy/age-rating forms, and distribute to TestFlight.
- Run clean-install and upgrade acceptance tests on the TestFlight build, including restore from a real backup.
- Resolve all blocking findings, freeze the release candidate, submit for review, and record reviewer notes.
- Prepare post-release monitoring, support triage, rollback/hotfix, backup compatibility, and release-note procedures.

Exit criteria:

- Approved TestFlight candidate passes the acceptance matrix.
- App Store Connect contains complete, accurate metadata and disclosures.
- The reviewed build is submitted/released only after explicit owner approval.
- `BLACKPYRE-PHASE-06-APP-STORE-RELEASE-WEB-PARITY.md` is complete.

## Web-parity handoff contract

Every phase handoff must be usable without access to the native thread and must include:

1. Phase purpose and completion status.
2. Exact behavior the web app must match.
3. Validation limits, persistence rules, messages, accessibility expectations, and failure behavior.
4. Native source and test locations for reference.
5. Automated and manual evidence with exact pass counts.
6. Authoritative external sources where the contract depends on current health, privacy, security, or platform guidance.
7. Explicit native-only exceptions and known follow-ups.
8. A copy-ready implementation checklist for the web thread.

## Release sequence

Phases are intentionally ordered by user harm and review risk: nutrition safety → food-data independence → privacy/AI → platform security → store polish → submission. A later phase may be inspected early, but its production changes do not bypass the earlier phase’s exit criteria.
