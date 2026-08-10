# BlackPyre 1.0 — Draft App Privacy Answers

This is a review draft, not a substitute for the final App Store Connect questionnaire.
Re-check against the exact uploaded binary and Open Food Facts' then-current retention
practice.

## Tracking

- **Does BlackPyre or a third-party partner use data for tracking?** No.
- No advertising, cross-app tracking, analytics SDK, data broker, or advertising ID.

## Data processed only on device

Settings, nutrition/training logs, weights, programs, camera frames used for barcode
recognition, local notifications, recovery records, and future HealthKit data are
processed only on device. Under Apple's definition, data that never leaves the device is
not “collected” for the App Privacy label. Explain it in the privacy policy, but do not
mislabel it as off-device collection.

## Open Food Facts requests

Online packaged-food search sends search words or a barcode to Open Food Facts over
HTTPS. Open Food Facts also receives ordinary request metadata such as IP address.
BlackPyre does not send the user's log, targets, name, weight, or training history.

Conservative draft pending confirmation of Open Food Facts retention:

| App Privacy type | Collected | Purpose | Linked | Tracking |
|---|---:|---|---:|---:|
| Search History | Yes | App Functionality | Treat as linked conservatively because the service receives IP metadata | No |
| Device ID / Other Data representing retained IP metadata | Confirm with Open Food Facts before final submission | App Functionality / service security | Confirm | No |

If Open Food Facts confirms that request metadata and queries are discarded immediately
after servicing the request, Apple's real-time-request exception may change the answer.
Do not claim that exception without written confirmation.

## User-directed external actions

AI handoffs, YouTube exercise search, research links, backups, reports, AirDrop, and share
sheet destinations happen only after an explicit user action. Evaluate each under Apple's
user-directed transfer rules against the final binary; BlackPyre itself does not retain
off-device copies.

## Required supporting statements

- No BlackPyre account exists.
- No BlackPyre server exists.
- No data is sold.
- No data is used for advertising or marketing.
- Camera access is only for local food-barcode scanning.
- Privacy policy: https://ryanlifts.github.io/Forge/privacy.html
- Support: https://ryanlifts.github.io/Forge/support.html
