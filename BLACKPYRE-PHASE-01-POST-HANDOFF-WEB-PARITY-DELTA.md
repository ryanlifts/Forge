# BlackPyre Phase 1 — Post-Handoff Web-Parity Delta

Prepared: 2026-08-01

Native source: `~/Documents/Forge`

Scope: changes made after the earlier Phase 1 web-parity handoff and accepted on the RAW iPhone.
Relationship to earlier handoff: this document supersedes the earlier calculator age, youth calculation, validation-feedback, calculator-input persistence, FAQ, cache, and verification sections. All other Phase 1 requirements remain in force.

## Outcome

The native iOS app now:

- supports ages 13–17 in the complete calorie and macro calculator without age-based control lockouts;
- uses the 2023 Dietary Reference Intake youth energy equations for ages 13–17;
- translates teen activity conservatively from total daily movement rather than workout count alone;
- uses a 20% protein / 55% carbohydrate / 25% fat Recommended starting split for teens;
- shows specific validation explanations beside Calculate and Save settings;
- turns Calculate green only after a valid calculation;
- persists the calculator's own validated weight across a complete app relaunch;
- retains the universal 1,200 kcal/day safety floor;
- includes matching setup, FAQ, disclaimer, accessibility, and cache changes.

The corrected build was installed and launched on RAW. The owner physically confirmed that calculator weight now survives closing and reopening the app.

## 1. Supported calculator inputs

| Input | Contract |
|---|---|
| Age | Integer 13–100, inclusive |
| Height | 48–96 total inches; inches field 0–11 |
| Weight | 50–700 lb |
| Activity values | 1.2, 1.375, 1.55, 1.725, 1.9 |
| Goal adjustments | −1,000, −500, −250, 0, +250 kcal |
| Daily calorie floor | 1,200 kcal, inclusive |
| Maximum calorie sanity limit | 10,000 kcal, inclusive |

Under 13 is rejected with visible wording that the calculator supports ages 13–100 and is not designed for children under 13. Pregnancy and breastfeeding remain outside the calculator's designed scope.

All goal rates, macro choices, Apply behavior, and calorie schedules remain available for ages 13–17. Guidance must not disable or hide those controls.

## 2. Youth calculation contract, ages 13–17

Convert units first:

- `kg = pounds × 0.4536`
- `cm = total height inches × 2.54`

For ages 14–17, add 20 kcal for growth. At age 13, add 25 kcal for male or 30 kcal for female.

### Male EER

| Youth category | Equation before growth addition |
|---|---|
| Inactive | `−447.51 + 3.68×age + 13.01×cm + 13.15×kg` |
| Low active | `19.12 + 3.68×age + 8.62×cm + 20.28×kg` |
| Active | `−388.19 + 3.68×age + 12.66×cm + 20.46×kg` |
| Very active | `−671.75 + 3.68×age + 15.38×cm + 23.25×kg` |

### Female EER

| Youth category | Equation before growth addition |
|---|---|
| Inactive | `55.59 − 22.25×age + 8.43×cm + 17.07×kg` |
| Low active | `−297.54 − 22.25×age + 12.77×cm + 14.73×kg` |
| Active | `−189.55 − 22.25×age + 11.74×cm + 18.34×kg` |
| Very active | `−709.59 − 22.25×age + 18.22×cm + 14.25×kg` |

Round maintenance EER, add the selected goal adjustment, then round the target. Pass the target through the same 1,200–10,000 validation used everywhere else.

Recommended teen macros:

- protein = rounded `target × 0.20 ÷ 4`;
- carbohydrate = rounded `target × 0.55 ÷ 4`;
- fat = rounded `target × 0.25 ÷ 9`.

Reference vector that the web implementation must reproduce:

| Input/result | Value |
|---|---:|
| Sex | Male |
| Age | 17 |
| Height | 5 ft 8 in |
| Weight | 150 lb |
| Selected activity | Moderate / internal value 1.55 |
| Youth category used | Low active |
| Goal | Lose 1 lb/week / −500 kcal |
| Maintenance EER | 2,970 kcal/day |
| Selected target | 2,470 kcal/day |
| Recommended protein | 124 g |
| Recommended carbohydrate | 340 g |
| Recommended fat | 69 g |

## 3. Corrected teen activity mapping

Do not treat the adult multiplier number as a literal youth PAL. Use this product mapping:

