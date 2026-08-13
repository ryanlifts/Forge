# BlackPyre iOS — Phase 4 App Store Connect Packet

**Prepared:** August 12, 2026  
**Platform:** iPhone only, portrait only  
**Bundle ID:** `com.blackpyre.app`  
**Version:** 1.0  
**Status:** COMPLETE — metadata, compliance answers, product decisions, and the fictional
6.9-inch screenshot master set are prepared. Private review-contact values must be entered
directly in App Store Connect and must not be committed to this repository.

## 1. App record

| Field | Value |
|---|---|
| Name | BlackPyre |
| Primary language | English (U.S.) |
| Bundle ID | `com.blackpyre.app` |
| SKU | `BLACKPYRE-IOS-1` |
| Primary category | Health & Fitness |
| Secondary category | Lifestyle |
| Made for Kids | No |
| Copyright | `2026 Ryan Allen Wilsey` |
| Privacy Policy URL | `https://ryanlifts.github.io/Forge/privacy.html` |
| Support URL | `https://ryanlifts.github.io/Forge/support.html` |
| Marketing URL | Leave blank for 1.0 unless a dedicated iOS product page is published |
| License agreement | Apple's standard EULA |

The three public URLs required by this packet returned HTTP 200 on August 12, 2026:
privacy policy, support, and third-party notices.

## 2. Product-page copy

### Subtitle — 28 of 30 characters

`Nutrition & Training, Forged`

### Promotional text — 130 of 170 characters

`Track nutrition, training, weight, measurements, water, and Apple Health data—privately, locally, and without a BlackPyre account.`

### Keywords — 82 of 100 bytes

`nutrition,calorie,macros,protein,workout,strength,weight,fitness,food,water,health`

### Description

Burn away the old. Forge what comes next.

BlackPyre is a private nutrition and training tracker built to keep your data yours. Log
food, follow a training program, track body trends, and review optional Apple Health
signals in one focused place—without creating an account.

NUTRITION THAT FITS REAL LIFE

• Set calorie and macro targets with guided estimates for ages 13 and older  
• Log packaged foods with search or camera barcode scanning  
• Verify barcode nutrition against the package before logging  
• Save personal foods, meals, and recent entries for quick reuse  
• Track daily water intake  
• Use copy-and-paste AI handoffs without BlackPyre contacting an AI provider

TRAINING BUILT AROUND THE WORK

• Load a program or build your own  
• Track strength sets, repetitions, timed holds, intervals, distance, carries, rounds,
  duration-only activities, and notes  
• Add custom exercises and replace movements when needed  
• Preserve drafts and review training history

SEE THE TREND

• Record weight with date and time  
• Choose metric or U.S. customary units  
• Track body measurements and progress over time  
• Optionally read selected Apple Health signals, including steps, active energy, sleep,
  body weight, resting heart rate, HRV, and workout summaries

PRIVATE BY DESIGN

BlackPyre has no account, advertising, analytics SDK, or BlackPyre server. Your primary
data stays on your iPhone. Full backup, restore, Native Vault recovery, and erase controls
put you in charge. Core tracking works offline; packaged-food lookup uses Open Food Facts
when connected.

BlackPyre provides general wellness estimates and tracking tools, not medical advice,
diagnosis, or treatment. Consult a qualified professional for medical decisions.

## 3. Age rating

Answer the questionnaire truthfully:

- In-app controls: none.
- Unrestricted web access: no. BlackPyre opens specific external links in the system
  browser; it does not contain a general-purpose browser.
- User-generated content, social media, messaging/chat, and advertising: no.
- Health or Wellness Topics: frequent. Nutrition and exercise tracking are core features.
- Medical or Treatment Information: none. BlackPyre does not diagnose, prescribe, or
  guide treatment.
- All mature themes, sexuality, violence, gambling, contests, and loot boxes: none.
- Choose **Override to Higher Age Rating: 13+** because BlackPyre is designed for ages 13
  and older even if Apple's calculated content rating is lower.
- Do not select Made for Kids.

## 4. App Privacy answers

Use the conservative declaration because Open Food Facts receives direct HTTPS requests
from the user's device and rate-limits by IP address.

- **Does the app or a third-party partner collect data?** Yes.
- **Tracking:** No.
- **Search History:** Collected for App Functionality; linked conservatively; not used for
  tracking.
- **Other Data:** Network request metadata such as IP address; App Functionality and
  service security; linked conservatively; not used for tracking.

Do **not** declare locally processed nutrition, weight, training, measurements, photos,
or HealthKit aggregates as collected. They never leave the device through BlackPyre.
User-directed exports, share-sheet actions, external links, and AI copy/paste handoffs
occur only when the user deliberately chooses them.

Privacy policy: `https://ryanlifts.github.io/Forge/privacy.html`

## 5. Compliance declarations

### Export compliance

- `ITSAppUsesNonExemptEncryption` is `NO` in the shipped Info.plist.
- BlackPyre does not implement proprietary or non-standard encryption.
- Network calls use Apple/WebKit-provided HTTPS. Capacitor's CommonCrypto usage is a
  SHA-256 hash for an app identifier, not encryption.
- Expected App Store Connect result: no encryption documentation required.

### Content rights

- Select **Yes**, the app accesses third-party content.
- Confirm BlackPyre has the necessary rights.
- Packaged-food data comes from Open Food Facts under the Open Database License; the
  product information is attributed in-app and in the public third-party notices.
