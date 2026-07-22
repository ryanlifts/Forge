# BlackPyre Native Vault — Stage 2

## Purpose

Safely restore exact BlackPyre localStorage strings from the verified native vault when native localStorage is missing or invalid, without overwriting healthy storage or changing PWA behavior.

## Scope

Stage 2 will:

- run only inside the Capacitor native app;
- evaluate native localStorage before onboarding or empty defaults are established;
- leave healthy localStorage completely untouched;
- validate the native vault before using it;
- enter Protected mode while a missing or invalid persisted state is evaluated;
- preserve the current raw localStorage state in a verified native quarantine before restoration;
- restore exact strings rather than reconstructed objects;
- verify every restored key after writing;
- run the existing schemaVersion 2 validation pipeline against the restored primary state;
- report restoration, quarantine, rollback, and verification failures honestly;
- retain the native vault and recovery evidence when restoration fails;
- receive permanent automated coverage before implementation.

Stage 2 will not:

- change schemaVersion 2;
- change native-vault formatVersion 1;
- rename any existing storage key;
- overwrite healthy localStorage;
- clear unrelated localStorage entries;
- redesign the app;
- alter ordinary GitHub Pages PWA behavior;
- merge into main;
- claim complete data protection before real-device testing is complete.

## Contracted storage keys

The restore contract covers the exact stored values for:

- forge:cfg
- forge:data
- forge:program
- forge:lkg
- forge:lkg:previous
- forge:lkg:older
- forge:quarantine
- forge:install
- ryan-cut:data

Each vault property must explicitly contain either:

- the exact original string; or
- null when that key was absent.

The string `"null"` and the value `null` are not interchangeable.

## Healthy localStorage

Native localStorage is healthy only when:

1. forge:cfg, forge:data, and forge:program are present as strings;
2. the existing BlackPyre preparation and validation pipeline accepts them;
3. the accepted state remains schemaVersion 2.

A structurally valid empty user state is healthy.

A valid empty state must not be replaced merely because the native vault contains more user records.

When localStorage is healthy:

- no restore may occur;
- no restore quarantine may be created;
- no localStorage key may be written, removed, or cleared by Stage 2;
- onboarding and normal boot continue through the existing path.

## Missing or invalid localStorage

LocalStorage requires recovery evaluation when:

- one or more required primary keys are absent;
- a required primary value is not a string;
- JSON parsing fails;
- schema validation fails;
- the existing persisted-state validation pipeline rejects the state.

When this occurs in the native app:

1. ordinary boot must pause before onboarding or defaults can replace the incident state;
2. Protected mode must be active while the vault is examined;
3. normal save paths must remain blocked until recovery either succeeds or the incident is explicitly resolved.

## First-install exception

A true first native launch may continue to the existing onboarding flow only when:

- all contracted BlackPyre keys are absent;
- the native vault file is confirmed absent;
- no partial or invalid BlackPyre state is present.

An unreadable, malformed, unsupported, or invalid vault is not equivalent to an absent vault.

A partial localStorage state is not a true first install.

## Native vault validation

The current native vault file may be used only when all of the following are true:

1. the file is read successfully from the iOS Library directory;
2. its contents parse as JSON;
3. type is exactly `blackpyre-native-vault`;
4. formatVersion is exactly 1;
5. schemaVersion is exactly 2;
6. strings is an object;
7. every contracted key exists as an own property;
8. every contracted value is either a string or null;
9. forge:cfg, forge:data, and forge:program are strings;
10. the existing BlackPyre preparation and validation pipeline accepts those three exact primary strings.

Validation must finish before any localStorage mutation.

A candidate file, malformed file, newer unsupported format, wrong schema, incomplete record, or invalid primary state must not be restored.

## Restore quarantine

Before the first restore mutation, Stage 2 must create a separate native restore-quarantine record in the iOS Library directory.

This native restore quarantine is separate from the localStorage key forge:quarantine because forge:quarantine itself must be eligible for exact restoration from the vault.

The restore quarantine must preserve:

- every localStorage key that currently exists;
- every exact raw string value;
- the absence of each contracted BlackPyre key;
- the incident reason;
- the capture time;
- the quarantine format version.

The quarantine must be:

1. written before localStorage is changed;
2. read back;
3. parsed;
4. compared with the captured raw state;
5. verified before restoration begins.

If quarantine writing or verification fails:

- no restore mutation may occur;
- localStorage must remain byte-for-byte unchanged;
- Protected mode must remain active;
- the failure must be exposed diagnostically;
- the verified native vault must remain untouched.

An existing verified restore quarantine must not be silently destroyed.

## Exact restoration

Restoration must use the vault strings directly.

For each contracted key:

- when the vault value is a string, localStorage.setItem must receive that exact string;
- when the vault value is null, the key must be absent after restoration;
- values must not be parsed and independently reserialized;
- whitespace, ordering, and all other string bytes must be preserved.

Stage 2 may modify only the contracted BlackPyre keys.

Unrelated localStorage entries must remain untouched.

## Restore verification

After all restore writes:

1. every contracted key must be read back;
2. every string must exactly equal the vault string;
3. every null vault value must correspond to an absent localStorage key;
4. the three restored primary strings must pass the existing validation pipeline again;
5. the resulting state must remain schemaVersion 2.

Only after every check succeeds may Stage 2:

- mark restoration verified;
- leave Protected mode;
- continue ordinary application boot;
- allow normal save behavior;
- avoid onboarding when the restored state represents an established installation.

The native vault file must remain unchanged by restoration.

## Restore failure and rollback

If any restore write, removal, read-back comparison, or final validation fails:

1. restoration must be reported as failed;
2. Protected mode must remain active;
3. Stage 2 must attempt to restore the pre-restore contracted-key state from the verified native restore quarantine;
4. rollback must preserve exact strings and exact key absence;
5. rollback results must be verified;
6. the native vault and restore quarantine must remain available.

A failed restore must never be presented as successful.

A failed rollback must be reported separately from the original restore failure.

The app must not silently continue with a partially restored mixture of old and new state.

## PWA isolation

When Capacitor native capability or the Filesystem plugin is unavailable:

- Stage 2 performs no native restore work;
- Stage 2 makes no Filesystem calls;
- existing PWA localStorage behavior remains unchanged;
- existing PWA onboarding and recovery behavior remain unchanged.

## Required permanent automated coverage

Tests must be added before restore implementation and must prove at minimum:

1. the ordinary PWA performs no native restore work;
2. healthy native localStorage is never overwritten;
3. a healthy valid empty state is not replaced by a populated vault;
4. missing native localStorage restores from a valid vault;
5. invalid native localStorage restores from a valid vault;
6. exact strings and null key absence are restored;
7. unrelated localStorage entries are preserved;
8. quarantine is written and verified before the first restore mutation;
9. quarantine preserves the complete pre-restore raw localStorage state;
10. quarantine failure leaves localStorage unchanged;
11. malformed vault JSON is rejected;
12. wrong type, formatVersion, or schemaVersion is rejected;
13. incomplete or invalid vault strings are rejected;
14. invalid vaults cannot trigger onboarding or empty-default replacement;
15. restore write failure triggers rollback;
16. restore read-back mismatch triggers rollback;
17. rollback success restores the original exact localStorage state;
18. rollback failure is reported honestly and remains protected;
19. successful restoration passes the existing validation pipeline;
20. successful restoration avoids onboarding and preserves established data;
21. the verified native vault remains byte-identical during restoration;
22. a true first install with no vault can still use the existing onboarding flow;
23. existing Stage 1 backup behavior and all prior tests remain green.

## Completion boundary

Stage 2 is not complete until:

- the contract tests exist;
- the implementation satisfies them;
- the full automated gauntlet passes;
- restoration succeeds in the iOS simulator after deliberately removing or corrupting native localStorage;
- restored strings match the vault exactly;
- the app restarts successfully with the restored data still present.

Real-device testing remains required before claiming that user data is fully protected.