| Stored value | Adult display | Teen display | Youth equation category |
|---:|---|---|---|
| 1.2 | Sedentary (desk job, little exercise) | Inactive (mostly seated; minimal daily movement) | Inactive |
| 1.375 | Light (1–3 workouts/week) | Low active (some daily walking and activity) | Low active |
| 1.55 | Moderate (3–5 workouts/week) | Low active + exercise (daily movement and 3–5 workouts/week) | Low active |
| 1.725 | Very active (6–7 workouts/week or physical job) | Active (high daily movement and frequent exercise) | Active |
| 1.9 | Athlete (2-a-days or heavy labor + training) | Very active (vigorous daily work or hard training) | Very active |

Required behavior:

- switch to the teen descriptions when age is 13–17;
- restore adult descriptions at age 18+;
- do this in both first-run setup and Settings;
- show `Youth activity category: [category]` in a valid teen result;
- explain that teen activity represents the whole day, not workouts alone.

This mapping corrects the earlier overestimate where Moderate/1.55 was treated as Active. The earlier 3,273 maintenance / 2,773 target reference is obsolete and must not remain in web source, tests, help, or cached assets.

## 4. Visible validation and registered-tap feedback

### Calculate rejection

Before returning an error:

- clear the last usable in-memory calculation;
- hide stale results and macro controls;
- do not persist invalid inputs;
- do not show green registered-tap feedback;
- show a specific error directly below Calculate in an assertive live region;
- mark the related field with `aria-invalid="true"`.

Examples:

- Under 13: `The calculator supports ages 13–100. It is not designed for children under 13.`
- Teen below floor: `That goal estimates [value] kcal/day, below BlackPyre’s 1,200 kcal safety floor. Choose a slower goal and review it with a parent or guardian and pediatrician or registered dietitian.`
- Adult below floor: same estimated-value/floor explanation, ending with choosing a slower goal or talking with a qualified clinician.

Editing a calculator input clears the stale inline error.

### Calculate success

Only after a valid calculation:

- show maintenance and selected target;
- expose every macro control and the separate Apply button;
- briefly turn Calculate green;
- temporarily label it `✓ Calculated`;
- preserve visible keyboard focus;
- clear any previous inline error.

The green state is success feedback, not the sole communication channel.

### Manual Settings save rejection

All Settings changes are validated as a draft. A rejection must preserve the previously stored configuration.

Show a persistent inline explanation immediately below Save settings and mark the relevant field(s) with `aria-invalid`:

- unsafe calorie target → calorie target field;
- invalid start/goal weight → corresponding weight field;
- invalid macros → all three macro fields;
- unsafe custom schedule day → the exact day field;
- over-budget custom schedule → all seven day fields;
- unsafe preset → calorie target and schedule selector.

Editing any Settings target/schedule field clears the stale error. A separate off-screen/global toast is not sufficient.

## 5. Calculator weight persistence

This is independent from bodyweight goal and weigh-in data.

On every valid calculation, persist:

```text
calcInputs = {
  sex,
  age,
  ft,
  inches,
  lb,
  act,
  goal
}
```

On render/relaunch:

1. If `calcInputs.lb` is finite and within 50–700 lb, restore it into calculator weight.
2. Do not replace it with starting weight or latest weigh-in.
3. For legacy settings with no valid `calcInputs.lb`, fall back to latest weigh-in.
4. If no weigh-in exists, fall back to starting weight.
5. First-run setup saves its starting weight as the initial calculator weight.

The value is saved only with a valid Calculate action, matching the other calculator fields.

Required regression:

1. Set calculator weight to 190 lb.
2. Complete a valid calculation.
3. Persist state and perform a complete application reboot.
4. Confirm calculator weight is still 190 even when starting weight/latest weigh-in is 225.

## 6. Universal 1,200 kcal floor remains unchanged

The floor applies equally to teens and adults and remains enforced for:

- setup calculator results;
- Settings calculator results;
- manually entered calorie targets;
- each preset schedule day;
- each custom schedule day;
- log-derived target proposals.

Accept 1,200 and reject 1,199. Never silently clamp an unsafe result to 1,200.

## 7. FAQ and disclaimer parity

Update these FAQ answers:

1. **How do I set my calorie and macro targets?**
   - supported ages 13–100;
   - teens use youth equations and retain all controls;
   - 1,200 floor and schedule behavior.

2. **Can teenagers use the calorie and macro calculator?**
   - yes, complete access for ages 13–17;
   - youth equation and 20/55/25 starting split;
   - total-daily-movement activity explanation;
   - Moderate maps to Low active;
   - guidance without locked controls.

3. **What's a macro split and which should I pick?**
   - adult Recommended behavior;
   - youth 20/55/25 Recommended behavior;
   - both are starting estimates, not prescriptions.