- BlackPyre does not bundle Open Food Facts product images.
- Exercise video search opens YouTube externally and does not reproduce video content.

### Regulated medical device

- Declare **No** for the U.S., EU/EEA, and UK.
- BlackPyre is a general wellness tracker. It is not cleared, registered, marked, or
  self-certified as a medical device and does not diagnose, prevent, monitor, or treat a
  disease or physiological condition.

### Digital Services Act

The Account Holder must self-assess. Because BlackPyre is intended to be a paid download,
Apple's published factors indicate that the account is likely acting as a **trader** if
the app is distributed in the EU. A trader must provide Apple a verified public address
or P.O. Box, phone number, and email address. If the EU is excluded, trader status must
still be declared but public EU trader details are not needed for that app.

## 6. App Review information

### Sign-in

No sign-in is required. BlackPyre has no account and needs no demo credentials.

### Review notes

BlackPyre is an iPhone-only, portrait, account-free nutrition and training tracker. All
primary user data is stored locally. No BlackPyre server, advertising, or analytics SDK
exists, and Settings > Data & recovery > Erase all BlackPyre data provides complete local
deletion.

Native capabilities and how to exercise them:

1. Apple Health — Settings > Apple Health; connect and choose individual read permissions.
   Imported values are aggregate-only, device-only, backup-excluded, and optional. When
   Workout Sharing is on, a newly logged same-day workout with an explicit recorded exercise
   duration can be written to Apple Health. Time spent on the draft screen is never counted;
   drafts, edits, historical entries, and sessions without explicit duration are not written.
2. Camera barcode scanning — Food > Scan barcode. Camera access is used only for food
   barcodes. The user must verify returned nutrition against the package before logging.
3. Rest timer Live Activity — start a rest timer from Train. On supported iPhones it
   appears in the Dynamic Island; it also appears on the Lock Screen while active.
4. Local notifications — start a rest timer from Train. Notifications are local only.
5. Files backup/import/share — Settings > Data & recovery. Backups can be saved locally or
   shared elsewhere; Health data is excluded.
6. Offline operation — nutrition history, saved foods, training, weight, measurements,
   water, and settings work without a connection. Only online food lookup and external
   links require connectivity.
7. Native Vault — Settings > Data & recovery exposes device-only recovery status and
   restore controls. Protected mode prevents destructive writes when recovery is needed.

Online packaged-food search sends only search words or a barcode plus ordinary network
metadata to Open Food Facts. BlackPyre does not send the user's logs, targets, name,
weight, or training history. AI tools are user-directed copy/paste handoffs; the app never
contacts an AI provider. No account-deletion flow is applicable because no account exists.

Youth-specific equations provide age-appropriate estimates for users 13 and older rather
than silently applying adult equations. Onboarding directs teen users to involve a parent
or guardian and reminds every user that BlackPyre is not medical advice.

BlackPyre is not a regulated medical device. It provides general wellness tracking and
does not diagnose, prescribe, prevent, monitor, or treat disease.

### Review contact — owner must complete

- First and last name: Ryan Allen Wilsey
- Email: enter privately in App Store Connect; do not commit it.
- Phone: enter privately in App Store Connect; do not commit it.

## 7. Screenshot set

The completed master set is in `APP-STORE-SCREENSHOTS/iphone-6.9/`. Every upload file is
1320 × 2868 portrait JPEG with no alpha channel and uses the native candidate with a
fictional screenshot-only profile. Upload these eight frames in order:

Use fictional data only. Never capture RAW's personal data.

1. Home — daily nutrition, water, weekly summary, and progress.
2. Food — totals, meal sections, and quick-log choices.
3. Barcode — returned nutrition inside the verification workflow.
4. Train — current program and today's session.
5. Rest timer — active floating timer during a training session.
6. Weight — fictional dated entry and weight trend.
7. Apple Health — optional signal access and workout-sharing controls.
8. Data & recovery — backup, external save, restore, and Native Vault controls.

Never capture RAW's personal data. Screenshots must contain no diagnostic identifiers,
real health values, notifications, or third-party AI content.

## 8. Resolved decisions and direct-entry fields

The minimum deployment target is decided: iOS 16.1 for both the app and Live Activity
extension. Floor-version device validation remains part of the final TestFlight matrix,
not an open App Store Connect decision.

1. Review contact: Ryan Allen Wilsey. The private email and phone are direct-entry values
   in App Store Connect and are intentionally excluded from version control.
2. DSA: BlackPyre 1.0 launches outside the EU, so the app is not acting as a trader on the
   EU App Store. The Account Holder must still complete Apple's required DSA declaration
   directly in App Store Connect. EU availability can be reconsidered later with verified
   trader contact information if required.
3. Initial country and region: United States only.
4. Web disposition: keep the web app live. It remains a supported companion product and
   is not scheduled for retirement after iOS approval.
5. Screenshot dataset and capture: complete. The reproducible fictional seed tool is
   `scripts/prepare-app-store-screenshots.js`; the upload set and checksum manifest are in
   `APP-STORE-SCREENSHOTS/`.
6. App Store Connect access: the login endpoint was reached on August 12, 2026. Account
   authentication, private contact entry, distribution signing, and upload begin in Phase 5.

Price, banking, tax, paid agreement, and Small Business Program enrollment belong to
Phase 4a rather than this metadata packet.
