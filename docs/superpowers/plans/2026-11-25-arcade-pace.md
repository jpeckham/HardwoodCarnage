# Arcade Pace and GitHub Pages Plan

User direction: smaller map, faster play, crazy half-court dunks, Ogre throwing a
ball-carrying Halfling through the hoop, and a public GitHub Pages link for friends.

- [x] Add a 9×16 arcade court with six turns per team per half. Keep the original
  15×26 court/rules as Classic and preserve old replay geometry/version.
- [x] Add one-click path movement with normal dodge/GFI/pickup checks at each step.
  A failed check pauses the path; reroll continues it; accepted failure stops it.
- [x] Allow arcade dunks from half court after two forward steps, and half-court
  Throw Team-Mate. Give the Ogre/Halfling pair adjacent starts and Halfling possession.
- [x] Show signature actions even before eligible, with concrete instructions.
  Add unmistakable animated flying-player arcs, spin trails, rim impact and callouts.
- [x] Reduce AI decision delay, batch safe movement, auto-end exhausted arcade turns,
  and keep the arena short enough to fit a typical desktop viewport.
- [x] Verify new/Classic rules, immutable paths, aerial failure/success, replay
  compatibility, complete AI matches, renderer geometry and deployment base paths.
- [ ] Commit and push the complete source plus a GitHub Actions Pages workflow on
  the project branch; enable Pages, deploy, and verify the served HTML and assets.

Decision: 9×16 is roughly one third of the original number of squares, keeping
five-Goblin tactics while eliminating long approach turns. Arcade run-up is two
steps and dunk/throw range is eight. These intentionally supersede the original
PRD's distance defaults for Arcade; Classic retains the original numbers.
Deployment is explicitly authorized by the user's GitHub Pages request. No new
hosting service, repository visibility change, or merge is needed.

Validation: 47 tests pass; production build and typecheck pass. Full Turbo
Ogre/Halfling versus Goblins match ends in 24 turns / 93 commands with exact
replay. Independent review ran 72 Turbo games across all valid faction pairs.
The flaming-ball injury/activation finding was fixed through RED→GREEN regression.
Source committed as 39d2f90 and pushed to codex/browser-game. GitHub Actions ran
npm ci, tests and build successfully. Enabling Pages via POST /repos/.../pages
returned blank HTTP 500 with workflow and branch-source payloads; GET still
returns 404. Windows Computer Use ended because it could not confidently verify
the browser URL. User has been asked to enable GitHub Actions as Pages source.
Publication remains unverified; do not report the target URL as live yet.