4. **Disclaimer & terms of use**
   - complete youth calculator access;
   - parent/guardian and pediatric professional review guidance;
   - under 13 and pregnancy/breastfeeding outside designed scope;
   - estimates are not medical advice;
   - the 1,200 floor does not establish individual medical suitability.

Native FAQ source: `data-faq.js`.

## 8. Cache/update requirement

Native now uses service-worker cache `blackpyre-v80`. The web release must bump its own deploy/cache identifier so old calculator logic, old activity mapping, and old FAQ assets cannot survive the deployment.

Do not blindly copy `blackpyre-v80` if the web app has its own release sequence; use the next valid web identifier and verify old caches are removed/invalidated.

## 9. Native source map

| Behavior | Native reference |
|---|---|
| Shared age/height/weight/calorie limits | `scripts/01-storage.js` |
| Setup, youth equations, activity mapping, errors, calculator persistence | `scripts/06-settings.js` |
| Static calculator UI, notes, live regions, disclaimer | `index.html` |
| FAQ | `data-faq.js` |
| Cache bump | `sw.js` |
| Focused regressions | `tests/phase1-nutrition-safety.test.js` |
| Full relaunch and FAQ/cache regressions | `tests/integration.test.js` |

Generated native directories `www` and `ios/App/App/public` are packaging outputs. The web implementation must modify its own canonical source rather than copying native generated directories.

## 10. Verification evidence

Final native automated evidence:

```text
PHASE 1 NUTRITION SAFETY: 54 passed, 0 failed
UNIT: 168 passed, 0 failed
INTEGRATION: 715 passed, 0 failed
CARD PROFILE TESTS: 56 passed, 0 failed
TOTAL: 993 passed, 0 failed
```

Build/device evidence:

- unsigned iPhoneOS Release build succeeded;
- signed Debug build succeeded;
- corrected build installed and launched on RAW;
- physical calculator-weight relaunch test passed;
- protected Xcode project/signing files remained byte-for-byte unchanged.

## 11. Authoritative references

- [National Academies: Dietary Reference Intakes for Energy (2023)](https://www.ncbi.nlm.nih.gov/books/NBK588659/)
- [National Academies: youth PAL category definitions](https://www.ncbi.nlm.nih.gov/books/NBK591021/)
- [American Academy of Pediatrics: teen diet guidance](https://www.healthychildren.org/English/ages-stages/teen/nutrition/Pages/Fads-and-Diets.aspx)
- [American Academy of Pediatrics: youth-athlete nutrition guidance](https://www.healthychildren.org/English/healthy-living/sports/Pages/Weigh-Ins-Weight-Gain-Rules-for-Teen-Athletes.aspx)
- [NIDDK calorie guidance](https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-type-2-diabetes/game-plan)
- [Apple age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)

## 12. Copy-ready web implementation checklist

- [ ] Change supported calculator age to 13–100 everywhere.
- [ ] Keep all teen goal, macro, Apply, and schedule controls available.
- [ ] Implement the exact male/female youth equations and growth additions.
- [ ] Implement the exact teen activity mapping and total-daily-movement labels.
- [ ] Make the 17-year-old reference vector produce 2,970 maintenance and 2,470 target.
- [ ] Use 20/55/25 for teen Recommended macros.
- [ ] Display the selected youth activity category in teen results.
- [ ] Add inline assertive errors and `aria-invalid` field identification.
- [ ] Preserve green Calculate feedback for valid calculations only.
- [ ] Keep Settings saves transactional and preserve previous state on rejection.
- [ ] Persist `calcInputs.lb` on valid calculation and restore it across relaunch.
- [ ] Preserve legacy latest-weigh-in/start-weight fallback behavior.
- [ ] Apply the 1,200 floor everywhere without silent clamping.
- [ ] Update the four FAQ/disclaimer areas listed above.
- [ ] Invalidate old web caches/assets during deployment.
- [ ] Add focused boundary, activity-mapping, accessibility, persistence, and full-relaunch tests.
- [ ] Run the complete web test suite and production build.
- [ ] Report any intentional web deviation instead of silently changing this contract.

## Copy-ready instruction for the web thread

Implement the attached BlackPyre Phase 1 post-handoff parity delta in the web app's canonical source. Preserve all earlier Phase 1 requirements not explicitly superseded. Add focused regressions for teen equations/activity mapping, inline errors, registered-tap semantics, calculator-weight persistence across a complete relaunch, FAQ copy, and cache invalidation. Run targeted tests, the full web suite, and a production build. Do not deploy until the owner approves the tested web result.
