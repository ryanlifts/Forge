# Phase 2 Migration Proof — permanent historical record

**Status: PROOF PASSED. Phase 2 approved and deployed as v43.**

This document permanently records the byte-identity proof that the Phase 2
slicing of BlackPyre's application JavaScript preserved the original code
exactly. The live hash-equality test that enforced this was retired in v44 —
the first release that intentionally edits a numbered slice — per the approved
transition plan. This record replaces the live test as the proof of the
migration; the structural invariants that outlive edits (script order, strict
mode, script-tag attributes, slice opening markers) are enforced by separate
permanent tests. Those tests verify different, lasting invariants; this hash
verified the historical migration itself.

## The proof

- **Original:** the single inline application script of v42's index.html.
- **SHA-256:** `63ea5e9bd80a069bdfaeb59c954bdcf521a8593da3cf200569d6719e47d53bba`
- **Size:** 190,324 UTF-8 bytes; 189,847 Unicode characters.

## Exact normalization and concatenation method

1. Take the seven slice files in order:
   `scripts/01-storage.js, 02-food.js, 03-train.js, 04-weight.js, 05-ai.js,
   06-settings.js, 07-boot.js` (their v43 contents).
2. Keep `01-storage.js` exactly as-is — its leading `"use strict";` directive
   is original v42 bytes.
3. From each of slices 02–07 only, remove exactly the leading fourteen
   characters `"use strict";\n` — the directive added during Phase 2
   correction so each separate file executes in strict mode (each classic
   script file is its own parsing/evaluation unit).
4. Concatenate the seven resulting strings in order, with nothing added
   between them.
5. SHA-256 of the UTF-8 encoding of the result equals the hash above.

Verified at migration time (Python hashlib) and continuously by the permanent
suite from v43 until retirement in v44, passing on every run.
