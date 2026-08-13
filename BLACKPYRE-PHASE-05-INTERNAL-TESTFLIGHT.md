# BlackPyre Phase 5 — Internal TestFlight

**Date opened:** August 13, 2026

**Status:** IN PROGRESS — build 2 processed, validated, and assigned for internal testing

**Version:** 1.0

**First build:** 2

## Current gate

Apple Developer Program membership is active. The BlackPyre App Store Connect record and
the `BlackPyre Internal` group exist. The full 1,346-check gauntlet passed, the signed
Release archive validated, and version 1.0 build 2 uploaded successfully on August 13,
2026. Apple processed and validated the build, and it is assigned to `BlackPyre Internal`
with the beta description, privacy URL, feedback address, and What to Test instructions
saved. Build 2 is also assigned to the `BlackPyre Beta` external group and was submitted
for first-build Beta App Review with the private review contact entered directly in App
Store Connect.

## Native release configuration — verified

| Setting | Value |
|---|---|
| Platform | iOS / iPhone only |
| App name | BlackPyre |
| Version | 1.0 |
| Build | 2 |
| App bundle ID | `com.blackpyre.app` |
| Live Activity bundle ID | `com.blackpyre.app.resttimer` |
| Minimum iOS | 16.1 |
| Signing | Automatic |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` |

Build 2 is the first planned TestFlight upload. Every replacement upload must increment
the build number. Never overwrite or reuse an uploaded build number.

## App Store Connect record — created

The record was created August 13, 2026.

| Field | Value |
|---|---|
| Platform | iOS |
| Name | BlackPyre |
| Primary language | English (U.S.) |
| Bundle ID | `com.blackpyre.app` |
| SKU | `BLACKPYRE-IOS-1` |
| User access | Full Access |

## Internal TestFlight information

**Internal group:** BlackPyre Internal

**Automatic distribution:** Off for the first build; add the proven build manually.
**First tester:** Ryan. Additional internal testers must be App Store Connect users.

**External group:** BlackPyre Beta. The first external build requires Beta App Review
before invitations or a public testing link can be used.

### Beta app description

BlackPyre is a private, local-first nutrition and training tracker. It combines food and
macro logging, barcode verification, training programs and workout history, rest-timer
Live Activities, weight and measurement trends, water history, Apple Health integration,
and complete local backup and recovery without a BlackPyre account.

### What to test

Test the complete first-run lifecycle: onboarding; imperial and metric setup; food search,
manual entry, AI copy/paste handoff, and barcode verification; training-program import,
strength and timed exercises, removal/restore controls, rest timer and Live Activity;
same-day eligible workout sharing to Apple Health; weight, measurements, and water
history; permission denial and revocation; external backup, restore, Native Vault, and
erase-all-data. Confirm no user history disappears during an update.

### Private direct-entry field

The TestFlight feedback email must be entered directly in App Store Connect. Do not add
the address to version control unless Ryan deliberately chooses to publish it.

## Activation-to-install runbook

- [x] Apple Developer Program status changes from Pending to Active.
- [x] App Store Connect opens its Apps and Business sections.
- [x] Confirm the Free Apps Agreement is active. Paid distribution setup remains tracked
      separately in Phase 4a.
- [x] Refresh the Apple account in Xcode and allow automatic signing and App Store
      distribution provisioning.
- [x] Create the BlackPyre App Store Connect record using the prepared values above.
- [x] Run the complete native release gauntlet and root/www/native parity checks.
- [x] Create a signed Release archive for generic iOS device.
- [x] Validate the archive and upload build 2 to App Store Connect.
- [x] Wait for Apple processing and resolve any compliance or processing warning.
- [x] Add the processed build to **BlackPyre Internal** with the What to Test text above.
- [x] Create the **BlackPyre Beta** external testing group.
- [x] Submit build 2 to the external group for first-build Beta App Review.
- [ ] Install through TestFlight on RAW without uninstalling the current app.
- [ ] Complete onboarding-to-backup smoke testing and verify update preservation.

## Exit gate

Phase 5 is complete when one processed internal TestFlight build installs on RAW and
passes the full lifecycle smoke test, including an update-in-place data-preservation check.

## Apple references

- Create the app record: <https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/>
- Upload builds: <https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/>
- TestFlight overview: <https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/>
- Internal testers: <https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/>
