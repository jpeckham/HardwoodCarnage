# Arcade Pace and GitHub Pages Plan

User direction: smaller map, faster play, crazy half-court dunks, Ogre throwing a
ball-carrying Halfling through the hoop, and a public GitHub Pages link for friends.

- [ ] Add a 9×16 arcade court with six turns per team per half. Keep the original
  15×26 court/rules as Classic and preserve old replay geometry/version.
- [ ] Add one-click path movement with normal dodge/GFI/pickup checks at each step.
  A failed check pauses the path; reroll continues it; accepted failure stops it.
- [ ] Allow arcade dunks from half court after two forward steps, and half-court
  Throw Team-Mate. Give the Ogre/Halfling pair adjacent starts and Halfling possession.
- [ ] Show signature actions even before eligible, with concrete instructions.
  Add unmistakable animated flying-player arcs, spin trails, rim impact and callouts.
- [ ] Reduce AI decision delay, batch safe movement, auto-end exhausted arcade turns,
  and keep the arena short enough to fit a typical desktop viewport.
- [ ] Verify new/Classic rules, immutable paths, aerial failure/success, replay
  compatibility, complete AI matches, renderer geometry and deployment base paths.
- [ ] Commit and push the complete source plus a GitHub Actions Pages workflow on
  the project branch; enable Pages, deploy, and verify the served HTML and assets.

Decision: 9×16 is roughly one third of the original number of squares, keeping
five-Goblin tactics while eliminating long approach turns. Arcade run-up is two
steps and dunk/throw range is eight. These intentionally supersede the original
PRD's distance defaults for Arcade; Classic retains the original numbers.
Deployment is explicitly authorized by the user's GitHub Pages request. No new
hosting service, repository visibility change, or merge is needed.
