# BlackPyre Phase 1 — Nutrition Safety Web-Parity Handoff

Completed: 2026-08-01

Native implementation: `~/Documents/Forge`
Purpose: a standalone contract for matching the native Phase 1 nutrition-safety release in the web app.

## Completion status

- Focused nutrition-safety suite: 54 passed, 0 failed.
- Unit suite: 168 passed, 0 failed.
- Integration suite: 715 passed, 0 failed.
- Exercise-card profile suite: 56 passed, 0 failed; all 203 canonical exercises covered.
- Total: 993 passed, 0 failed.
- Canonical source was copied to `www` and synchronized into the iOS payload.
- Unsigned iPhoneOS Release build succeeded.
- Signed Debug build succeeded, installed over the existing app on RAW, and launched successfully.
- Protected `ios/App/App.xcodeproj/project.pbxproj` and `ios/debug.xcconfig` hashes remained unchanged.
- No staging, commit, push, web deployment, TestFlight upload, or App Store submission occurred.

## Exact web behavior to match

### 1. One validation contract everywhere

Use shared constants and validators rather than screen-specific copies.

| Rule | Value | Boundary behavior |
|---|---:|---|
| Minimum daily calorie target | 1,200 kcal | 1,200 accepted; 1,199 rejected |
| Maximum supported calorie input | 10,000 kcal | Input-sanity boundary, not a clinical recommendation |
| Supported age | 13–100 | Inclusive; under 13 rejected with an explanation |
| Supported height | 48–96 total inches | Inclusive; inches must be 0–11 |
| Supported weight | 50–700 lb | Inclusive |
| Activity values | 1.2, 1.375, 1.55, 1.725, 1.9 | Reject anything else |
| Goal adjustments | −1,000, −500, −250, 0, +250 kcal | All remain available to teens and adults |

The 1,200 floor applies to first-run and Settings calculator results, manual targets, every preset/custom schedule day, and log-derived proposals. Do not silently clamp. Reject the requested action, preserve prior saved state, and say what must change.

### 2. Ages 13–17: complete access with youth-specific math

Teen users retain every goal rate, macro preset/custom control, Apply action, and calorie-scheduling option. Guidance is visible but never disables those controls.

Use the 2023 Dietary Reference Intake estimated energy requirement equations. Convert pounds to kilograms with `lb × 0.4536` and total height inches to centimeters with `inches × 2.54`.

For ages 14–17, add 20 kcal growth energy. For age 13, add 25 kcal for male or 30 kcal for female.

Male EER:

| Activity | Equation before growth addition |
|---|---|
| Inactive (1.2) | −447.51 + 3.68×age + 13.01×cm + 13.15×kg |
| Low active (1.375 or 1.55) | 19.12 + 3.68×age + 8.62×cm + 20.28×kg |
| Active (1.725) | −388.19 + 3.68×age + 12.66×cm + 20.46×kg |
| Very active (1.9) | −671.75 + 3.68×age + 15.38×cm + 23.25×kg |

Female EER:

| Activity | Equation before growth addition |
|---|---|
| Inactive (1.2) | 55.59 − 22.25×age + 8.43×cm + 17.07×kg |
| Low active (1.375 or 1.55) | −297.54 − 22.25×age + 12.77×cm + 14.73×kg |
| Active (1.725) | −189.55 − 22.25×age + 11.74×cm + 18.34×kg |
| Very active (1.9) | −709.59 − 22.25×age + 18.22×cm + 14.25×kg |

Round maintenance EER, then add the selected goal adjustment and round the target. Recommended youth macros use 20% protein / 55% carbohydrate / 25% fat, converted with 4 kcal/g for protein and carbohydrate and 9 kcal/g for fat.

UI copy must say that ages 13–17 use a youth-specific equation and starting split and should review weight-change/macro goals with a parent or guardian and a pediatrician or registered dietitian. It must not imply that teen controls are locked.

Do not treat the adult multiplier values as literal youth PAL values. Translate by the visible choice and total-movement meaning:

- Sedentary → Inactive;
- Light → Low active;
- Moderate → Low active, with the label “Low active + exercise”;
- Very active → Active, requiring high daily movement plus frequent exercise;
- Athlete → Very active, requiring vigorous daily work or hard training.

When teen mode is active, replace workout-count-only labels with those total-daily-movement descriptions and show the selected youth activity category in the result. Restore the adult labels at age 18+.

Reference vector: male, age 17, 5 ft 8 in, 150 lb, Moderate/1.55, goal −500 uses Low active and produces 2,970 kcal maintenance and 2,470 kcal target; Recommended rounds to 124 g protein, 340 g carbohydrate, and 69 g fat.

