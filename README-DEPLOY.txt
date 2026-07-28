BlackPyre Web Unified Exercise Model — v76 Candidate

BASELINE
- v75 commit: 6ab365ff2b92d34f1ccf409ab59d595b30cb6a15
- Feature branch: web-unified-exercise-model
- Contract: Exercise Model revision 2

RELEASE CHANGES
- Schema version: 2 -> 3
- Service-worker cache: blackpyre-v75 -> blackpyre-v76
- Canonical library: data-exercises.js (202 entries; freeze this exact file for native)
- Adds six exercise-defined tracking shapes, user exercises, identity/former-name handling,
  typed draft/history support, unknown future-shape preservation, search, and tests.

MANDATORY BEFORE COMMIT OR DEPLOY
1. Apply only to ~/Documents/Forge-web-ai-defaults on web-unified-exercise-model.
2. Run bash tests/run-tests.sh.
3. Remove untracked tests/node_modules after the gauntlet.
4. Physically verify every shape, user-exercise creation, search, drafts, legacy history,
   unknown newer-shape display, and backup/restore.
5. Review the complete diff and changed-file scope.
6. Commit and push the feature branch only after all checks pass.
7. Deploy origin/main only after Ryan explicitly approves.

CROSS-PLATFORM GATE
Native work must copy data-exercises.js byte-identically and use the included
exercise-model cross-platform fixture. The feature is not accepted until web-created
backup -> native restore (including Native Vault) and native-created backup -> web
restore both pass without loss.

==================================================
FINAL V76 VERIFICATION
==================================================
UNIT: 135 passed, 0 failed
INTEGRATION: 507 passed, 0 failed
TOTAL: 642 passed, 0 failed

Exercise manager:
- Archived custom exercises can be restored for new sessions.
- Referenced exercises remain protected from permanent deletion.
- Unused custom exercises may be deleted permanently.
- Open-session swaps and hard deletions rebuild loaded drafts atomically.
- Duplicate session/program identities are blocked before state can collide.
- Failed swap/delete persistence rolls back the complete open-session state.
- Renames cannot merge an exercise into an existing legacy history, draft, goal, program, or open-session identity.
- Historical Cardio edits preserve archived/former activity names, and failed saves keep entered fields intact.
- Future built-in current-name collisions stay out of name-based pickers while remaining reachable by id.
- Final review packages include all 13 tracked and untracked release files.
==================================================
END FINAL V76 VERIFICATION
==================================================
