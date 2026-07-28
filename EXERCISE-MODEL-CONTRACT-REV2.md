# BlackPyre Exercise Model — WEB IMPLEMENTATION BRIEF
**Contract revision 2** — baseline verified at v75 (commit 6ab365ff); B7 identity rules added.

You are implementing the unified exercise library + exercise-defined tracking for the
BlackPyre WEB app (repo: Forge-web-ai-defaults, branch origin/main, release v75+).

**Read this whole document before writing code. Section B (THE CONTRACT) is shared
verbatim with the native iOS thread and MUST NOT be modified here. If implementation
reveals a contract problem, STOP and report it to Ryan — both briefs get regenerated
together. Unilateral contract edits are the failure mode this document exists to prevent.**

**Sequencing: WEB GOES FIRST.** This thread implements and freezes the contract in
working code; the native thread consumes it afterward. Nothing here ships to native
until the web gauntlet is green and Ryan approves.

---

## A. BASELINE — VERIFIED (contract revision 2)

Baseline verification was completed and accepted by Ryan:

- Deployed commit `6ab365ff2b92d34f1ccf409ab59d595b30cb6a15`, clean tree.
- Gauntlet: 116 unit + 444 integration = 560 passed, 0 failed. Re-run and match this
  before starting; report the count.
- Primary `SCHEMA_VERSION` = 2. **This feature bumps it to 3** on both platforms.
- Storage preparation/validation/migration/backup/recovery owned by
  `scripts/01-storage.js`.
- Current `sets{}` forms: strings and arrays of `{w,r}` only — matches the contract's
  discrimination baseline.
- History/drafts/programs key on display-name strings; `[Cardio] ` prefix is stripped
  before history keys are written.
- The current library is a plain string array `EXERCISE_LIBRARY` plus `CARDIO_TYPES`
  inside `scripts/01-storage.js`; `data-exercises.js` does not exist yet.

Approved expected drift (normal Section C work): replace the string library with
`data-exercises.js` object entries and remove the conflicting in-slice
`EXERCISE_LIBRARY`/`CARDIO_TYPES` declarations; expand draft validation beyond
strings/arrays; permit `{r}` / `{w:0,r}` rows for the `reps` shape; retire
`[Cardio] ` for new entries while preserving legacy reading; add persistent user
exercises; bump schema 2 → 3.

This contract revision resolves the identity blocker via B7. If any NEW contract
problem surfaces, stop and report — same gate as before.

## Standing invariants (unchanged from the project's permanent rules)

Vanilla HTML/CSS/JS. Classic scripts only, no ES modules, no build step, no framework.
Script execution order is load-bearing. Storage keys are never renamed. The memorial
image is byte-identical, embedded exactly once, and never touched. Tests are cumulative
and never weakened; every release bumps the SW cache; one release per commit; stop
after each release for Ryan's approval with a plain-language report.

---

## B. THE CONTRACT (shared verbatim with native — DO NOT EDIT)

### B1. Exercise library entry

The library is DATA. Shapes are CODE. An entry may never define behavior, formulas,
or rendering rules — it only declares which shape it uses.

```js
{
  id: "bp:bench-press",        // permanent, unique, never reused or deleted
  name: "Bench Press",         // display only; renameable without breaking history
  shape: "lift",               // exactly one of the six shape keys in B2
  tags: ["strength","push"],   // attributes, not containers; controlled vocabulary
  aliases: ["bp","chest press"], // search synonyms — freely editable, carry NO identity
  formerNames: [],             // append-only identity chain (see B7); never edited or reused
  muscles: { primary: ["chest"], secondary: ["triceps","front-delts"] },
  equipment: ["barbell","bench"],
  unilateral: false,
  bodyweight: false,
  deprecated: false            // deprecate-never-delete; hidden from search, valid in history
}
```

- `id` prefixes: `bp:` built-in, `u:` user-created. User exercises exist from day one,
  stored in user data (the myFoods pattern), and can never collide with built-ins.
