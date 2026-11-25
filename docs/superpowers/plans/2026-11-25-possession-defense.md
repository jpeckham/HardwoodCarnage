# Possession and Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development, explicitly selected by James. Run one implementer at a time, a fresh task reviewer after each task, and a final whole-branch review.

**Goal:** Make small-court games defensible through exact reduced movement and ball-only contact, scatter, recovery, throw-ins and contested standing/prone passes.

**Architecture:** Version 3 is selected by `MatchConfig.ruleset = 'possession'`.
Optional metadata preserves old replay shapes. Dedicated rules/ball/contact
modules integrate with the serializable Step queue and immutable command API.

**Tech Stack:** existing TypeScript, Vitest, Vite, native DOM/SVG and GitHub Pages.

**Spec:** ../../../blood_bowl_hardwood_carnage_nba_jam_prd.md and ../specs/2026-11-25-possession-defense-design.md.

## Global Constraints

- Turbo stays 9×16; six turns per team per half. Classic stays 15×26/eight.
- New rules version `hardwood-possession/3.0.0`; `config.ruleset = 'possession'`.
  Absent ruleset preserves old v1/v2 behavior and the existing regression suite.
- Effective MA `min(4,max(2,ceil(baseMA/2)))`; exact cumulative path cap, no ground
  GFI or unlimited fire movement; stand costs 1. Prone carriers may pass.
- No body Block/Blitz/Push or armor/injury outcomes in v3. Swats contest the ball.
- D8 scatter order N, NE, E, SE, S, SW, W, NW; four chained recovery/bounce attempts.
- Last touch determines the other team's throw-in. Restart must be resolved before
  ordinary commands, at most one turn switch; inbound within 3 to a teammate/empty tile.
- Preserve deterministic RNG/events/replay and reject illegal commands atomically.
- User requested PRD first, then implementation; the PRD/design/plan are committed
  before any implementation dispatch. Continue through all tasks without another gate.

## Review Focus

- A reaction/recovery/throw-in changing control mid-run must stop all remaining steps.
- Out-of-bounds last touch and halftime/turnover ordering must not invert entitlement.
- A prone carrier is valid in v3; passing, recovery and AI must not assume standing.
- Pass supercover/order/dedup must test nearby release defenders once, not twice.
- Older autosaves/replays must retain their original rules while the new UI defaults to v3.

### Task 1: V3 movement and loose-ball foundation

**Files:** core src/{types,match,court,dice,paths,movement,actions,replay,index}.ts;
create core src/{rules,ball}.ts; create tests/possession-foundation.test.ts.

**Interfaces produced:**
- `isPossessionGame(state): boolean`, `effectiveMA(baseMA): number` in rules.ts.
- `ball.lastTouch?: string`; `state.throwIn?: {team:Side;spot:Position;throwerId:string}|null`;
  `player.reactionTurn?: number`. Existing state/command fixtures without fields stay valid.
- ball.ts exports `markTouch(s,playerId):void`, `scatterBall(s,from,lastTouchId?):void`,
  `recoverBall(s,player):boolean`, `awardThrowIn(s,out,lastTouchId?):void`,
  `performThrowIn(s,playerId,to):void`. Internal mutations operate only on command clones.
- New Command variants `swat` (declared, wired in Task 2), `recover` and `throwIn`.
  Export their typed API via index.ts. Put all shared Step variants needed by Task 2
  in types.ts if convenient; no browser files in this task.

- [ ] Write failing tests for effective MA/standing cost, no extra fire/GFI squares,
  cumulative multi-command path limits and atomic unreachable commands.
- [ ] Write failing tests for deterministic D8, loose recovery/failure, last-touch
  reassignment on failed catches and all-edge throw-in entitlement/owner validation.
- [ ] Run focused tests RED. Implement version selection/config validation, reduced
  stats, backcourt starts (Turbo y2/13, Classic y5/20), six-square shot eligibility,
  strict movement paths and recover/throwIn commands before ordinary actions.
- [ ] Implement bounded scatter/recovery, nearest free boundary thrower (stand for
  restart if needed), inbound catch/empty tile, and half/final supersession. An
  opponent recovery switches team turn once; a restart blocks unrelated commands.
- [ ] Record touches in setup/collectBall; skip legacy burning armor for v3.
  Preserve original API behavior when ruleset is absent. Add full v3 replay tests
  for accepted actions and pending restarts plus config/rules mismatch rejection.
