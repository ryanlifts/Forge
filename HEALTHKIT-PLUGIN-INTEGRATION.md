# BlackPyre HealthKit Plugin Integration

Selected package: `@flomentumsolutions/capacitor-health-extended`
Pinned version: `0.8.3`
License: MIT
Repository: https://github.com/Flomentum-Solutions/capacitor-health-extended

## Registry verification

The exact package archive was obtained from the npm registry and verified before installation.

- npm shasum (SHA-1): `fa8b101230c1db5ea160e4a3fe6dc04f18abe373`
- npm integrity (SHA-512): `sha512-gA/DtCvWreSDCykX7ZvFQHJlHTc+dH9yJO69T1dQ+qlU9XaKQ0wEXhDJg6XHaxc78RbtnKjT/4Kvz0QChZM6pw==`
- Peer requirement: `@capacitor/core >=8.0.0`
- BlackPyre Capacitor version at selection: `8.5.0`

## Selection rationale

The adapter supports all seven approved Phase 2a reads:

- body weight
- active energy
- steps
- sleep duration
- resting heart rate
- heart-rate variability
- workout heart-rate samples, reduced by BlackPyre to average and maximum only

It also supports HealthKit workout creation through `saveWorkout`, which is required for BlackPyre's approved workout write-back. The other leading maintained Capacitor 8 candidate was not selected because it did not expose workout writing.

BlackPyre never persists routes or raw heart-rate samples returned by the adapter. The app converts them to the source-agnostic aggregate contract in `HEALTH-DATA-CONTRACT.md` and discards the raw arrays.

The full MIT license is bundled at `vendor/capacitor-health-extended.LICENSE.txt`.
