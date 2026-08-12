# BlackPyre Health Data Contract

Version: 1
Status: Phase 2a release contract
Platforms: Apple HealthKit now; Health Connect adapter later

## Purpose

BlackPyre uses one source-agnostic contract for health data. Platform adapters may differ, but every adapter must produce and consume this exact aggregate shape without changing BlackPyre's primary user-data schema.

## Permanent boundaries

- Health data is a replaceable cache of data whose authority remains Apple Health or Health Connect.
- The cache is stored in its own device-only native file under the logical key `blackpyre:health-cache`.
- `healthFormatVersion` is independent of BlackPyre's primary `schemaVersion`.
- Health data must never be written to `forge:data`, `forge:cfg`, `forge:program`, `forge:lkg`, recovery generations, quarantine, Native Vault, ordinary backup/export files, or storage diagnostics.
- The native cache file must be marked excluded from iOS and iCloud device backup.
- Only daily totals, latest daily values, and per-session averages/maxima are stored. Raw samples, routes, beat-by-beat heart-rate curves, and step timelines are forbidden.
- Losing the cache must not lose user-authored BlackPyre data. BlackPyre re-syncs from the platform source.
- A future Health Connect adapter must fit this contract unchanged.

## Canonical stored shape

```json
{
  "healthFormatVersion": 1,
  "cacheKey": "blackpyre:health-cache",
  "updatedAt": "2026-08-12T18:00:00.000Z",
  "permissions": {
    "bodyWeight": "unknown",
    "activeEnergy": "unknown",
    "steps": "unknown",
    "sleep": "unknown",
    "restingHeartRate": "unknown",
    "heartRateVariability": "unknown",
    "workoutHeartRate": "unknown",
    "workoutWrite": "unknown"
  },
  "daily": {
    "2026-08-12": {
      "bodyWeightKg": {
        "value": 100.4,
        "observedAt": "2026-08-12T12:00:00.000Z",
        "sourceName": "Apple Health"
      },
      "activeEnergyKcal": 612,
      "steps": 8431,
      "sleepMinutes": 438,
      "restingHeartRateBpm": 57,
      "heartRateVariabilityMs": 44
    }
  },
  "workoutHeartRate": {
    "health-workout-id": {
      "startAt": "2026-08-12T15:00:00.000Z",
      "endAt": "2026-08-12T15:42:00.000Z",
      "durationSeconds": 2520,
      "averageBpm": 131,
      "maximumBpm": 166,
      "sourceName": "Apple Health"
    }
  },
  "writeBack": {
    "blackpyre-workout-id": {
      "status": "written",
      "attemptedAt": "2026-08-12T15:43:00.000Z",
      "healthWorkoutId": "health-workout-id"
    }
  }
}
```

## Field rules

### Root

- `healthFormatVersion`: integer, exactly `1`.
- `cacheKey`: exactly `blackpyre:health-cache`.
- `updatedAt`: valid ISO-8601 timestamp.
- `permissions`: one entry for every approved read signal and workout write-back.
- `daily`, `workoutHeartRate`, and `writeBack`: objects; absent data is represented by an absent child record, not a zero invented by BlackPyre.

### Permission states

Each permission value is one of:

- `unknown`: not requested or iOS cannot distinguish denial from no data.
- `available`: a query returned usable data.
- `unavailable`: Health data is unavailable on the device.
- `no-data`: the query returned no recent data; the UI must direct the person to Apple Health or the originating app.
- `denied`: the platform explicitly reported denial.
- `error`: the individual query failed; other signals continue independently.
- `written`: at least one eligible BlackPyre workout was written successfully.

No overall granted flag may conceal a per-type denial or failure.

### Daily aggregates

- Day keys use local calendar dates in `YYYY-MM-DD`.
- `bodyWeightKg.value`: finite positive kilograms; latest value for that day only.
- `activeEnergyKcal`: finite nonnegative daily kilocalories.
- `steps`: nonnegative whole-number daily total.
- `sleepMinutes`: finite nonnegative minutes of actual sleep; in-bed and awake time are excluded.
- `restingHeartRateBpm`: finite positive daily value.
- `heartRateVariabilityMs`: finite positive daily SDNN value.
- Optional `observedAt` and `sourceName` describe the aggregate or latest sample, never raw samples.
- Active energy is displayed beside BlackPyre's logged-trend TDEE. It must never be added to, subtracted from, averaged into, or otherwise used to mutate the TDEE calculation or nutrition targets.

### Workout heart-rate aggregates

- A record represents one platform workout session.
- `startAt`, `endAt`, and positive `durationSeconds` identify the session window.
- `averageBpm` and `maximumBpm` are calculated in memory from platform samples and only the two aggregates are stored.
- Raw heart-rate samples and routes must be discarded before persistence.
- BlackPyre may associate the aggregate with a cardio history entry for display; the aggregate never enters the BlackPyre workout record or its backups.

### Workout write-back

- The key is a stable, non-health BlackPyre workout identifier.
- Status is one of `pending`, `written`, `denied`, `ineligible`, or `error`.
- BlackPyre writes only a real logged session whose saved record has a trustworthy start time, end time, and positive actual duration.
- Planned workouts, drafts, historical records without actual duration, and edited records that cannot be safely reconciled are never written.
- `healthWorkoutId` is stored only after the platform confirms success.
- No calories, distance, route, or heart-rate samples are invented for write-back.

## Retention

The adapter keeps at most:

- 400 local calendar days in `daily`.
- 250 workout aggregate records.
- 500 write-back status records.

Oldest records are removed first. Retention applies only to the replaceable health cache and never deletes BlackPyre-authored history.

## UI and failure behavior

- Permission and query failures degrade per signal.
- Missing data is shown as “Not available” or “No recent data,” never as zero.
- The UI tells the person that Apple Health—or the app/device expected to write there—is the source to check.
- Manual weight entry remains available at all times.
- Revoking one permission must not crash, blank, or disable other BlackPyre features.
- Health access is optional and can be managed from Settings.

## Backup and recovery invariants

Permanent tests must prove that the health cache key, cache file contents, platform workout IDs, and imported health aggregates are absent from:

- normal backup JSON,
- Current/Previous/Older LKG snapshots,
- Native Vault records,
- quarantine and raw recovery exports,
- storage diagnostics,
- primary `forge:data`, `forge:cfg`, and `forge:program`.

The full-data erase path must erase the device-only health cache file.
