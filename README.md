# Hardwood Carnage

Fantasy basketball with half-court flying dunks, crowd-surfing blocks,
five-Goblin swarms, and an Ogre/Halfling cannon.

**Play:** https://jpeckham.github.io/HardwoodCarnage/

Choose **Grak & Crumbleberry** on the **Turbo court** to try the signature play:
the Ogre and Halfling start adjacent, the Halfling holds the ball, and **Halfling
cannon** launches the carrier through the hoop. Seed `1` gives a successful
opening 360° cannon with ordinary dice rules. Other seeds can fail and offer
a reroll. Select a player, click a lit destination to run, then choose a play.

## Run locally

Use Node 22.12+, Node 24, or Node 26+ with npm:

```sh
npm ci
npm run dev
```

Open the printed localhost URL. Solo AI, local two-coach hotseat, and AI exhibition
modes run entirely in the browser. Friends can each play the hosted game; hotseat
means sharing one device, not online multiplayer.

```sh
npm test
npm run typecheck
npm run build
npm run match
```

The headless match command plays a complete seeded game and verifies exact
reconstruction from replay. Build output is `dist/`.

## Modes and controls

| | Turbo (default) | Classic |
| --- | --- | --- |
| Court | 9 × 16 | 15 × 26 |
| Team turns per half | 6 | 8 |
| Dunk run-up | 2 forward steps; waived on fire | 3 forward steps |
| Dunk launch range | 8 squares: half-court sky jams | 3 squares |
| Throw Team-Mate / alley-oop passer range | 8 squares | 6 squares |
| Three-point arc radius | 4 squares | 6 squares |

- Click a player, then a highlighted destination. Every step still checks
  dodges, pickups and GFI; a failed check pauses the path for your decision.
- Arrow keys take one step; **Space** finishes a player; **E** ends the team turn.
  Tab and Enter/Space operate other controls. Phones also have a move pad.
- Choose straight slams, 360°, 720°, or Gorilla Flips. More spins mean more
  2+ aerial GFI checks and better landing odds.
- Signature Play cards explain requirements. In Turbo, a ready Ogre can finish
  the adjacent ball-carrying Halfling's activation and launch them in one play.
- Block dice and rerolls belong to the indicated coach. The human attacker can
  keep or reroll dice before handing the choice to an AI defender.
- Three unanswered baskets by one player cause fire. Flaming spin dunks can
  shatter a backboard on POW, adding a style point and dangerous glass.
- Sound starts off; enabling it adds synthesized sounds and available browser
  speech callouts. Reduced-motion settings suppress movement effects.

## Save, replay and tabletop

Matches autosave on the same device when browser storage is available. **Save
replay** downloads JSON; **Load replay** validates and reconstructs it. Replay
theater scrubs accepted commands. Classic replays use rules version 1; Turbo
replays use version 2 and preserve the court selection. Rules use seeded dice,
not browser clocks or random APIs. Replays are records, not online sessions.

**Tabletop kit** prints the selected court, all thirteen player cards, and
quick-reference rules with dunk/injury tables. Use landscape A4 or Letter,
100% scale, background graphics on, and browser headers off. Choose Save as PDF
to export the kit.

## Source and deployment

- `packages/core`: immutable match commands, movement, dice, rosters, injuries,
  aerial actions, AI and replay.
- `apps/web`: SVG court, controls, flight/spin/glass effects, optional audio,
  local saves and print layouts. Art is drawn in code; no asset CDN needed.
- `.github/workflows/pages.yml`: tests/builds pushes to `codex/browser-game`, then
  deploys `dist/` to GitHub Pages. Vite uses relative asset URLs for project paths.
- [Rules design](docs/superpowers/specs/2026-11-24-core-rules-design.md) records
  defaults. The later [pace plan](docs/superpowers/plans/2026-11-25-arcade-pace.md)
  records the user-requested Turbo changes and publication direction.

Original pitch: **James Peckham & Robert Peckham, February 2022**. Development
continues here with Codex. There is no orchestration-service dependency.
