# BlackPyre Native Vault — Stage 1

## Purpose

Create a verified native backup of healthy BlackPyre device storage without changing the existing PWA or native app load/save behavior.

## Scope

Stage 1 will:

- run only inside the Capacitor native app;
- read the exact BlackPyre storage strings after the existing v63 validation pipeline succeeds;
- write one JSON vault file to the native iOS Library directory;
- read the file back and verify exact equality;
- update the vault after successful healthy saves;
- retain the previous verified vault if a new write or verification fails;
- expose diagnostic status for testing.

Stage 1 will not:

- automatically restore anything;
- replace localStorage;
- delete or modify localStorage;
- change schemaVersion 2;
- rename any forge:* key;
- affect the GitHub Pages PWA;
- add visible redesigns;
- merge into main.

## Vault contents

The vault will preserve exact strings for:

- forge:cfg
- forge:data
- forge:program
- forge:lkg
- forge:lkg:previous
- forge:lkg:older
- forge:quarantine
- forge:install

It may also preserve the legacy ryan-cut:data string for diagnostic and migration safety.

## Safety rules

1. Only a fully validated persisted state may become the current native vault.
2. Exact strings are stored; values are not reserialized independently.
3. The newly written file must be read back and compared before success.
4. A failed write or mismatch must not damage the previous verified vault.
5. Native vault failure must not cause a healthy normal app save to fail.
6. The PWA must behave exactly as before when Capacitor is unavailable.
7. Every meaningful path receives permanent automated coverage.

## Verified runtime capability

Tested in the iOS 26.5 simulator through the Capacitor Filesystem plugin:

- Capacitor bridge present
- Native platform detected as iOS
- Filesystem plugin available
- File written to the iOS Library directory
- UTF-8 contents read back with exact equality
- Temporary test file deleted successfully

No BlackPyre storage key or user data was read, changed, or deleted during this capability test.