### 3. Ages 18–100: adult calculation

Adults continue to use Mifflin-St Jeor:

- male BMR = `10×kg + 6.25×cm − 5×age + 5`;
- female BMR = `10×kg + 6.25×cm − 5×age − 161`;
- TDEE = BMR × selected activity value;
- target = rounded TDEE + selected goal adjustment;
- Recommended protein = rounded pounds × 0.9;
- Recommended fat = rounded target calories × 25% ÷ 9;
- Recommended carbohydrate = the non-negative rounded calorie remainder ÷ 4.

The −1,000 kcal option displays an aggressive-goal warning when valid. Any adult or teen result below the shared floor is rejected instead of shown as success.

### 4. Calculator feedback and visible errors

Validation occurs before output, success feedback, or persistence.

On rejection:

- clear the last usable in-memory calculation;
- hide stale output so an old result cannot be applied;
- show a specific inline error immediately below Calculate;
- mark the related input with `aria-invalid="true"`;
- do not turn Calculate green and do not save the invalid inputs.

For a below-floor teen result, explain the estimated number, the 1,200 floor, choosing a slower goal, and review with a parent/guardian and pediatric professional. Adult floor copy directs the user to choose a slower goal or talk with a qualified clinician.

On success:

- clear prior inline validation;
- show maintenance and selected target;
- show all macro controls and the separate Apply action;
- briefly turn Calculate green and label it “✓ Calculated”;
- keep normal keyboard focus and accessibility behavior.

Persistence contract:

- save the validated calculator weight together with sex, age, height, activity, and goal;
- restore that calculator-specific weight after a complete relaunch;
- do not overwrite it with the bodyweight goal's starting weight or the latest weigh-in;
- for legacy saved settings that have no calculator weight, fall back to the latest weigh-in, then starting weight;
- first-run setup stores its starting weight as the initial calculator weight.

### 5. Manual targets and schedules

Save a validated draft transactionally; any failure preserves all previously stored settings.

- calorie target: 1,200–10,000;
- optional start and goal weights: 50–700 lb;
- protein, carbohydrate, and fat: finite and greater than zero;
- custom schedule: exactly seven safe days, may be under but never over the base weekly budget;
- presets: reject one that creates any day below the floor.

Preset math remains:

- Higher Friday & Saturday: five days at base −100, two days at base +250;
- Higher Saturday & Sunday: five days at base −100, two days at base +250;
- Higher Friday–Sunday: four days at base −150, three days at base +200.

Every failed Settings save shows a persistent inline explanation below Save settings and marks the relevant field/day with `aria-invalid`. Editing a field clears the stale error. A preset failure marks the target and schedule selector. An over-budget custom week identifies all seven day fields.

Do not silently rewrite a legacy stored target below 1,200. Preserve/display it, but block the next target or schedule save until corrected.

### 6. Log-derived metabolism estimate

Use “Estimated metabolism from your logs,” “Estimated TDEE from your logs,” and “Review suggested target.” Never call it measured, actual, or more accurate than a formula.

Eligibility/data quality:

- at most the last 28 days;
- at least four valid weigh-ins;
- at least 14 days from first to last qualifying weigh-in;
- food days between those weigh-ins, excluding today;
- a sufficiently logged day is over 800 kcal;
- require `max(10, ceil(spanDays × 0.70))` sufficiently logged days;
- least-squares weight slope in lb/day;
- estimated TDEE = average logged calories − slope × 3,500;
- reject non-finite/out-of-range results and trends over 3 lb/week in magnitude.

Preserve the last recognized calculator goal adjustment when available. Otherwise use −500 only if saved goal weight is below start weight, else 0. Pass the proposal through the shared calorie safety check.

The action is review-only: open Settings, place the proposal in the manual calorie field, proportionally scale current macros when possible, and require the user to tap Save settings. Do not persist from the review action.

### 7. FAQ, disclaimer, cache, and accessibility

Native FAQ now covers:

- how to set calorie and macro targets;
- complete teen calculator access;
- adult and youth Recommended splits;
- estimated metabolism from logs;
- the revised disclaimer and 1,200 floor.

The disclaimer says ages 13–17 can use the complete calculator with youth-specific math; under 13 and pregnancy/breastfeeding remain outside the calculator’s designed scope. Results are estimates, not medical advice or individualized prescriptions.

The service-worker cache identifier is `blackpyre-v80`, ensuring the calculator-weight persistence fix replaces cached v79 files.

Accessibility contract:

- calculator output uses a polite live region;
- validation uses an assertive live region and visible text;
- `aria-invalid` identifies the field requiring attention;
- errors do not rely on color or an off-screen toast;
- success green appears only after a valid calculation;
- keyboard focus remains visible and usable.

## Native reference locations

- Limits and schedule validation: `scripts/01-storage.js`
- Log-derived estimate: `scripts/04-weight.js`
- Schedule UI warnings: `scripts/05-ai.js`
- Setup, calculators, youth equations, inline validation, and transactional Settings save: `scripts/06-settings.js`
- UI bounds, notes, live regions, disclaimer: `index.html`
- FAQ: `data-faq.js`
- Cache bump: `sw.js`
- Focused coverage: `tests/phase1-nutrition-safety.test.js`
- Full integration coverage: `tests/integration.test.js`

`tools/prepare-native.sh` copies canonical root assets to generated `www` and runs Capacitor sync. Web work must edit its own canonical source and should not copy the native generated-directory workflow.

## Verification evidence

```text
npm run test:nutrition-safety
PHASE 1 NUTRITION SAFETY: 54 passed, 0 failed

npm test
PHASE 1 NUTRITION SAFETY: 54 passed, 0 failed
UNIT: 168 passed, 0 failed
INTEGRATION: 715 passed, 0 failed
CARD PROFILE TESTS: 56 passed, 0 failed
```

```text
xcodebuild ... -configuration Release ... CODE_SIGNING_ALLOWED=NO build
** BUILD SUCCEEDED **

xcodebuild ... -configuration Debug ... build
** BUILD SUCCEEDED **

xcrun devicectl device install app ...
App installed: com.blackpyre.app
xcrun devicectl device process launch ... com.blackpyre.app
Launched application with com.blackpyre.app bundle identifier.
```

## Authoritative rationale

- [2023 Dietary Reference Intakes youth EER equations](https://www.ncbi.nlm.nih.gov/books/NBK588659/) provide the age/sex/activity youth formulas used here.
- [American Academy of Pediatrics teen diet guidance](https://www.healthychildren.org/English/ages-stages/teen/nutrition/Pages/Fads-and-Diets.aspx) supports reviewing adolescent weight-loss diets with a pediatric professional.
- [American Academy of Pediatrics youth-athlete guidance](https://www.healthychildren.org/English/healthy-living/sports/Pages/Weigh-Ins-Weight-Gain-Rules-for-Teen-Athletes.aspx) gives a typical youth-athlete range that includes the 20/55/25 starting split.
- [NIDDK calorie guidance](https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-type-2-diabetes/game-plan) says fewer than 1,200 calories/day is not advised; BlackPyre uses 1,200 as a universal self-directed-use floor.
- [Apple age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) classify health/wellness content for rating disclosure; they do not impose an adults-only calculator rule.

The 10,000 maximum, height/weight ranges, 70% log-coverage threshold, and 3 lb/week estimate-rejection threshold are product/data-quality guardrails, not medical prescriptions.

## Native-only exceptions and remaining work

- Native uses Capacitor and installs a signed development build; web does not copy those steps.
- Green animation timing can differ slightly, but web must match valid-only semantics and the visible label/state.
- Phase 2 owns removal of the bundled USDA credential and food-source resilience.
- App Store/TestFlight submission remains Phase 6 and requires explicit owner approval.

## Copy-ready web checklist

- [ ] Support ages 13–100 and reject under 13 with a visible explanation.
- [ ] Implement the exact youth equations, activity mapping, growth additions, reference vector, and 20/55/25 Recommended split.
- [ ] Use total-daily-movement teen labels; map Moderate conservatively to Low active and show the selected youth category in results.
- [ ] Keep every goal, macro, Apply, and scheduling control enabled for ages 13–17.
- [ ] Apply the shared 1,200–10,000 contract to every calculator, manual target, schedule day, and log-derived proposal.
- [ ] Clear stale calculation output and block green feedback on every rejection.
- [ ] Persist and restore the calculator's validated weight independently; preserve the legacy latest-weigh-in/start-weight fallback.
- [ ] Put persistent inline errors beside Calculate/Save and mark related inputs semantically.
- [ ] Keep Settings saves transactional.
- [ ] Preserve the exact preset math and weekly-budget rules.
- [ ] Match the log-derived estimate eligibility and review-only flow.
- [ ] Update FAQ/disclaimer language and bump the web cache/version so users receive it.
- [ ] Add the teen reference vector and all boundary/persistence/accessibility regressions.
- [ ] Run focused tests, the complete web suite, and a production build.
- [ ] Record any intentional web-only deviation explicitly.