- `id` is permanent identity for library entries. History, goals, and swaps CONTINUE to
  key on display name in this release (see B5); the identity rules in B7 are what make
  name keys survive renames. Re-keying history to ids is a future, separately approved
  migration.
- Renaming an exercise is non-breaking ONLY via the B7 former-name chain.
- Tag and equipment vocabularies are closed lists checked by tests.

### B2. The six shapes (closed set — new shapes require Ryan's approval on both platforms)

| shape key  | UI collects                          | covers |
|---|---|---|
| `lift`     | sets of weight × reps                | barbell/dumbbell/machine strength (today's default) |
| `reps`     | sets of reps, weight optional        | bodyweight + weighted bodyweight (pull-ups, dips, push-ups) |
| `timeDist` | time, distance optional              | running, walking, rucking, cycling, rowing, swimming, hiking, planks (distance omitted) |
| `carry`    | weight + distance                    | farmer carry, sled, yoke, loaded carries, most strongman |
| `rounds`   | rounds × work-interval × recovery    | sprints, conditioning, EMOM-style. SIMPLE FORM ONLY. |
| `text`     | free text                            | the permanent escape hatch; anything, forever |

REFUSALS (permanent, both platforms): no general interval builder, no per-exercise
custom fields, no user-defined shapes, no formula/expression interpreters in data,
no "measurement builder" UI. The text shape absorbs the long tail.

### B3. Stored history forms (the discriminated union)

`sets{exerciseName}` values, in workout history and drafts:

| stored form | meaning |
|---|---|
| `string` | text entry (legacy and `text` shape) — valid forever |
| `Array of {w?, r}` | set rows. Serves BOTH `lift` and `reps` (shape drives UI; storage is identical). `w` may be absent/0 for bodyweight sets. Legacy `{w,r}` arrays are this form — NO migration of existing history. |
| `{t:"timeDist", secs, dist?, distUnit?}` | `distUnit` ∈ `"mi","km","m","ft"`. Store what the user entered; NEVER convert-and-store. |
| `{t:"carry", lbs, dist, distUnit}` | same unit rules |
| `{t:"rounds", rounds, workSecs, recSecs, note?}` | simple form only |

Rules:
- STORE PRIMITIVES, DERIVE METRICS. Pace, e1RM, volume, totals are computed at read
  time and never persisted.
- Readers discriminate: string → text; Array → set rows; object with `t` → typed.
  Unknown `t` values must render read-only as raw values with a "newer version"
  notice and MUST NOT be dropped, rewritten, or crash the reader.
- Old data is never migrated in this release. New forms are additive.

### B4. Read-time derivations (identical definitions on both platforms)

- `lift` / weighted `reps`: best e1RM via Epley `w*(1+r/30)`, reps>30 excluded.
- unweighted `reps`: max reps in a set.
- `timeDist`: with distance — best pace (secs/dist) per distance bucket, longest dist;
  without — longest secs.
- `carry`: heaviest lbs (any distance) and longest dist at that weight.
- `rounds`: no PR derivation in v1 (display history only).

### B5. Identity & compatibility rules

- History keys remain display-name strings this release, governed by the identity and
  naming rules in B7. The `[Cardio] ` name-prefix convention is retired for NEW entries
  (shape replaces it) but remains readable forever.
- `schemaVersion` bumps 2 → 3 on BOTH platforms, in the SAME release wave. Older-app protection (refusing newer data)
  must be verified to cover the new forms.
- Backups and restores must round-trip every form in B3 in both directions:
  web-created backup → native restore (including Native Vault) and native → web.
  THE CROSS-PLATFORM RESTORE TEST IS THE ACCEPTANCE GATE FOR THIS FEATURE.


### B7. Identity & naming rules (added after web-thread contract review — the blocker fix)

Because history is name-keyed this release, names function as identity. These rules make
that safe on both platforms:

- **Normalization (identical on both platforms):** trim, collapse internal whitespace
  runs to single spaces, lowercase. All uniqueness and resolution below operate on
  normalized names.
- **Global uniqueness:** across built-ins AND user exercises together, the union of
  every entry's name, aliases, and formerNames must be collision-free. The library
  lint enforces this for built-ins; user creation and rename must reject any name
  that collides with anything in the union.
- **Renaming (built-in or user):** the previous normalized name is appended to that
  entry's `formerNames`, permanently. `formerNames` is append-only: entries are never
  removed, edited, or reassigned to another exercise — ever, across all future
  releases. `aliases` remain freely editable and carry no identity.
- **Historical resolution order:** exact current name → unique `formerNames` match →
  legacy fallback (render as before this feature existed). If resolution is ever
  ambiguous, it falls to the legacy fallback — it never guesses.
- **Future built-in collision tiebreak:** if a library update introduces a built-in
  whose name/alias/formerName collides with an existing user exercise, the USER entry
  wins resolution for that name (its history predates the built-in). The built-in
  remains reachable by its id and its other names. This is the only permitted
  collision, and it is resolved deterministically, not reported as corruption.
- **User exercise deletion:** a user exercise referenced by any history may only be
  ARCHIVED (hidden from search, valid for resolution) — mirroring built-in
  deprecate-never-delete. Hard deletion is permitted only when no history, draft,
  goal, or program references its name or formerNames.
- Unknown historical names (predating this feature, or from newer data) remain
  readable via the legacy fallback, always.

### B6. Library file

One canonical file, `data-exercises.js`, IDENTICAL BYTES on both platforms, generated
once and copied — never independently edited. Classic script defining
`const EXERCISE_LIBRARY = [...]`. Target 150–300 well-curated entries at launch;
public-domain or self-authored data ONLY (share-alike datasets like wger are
prohibited — the OFF/ODbL lesson applies). Library updates ship like code: same
release ritual, both platforms.

— END OF CONTRACT —

---

## C. WEB-SPECIFIC IMPLEMENTATION GUIDANCE

1. **Delivery:** `data-exercises.js` loads with the other data payloads before the
   app slices; add to sw.js SHELL; bump cache. Static data — it never touches
   localStorage quota.
2. **Shapes engine:** one renderer + one validator + one derivation function per
   shape, in the training slice. The existing text mode becomes the `text` shape;
   the existing rows UI becomes `lift`/`reps`. Reuse the exercise-level
   Save/Completed/Edit + unsaved-warning flow unchanged — shapes change WHAT is
   collected, never the save lifecycle.
3. **Search:** extend the existing exercise search over name + aliases + tags with
   the same scoring style as food search. Deprecated entries hidden. User-created
   exercises (choose shape at creation) surface alongside built-ins.
4. **Programs:** program days reference exercises; a triathlon-style day is just
   three timeDist exercises — no session-mode concept. The dedicated cardio session
   type remains readable but new programs use shapes.
5. **Rest-timer separation:** the `rounds` shape ships as DATA ENTRY ONLY. No
   timer-driven guided intervals in this release — that is a separate future
   feature. Do not couple them.
6. **Draft compatibility:** the persisted workout draft must carry every B3 form
   through save/resume/discard unchanged.
7. **Tests (cumulative, added this release):** a library lint walking every entry
   (unique ids, valid shape keys, closed vocabularies, alias collisions, no
   behavior-like fields); per-shape validator/renderer/derivation units; history
   round-trips for every form; unknown-`t` read-only handling; draft round-trips;
   backup/restore including mixed old+new histories and a range-era legacy backup;
   schema bump + newer-version refusal on the new forms.
8. **Deliverables:** changed-file ZIP mirroring repo paths, README-DEPLOY.txt,
   plain-language report, exact new gauntlet count, and the FROZEN
   `data-exercises.js` + this contract handed to the native thread. Then STOP for
   Ryan's approval.