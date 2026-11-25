# Browser Game Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Keep source on codex/browser-game. Later user direction authorizes GitHub Pages publication from this branch; no merge is needed.

**Goal:** Deliver the complete playable browser game across all three PRD milestones.

**Architecture:** Immutable serializable core transitions with explicit dice/reroll decisions. Browser SVG court consumes core legal actions; AI uses the same command API. Replays store accepted commands, config and seed, with exact reconstruction.

**Tech Stack:** TypeScript, Vitest, Vite, native DOM/SVG, Web Audio and browser printing.

**Spec:** ../specs/2026-11-24-core-rules-design.md and ../../../blood_bowl_hardwood_carnage_nba_jam_prd.md.

## Global Constraints

- 15×26 court, exact PRD duos, five Goblins against two players, one Blitz per turn.
- Two eight-turn halves, four-turn shot clock, three team rerolls per half.
- Failed dodge/GFI/pass/catch/dunk landing and clock expiration cause turnovers.
- Illegal input is atomic, replay preserves RNG and all rules/configuration.
- Original authors credited. No former orchestration dependencies in working source.

## Review Focus

- Malformed JSON/replay and illegal commands reject without consuming dice.
- Pending choices cannot be bypassed; defender chooses unfavorable block dice.
- Scoring, half boundaries, disabled players and AI cannot stall a match.
- Saved games restore exact state; invalid storage must not break launch.
- Responsive court, keyboard controls, print layout and reduced-motion settings.

### Task 1: Complete core match and deterministic replay

**Files:** packages/core/src/{types,court,dice,rosters,match,actions,blocks,replay,ai,index,runner}.ts; packages/core/tests/{match,actions,blocks,replay}.test.ts.

**Interfaces:** createMatch(config,seed): MatchState; applyCommand(state,command): MatchState; legalActions(state,playerId?): Command[]; replayMatch(replay): MatchState.

- [ ] Write failing tests for initial match geometry, movement, atomic invalid JSON, shots/turns, pending checks, dice/block choices, rerolls, crowd injury, exact replay and complete AI game.
- [ ] Run npm test and observe new assertions fail before implementation.
- [ ] Implement exact compact rules using cloned state, event log and seeded RNG.
- [ ] Run npm test, npm run typecheck and npm run match; require complete deterministic match.

### Task 2: Swarm, aerial actions, fire and glass

**Files:** packages/core/src/aerial.ts and core extensions; packages/core/tests/arcade.test.ts.

**Interfaces:** Additional commands dunk/alleyOop/ladder/throwTeamMate/steal; events fire/shatter; glass and scoring streak stored in state.

- [ ] Write failing tests for swarm restrictions, ladder, three-step run-up, spin GFI, thrown carriers, three-basket fire, fire armor/push immunity, and glass bonus/persistent hazard.
- [ ] Run targeted tests RED, implement actions and fire/glass state, run GREEN.

### Task 3: Browser client, effects, AI and print kit

**Files:** index.html; apps/web/{main,render,effects,tabletop}.ts; apps/web/style.css; vite.config.ts; browser tests; package configuration.

**Interfaces:** Client dispatches core Command, renders MatchState and ordered events; import/export uses core replay schema; AI uses chooseAiCommand(state).

- [ ] Build full-page arena with setup, faction selection, turn HUD, clickable court, action controls, pending decisions, roll history, help and game-over rematch.
- [ ] Add AI/hotseat, autosave, replay export/import with errors, accessible controls and responsive layout.
- [ ] Add flame/dunk/glass/skid effects, hype, optional audio/callouts and reduced motion.
- [ ] Add printable exact court, all roster cards, compact rules and dunk/injury references through browser Save as PDF.
- [ ] Verify browser game flow including AI match completion and replay round trip; run npm run build and typecheck.

### Task 4: Review and handoff

**Files:** README.md; plan progress and validation notes.

- [ ] Run full tests/build/headless match and inspect browser/print output.
- [ ] Request one independent code review; address material issues with failing regression tests then fixes.
- [ ] Audit all PRD requirements against implementation and evidence; update README with run commands, controls, defaults and limitations.
- [ ] Leave reviewable local changes with no push or publication.

## Ledger

- Approval: "go with that" selects the recommended browser game and compact rules; no repeated approval gate.
- Ruling: execute in the existing checkout on a dedicated branch to preserve recovered uncommitted files and the user's requested workspace.
- Pre-flight: tasks 2 and 3 consume the same core state/command/replay types; all exports live in core/index.ts. No conflicting APIs.
- Baseline: 3 foundation tests pass before new implementation.
- Tasks 1–3 implemented: full deterministic matches/replay, core/aerial mechanics,
  SVG client, AI/hotseat, saves, audio/effects and print layouts. Browser movement,
  failed shot, reroll and a three-page print preview were observed in Chrome
  before the user stopped Computer Use. No further desktop control followed.
- Review fixes, each covered by a failing regression then a passing run: strict
  roster strings, attacker reroll ownership, Brawler allowance, print SVG IDs,
  alley-oop ball transfer, crowd injury bands and thrower range.
- Later Turbo plan supersedes the initial browser court-size/turn defaults.
  Independent review exercised 72 Turbo AI matches across all valid faction
  pairs. Its flaming-ball runner activation lock was reproduced and fixed by
  finishing the injured player's activation.
- Final handoff: 47 tests, typecheck and build passed locally and in GitHub.
  Deployment run 45650287579 attempt 3 succeeded after enabling Actions Pages and
  permitting codex/browser-game in the deployment environment. Public page and
  both production asset hashes were verified. README now points to the live game.