- [ ] Run focused tests GREEN, full npm test and npm run typecheck. Commit and write
  RED/GREEN evidence, changed files and any integration notes to task report.

### Task 2: Clean defense, falls and contested passes

**Files:** create core src/contact.ts and pass-line.ts; modify src/{actions,
movement,resolution,aerial,ai,match,types}.ts; create tests/possession-contact.test.ts.

**Interfaces consumed:** Task 1's isPossessionGame, ball helpers, restart and touch metadata.
**Interfaces produced:** contact.ts exports clean swat/reaction/stumble/pass-contest
helpers; pass-line.ts exports a deterministic supercover line helper. Concrete
signatures may follow the existing Step dispatcher, with new steps fully serializable.

- [ ] Write failing tests for no body-action legality/atomic rejection; a swat
  releases/scatters without knocking the carrier down; automatic movement reactions
  happen on entering/leaving reach once per defender per opponent team turn.
- [ ] Write failing tests for accepted dodge failure causing a prone fall, both
  AG retention and lost-ball outcomes, no injuries, and no double turnover after
  an out-of-bounds restart or opponent recovery during a fall/run.
- [ ] Write failing tests for prone passing without standing, adjacency not disabling
  pass, release strip/bat, route clean interception/bat, multiple contested squares,
  supercover diagonal crossings, stable defender order and release/flight dedup.
- [ ] Run tests RED, implement PRD sections 3/5: active swat 3+ plus Dodge/strength
  penalties; reactions 1–3 miss/4–5 bat/6 clean steal; failed dodge retains normal
  reroll opportunity; fall AG retention; no new body/armor effects.
- [ ] Implement AG release, then path contests, then catch; prone adds 1 to release
  AG. Failed release/catch uses correct last toucher and scatter before its normal
  turnover. Queue execution stops on turn/control change, fall or restart.
- [ ] Keep prepared aerial flair but reduce Turbo launch/throw range to 6, keep
  two-step run-up and remove the fire run-up waiver in v3. Aerial failures fall and
  may retain the ball; glass/fire no longer cause armor or injuries.
- [ ] Update AI for restarts, recoveries, prone passes, legal swats and strict
  movement. Add complete seeded v3 matches with valid occupancy, valid prone/standing
  carrier ownership and exact replay; show all factions lack an opening score and
  defenders can contest a prepared drive. Preserve legacy regression tests.
- [ ] Run focused tests GREEN, full npm test, typecheck and headless match. Commit
  and write the task report with RED/GREEN evidence and control-ordering notes.

### Task 3: Browser rules, guidance, verification and publication

**Files:** apps/web/{main,render,control,effects,tabletop}.ts; style.css as needed;
README.md; runner.ts; UI/persistence regression tests and final validation record.

**Interfaces consumed:** v3 config, effective player.ma, ball.lastTouch, throwIn,
new legal swat/recover/throwIn actions, pass eligibility for prone carriers.

- [ ] Write failing render/session tests: exact MA/path-cost label and highlights;
  prone Pass/Recover controls; Swat replaces body contact; inbound owner/targets
  are visible, controllable and block unrelated actions; legacy save is read-only.
- [ ] Run focused tests RED; default all new browser matches/rematches to v3.
  Preserve legacy records for replay and show the new setup before starting v3;
  do not silently overwrite an old autosave at launch.
- [ ] Update solo controller ownership/AI scheduling, court inbound highlights and
  labels, fall/loose-ball/last-touch/recovery log and help. Show base roster identity
  but effective movement only in actionable stats; show actual path cost around
  blockers. New banner/print copy must not claim shoves, injuries or extra GFI.
- [ ] Update printed cards/rules and README for this playtest, retaining original
  credits and prepared dunk/throw spectacle. Runner uses v3 and verifies a full match.
- [ ] Run focused tests GREEN, full suite, typecheck, build, runner and independent
  task review. Commit. Controller then runs final whole-branch review, resolves
  material findings, pushes codex/browser-game, waits for Pages deployment and
  verifies live HTML and both asset hashes against dist.

## Progress

- Initial state: clean codex/browser-game at 41bbd4c; v2 was live with 47 tests.
- PRD updated before any implementation. User's direct instruction includes
  implementation and explicitly selects subagent-driven execution.
