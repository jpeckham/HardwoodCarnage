# Possession playtest verification

The PRD, design and plan were committed before implementation. Three sequential
implementation tasks received independent spec and quality reviews. The final
whole-branch review covered `41bbd4c..2ba659a` and requested a replay-context print
fix plus two minor improvements; final fix verification is recorded below.

## Automated evidence

- Task 1: strict effective MA, cumulative paths, bounded scatter, recovery,
  last-touch throw-ins and legacy opt-in guards. 102 tests passed after review.
- Task 2: clean swats/reactions, falls, prone passing, ordered release/flight
  contests, aerial/inbound integration and legacy compatibility. 154 tests
  passed after the reviewed six-square alley-oop correction.
- Task 3: actual DOM clicks, persisted replay, movement detours, prone passing,
  exhausted/AI throw-in ownership, save migration, print and callouts.
  Controller independently confirmed 167 tests, typecheck and production build.
- Complete v3 runner: 24 turns, 146 accepted commands, 260 events, 8–6 final
  score, with exact replay reconstruction.
- Fifty v3 seeded matches covered five cyclic faction pairs, five seeds and
  both courts: 7,067 accepted commands, exact replay in every match, no opening
  scores, 44 matches with points, and every faction scored in the sample.

## Pace sample

Fifteen paired Turbo games per rules version used five cyclic roster pairs
and seeds 1, 2 and 17. All thirty final states reconstructed exactly.

| Rules | Opening-turn score | Buckets / team turn | Points / team turn |
| --- | ---: | ---: | ---: |
| v2 | 8 / 15 | .244 | .500 |
| v3 | 0 / 15 | .158 | .342 |

These compare deterministic AI games under their respective rules. They do not
predict balance for skilled human play.

## Review decisions

- Kept the existing deployment checkout/branch; commits remain reversible.
- Used an optional ruleset flag to retain historical replay behavior, at the
  cost of maintaining legacy and current rule paths.
- Allowed minimal Task 1 dispatcher integration so recovery/restarts stop
  queued actions; this shared code received subsequent integration review.
- Allowed exhaustive browser command-label cases during Task 1 to keep the
  expanded command union typechecking before the browser task.
- Applied pass contests to alley-oops and inbounds, including empty-target
  inbounds. This increases defensive pressure on special plays.
- Made shared court metadata ruleset-aware so eligibility and guidance both
  report the six-square v3 launch range; legacy range tests remain.
- Adjusted two previously uncontested inbound fixtures for the newly contested
  rules, retaining ownership/replay assertions and adding dedicated defended
  inbound tests. Full replay fixtures remain command-driven.

## Verification limits

Core and DOM checks cover commands, SVG structure, controls, persistence and
printable markup. Native browser paint, physical print pagination and speech
were not manually verified. Legacy autosaves are retained separately and shown
read-only; starting a new possession match uses a new save slot.

## Final fix

Commit `871a619` makes the print dialog and board follow the displayed replay's
court, clarifies the Swat strength modifier, and checks the clicked destination's
own visible path cost. The cross-court regression first failed for the wrong
dialog/board geometry, then passed with the correction. A fresh controller run
confirmed **168 tests in 11 files**, typecheck and production build all pass.
The single scoped re-review marked all three findings addressed and found no
new breakage. All task gates and the final code-review gate are approved.

## Publication checks

Publish `codex/browser-game` through the existing GitHub Actions Pages workflow.
The controller must wait for that deployment to succeed, fetch the public HTML,
and compare its referenced JavaScript and CSS SHA256 hashes to the final local
build. Final expected assets:

- `index-ClzBH1d2.css`:
  `2c3a74f19dd9e91ff6a0927e8a5bf5ad9527544251f091adee3768b4436e5a37`
- `index-Cpw4Y2HZ.js`:
  `b5e159d0d30f227ae6ca7c13adf98cc1b641799a1dc09b375417c664c69bba6d`

Public URL: https://jpeckham.github.io/HardwoodCarnage/
