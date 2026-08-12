# BlackPyre iOS — Phase 3 Release QA

**Date:** August 12, 2026  
**Branch:** `native-ios-main`  
**Baseline:** `f027ed7` (`Close Phase 2a Health verification gaps`)  
**Status:** In progress; automated, build, small-screen, and RAW upgrade checks are green.

## Completed in this pass

- Full native gauntlet: **1,221 passed, 0 failed**.
- Added a permanent Phase 3 release-QA suite covering device family, orientation,
  safe areas, keyboard focus, Reduce Motion, Dynamic Type, editable-control sizing,
  and color contrast.
- Fixed native Larger Text support. BlackPyre now responds to the iOS text-size setting
  without page zoom, keeps the decorative brand header stable, reflows body text, and
  applies the setting to content rendered after launch.
- Clean install exercised on an iPhone SE (3rd generation) simulator running iOS 26.5.
- Small-screen checks exercised at standard and maximum accessibility text sizes.
- Physical Larger Text validation passed on RAW at the maximum accessibility size;
  text enlarged and reflowed correctly without clipping or broken cards.
- Physical Display Zoom validation passed on RAW without broken layout or navigation.
- Physical VoiceOver validation passed on RAW.
- Physical permission-denial validation passed on RAW for Notifications, Health, and
  Camera. Denied, partial, and revoked access caused no crash, data loss, or loss of
  unrelated app functionality.
- Physical lifecycle validation passed on RAW: existing local features remained usable
  offline, training drafts survived backgrounding, a saved entry survived immediate
  forced termination, and online barcode service resumed after reconnecting.
- Primary, secondary, accent, warning, and success colors meet WCAG AA contrast against
  their shipped backgrounds.
- Root, `www`, and native-public `index.html` parity remains byte-identical:
  `9c3ede667c8df71c1b5df99ff49fec01cc523701e21796f32655f80cb0c19707`.
- A fresh signed Release archive completed successfully and passed Xcode's local
  `validate-for-store` check.
- Archive metadata: bundle `com.blackpyre.app`, version `1.0`, build `2`, arm64,
  iPhone only, portrait only.
- Release executable SHA-256:
  `6fb9676c6a797075975658dbd333992ea008b2307bcde36558b6f58786d3e8d1`.
- The Release build was installed **update-in-place** on RAW without uninstalling, then
  launched successfully. The app process remained running after launch.

## Remaining Phase 3 validation

These checks cannot honestly be closed by source inspection or the current local device
matrix:

1. Install the final candidate through TestFlight and repeat the zero-data walkthrough:
   onboarding, first food log, first workout, and first backup.
2. Repeat the TestFlight install as an update over the prior public candidate and verify
   all personal history remains present.
3. Hands-on touch-target review. Physical Larger Text, Display Zoom, and VoiceOver
   validation are complete.
4. Repeat the now-passing background/offline/reconnect and forced-termination checks on
   the final TestFlight candidate. Notification permission allowed and denied is complete.
5. On a clean TestFlight install, exercise backup, restore, and corrupt-file recovery.
6. Workout write-back remains deferred until a timed workout can be completed accurately.
   Health permissions granted, denied, partially granted, and revoked after grant are
   complete on RAW; the Phase 2a real-device read path is also verified.
7. Validate the actual minimum supported iOS version. The project currently declares
   iOS 15.0, but this pass had only iOS 26.5 simulation and iOS 27.0 hardware available.
   Do not claim Phase 3 complete until iOS 15 is tested or the deployment target is
   raised to a version represented in the final device matrix.

## Release decision

No release-blocking defect was found in the checks completed here. Phase 3 remains open
only for the final TestFlight lifecycle, hands-on accessibility/permission paths, and an
honest minimum-iOS decision. No App Store upload was performed in this pass.
