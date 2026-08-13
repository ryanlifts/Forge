# BlackPyre Phase 4a — Paid Distribution Setup

**Date:** August 12, 2026

**Platform:** iPhone

**Commercial model:** One-time paid download; every feature included

**Initial storefront:** United States only
**Status:** IN PROGRESS — Apple Developer Program membership activated and App Store
Connect access confirmed August 13, 2026. The Paid Apps Agreement remains `New` and
requires the Account Holder to update legal-entity information before signing it.

## Release decision

BlackPyre 1.0 is a one-time paid download. It has no subscription, free trial,
introductory offer, In-App Purchase, paywall, receipt-validation layer, or feature gate.
Apple controls access to the paid download; the installed app remains complete,
account-free, server-free, and local-first.

## Recommended launch price

**US $14.99 one time — approved by Ryan on August 12, 2026.** It positions BlackPyre
above low-cost single-purpose trackers while
remaining far below the first-year cost of leading subscription nutrition apps. The
price can be changed later without an application update.

Base country or region: **United States**. App availability: **United States only**.

## Account Holder checklist

These items contain legal, tax, identity, or financial information. Complete them
directly in App Store Connect; never add those values to this repository.

- [x] Activate the Apple Developer Program membership. A free Apple developer account
      supports local device testing but cannot distribute through TestFlight or the App Store.
- [x] Confirm App Store Connect opens without the `not enabled` account error.
- [ ] Sign the current Paid Apps Agreement under **Business > Agreements**.
- [ ] Add the primary bank account under **Business > Agreements > Banking**.
- [ ] Submit the required U.S. tax form. A U.S.-based individual is normally prompted
      for Form W-9 and a taxpayer identification number; follow the form presented by
      Apple and consult a tax professional if the correct treatment is uncertain.
- [ ] Confirm the Paid Apps Agreement reaches **Active** status. Processing by Apple is
      acceptable while pending, but Phase 4a does not exit until it is active.
- [ ] Enroll in the App Store Small Business Program and disclose every Associated
      Developer Account, if any.
- [ ] Confirm Small Business Program approval and the reduced commission effective date.
- [x] In **Apps > BlackPyre > Monetization > Pricing and Availability**, select the
      United States as the base country or region and set the approved one-time price.
- [x] Set app availability to the United States only.
- [ ] Confirm the pricing and availability pages show no subscription or In-App Purchase.

## Evidence to record without private values

Record only statuses and dates here after completion. Do not record bank numbers,
routing numbers, taxpayer identifiers, addresses, phone numbers, email addresses,
security codes, or screenshots containing them.

| Item | Status | Date |
|---|---|---|
| Apple Developer Program | Active | August 13, 2026 |
| App Store Connect access | Active; BlackPyre record created | August 13, 2026 |
| Paid Apps Agreement | New; legal-entity update required | August 13, 2026 |
| Banking | Pending Account Holder | — |
| U.S. tax form | Pending Account Holder | — |
| Small Business Program | Pending enrollment | — |
| Base region | United States — configured | August 13, 2026 |
| Price | $14.99 — configured in App Store Connect | August 13, 2026 |
| Availability | United States only — configured | August 13, 2026 |

## Authoritative Apple references

- Paid Apps Agreement: <https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/>
- Apple Developer Program enrollment: <https://developer.apple.com/programs/enroll/>
- Tax information: <https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/>
- Banking information: <https://developer.apple.com/help/app-store-connect/reference/reporting/banking-information/>
- App pricing: <https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/>
- Availability: <https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store/>
- Small Business Program: <https://developer.apple.com/app-store/small-business-program/>

## Exit gate

Phase 4a is complete only when Apple Developer Program membership is active, the Paid
Apps Agreement is active, banking and tax are
accepted, Small Business Program enrollment is approved, the one-time price is set, and
United States paid availability is verified in App Store Connect.
