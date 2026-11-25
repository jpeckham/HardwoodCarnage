# Hardwood Carnage

Fantasy basketball with flying spin dunks, ball-only defense, five-Goblin
swarms, and an Ogre/Halfling cannon. The current playtest gives defenders time
to stop a drive before the fireworks.

**Play:** https://jpeckham.github.io/HardwoodCarnage/

GitHub Pages publishes through GitHub Actions from `codex/browser-game`. There
is no branch selector in the Pages source setting when Actions is selected;
the workflow specifies the branch. The `github-pages` environment permits this
branch to deploy. Pushes rebuild, test, and publish the game automatically.

Choose **Grak & Crumbleberry** on the **Turbo court** to try the signature play.
The Halfling starts with the ball in the backcourt. Advance the duo over multiple
turns, keep them adjacent, and get the Ogre within six squares of the rim to
attempt the **Halfling cannon**. Set up a 360°, 720°, or Gorilla Flip if you're
willing to risk extra spin checks.

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

The headless match command plays a complete seeded possession-rules game and
verifies exact reconstruction from replay. Build output is `dist/`.

## Modes and controls

| | Turbo (default) | Classic |
| --- | --- | --- |
| Court | 9 × 16 | 15 × 26 |
| Team turns per half | 6 | 8 |
| Dunk run-up | 2 forward steps | 3 forward steps |
| Dunk launch range | 6 squares | 3 squares |
| Throw Team-Mate / alley-oop passer distance from rim | 6 squares | 6 squares |
| Max shot range | 6 squares | 6 squares |
| Three-point arc radius | 4 squares | 6 squares |

- Click a player, then a numbered destination. The number is the actual
  path length around obstacles. Every step costs 1, including diagonals.
  MA is the hard limit per player per team turn, even when on fire.
- Arrow keys take one step. **Space** finishes a player, and **E** ends the
  team turn. Tab then Enter or Space works for court squares and buttons.
  Phones also have a move pad.
- Stand for 1 movement, or pass from the floor at +1 difficulty. Pass to a
  standing teammate within 6. Defenders can contest the release and flight,
  including alley-oops and throw-ins.
- Use **Swat ball** beside an opposing carrier. Defenders can also react when
  a carrier enters or leaves their reach. A fall can leave the player prone
  with the ball or scatter it.
- Run onto a loose ball or use **Recover ball** if you're already on it.
  If it goes out, check the last touch and the entitled team. Only its
  designated thrower can act. Choose a highlighted square within 3.
- Three unanswered baskets by one player put them on fire. Flaming spin
  dunks can shatter a backboard on POW for a style point. Glass is visual.
  Sound is optional, and reduced-motion settings suppress movement effects.

## Save, replay and tabletop

Matches autosave on the same device when browser storage is available. **Save
replay** downloads JSON. **Load replay** validates and reconstructs it, and
Replay Theater scrubs accepted commands. Both courts now use possession rules
(v3). Classic v1 and Turbo v2 records open read-only under their original rules.
If there's an older autosave, you can watch it or start a new possession match.
The old save is kept separately. All dice are seeded. Replays are records, not
online sessions.

**Tabletop kit** prints the selected court, all thirteen player cards, and
quick-reference rules for movement, swats, inbounds and aerial plays. Use landscape A4 or Letter,
100% scale, background graphics on, and browser headers off. Choose Save as PDF
to export the kit.

## Source and deployment

- `packages/core`: immutable match commands, movement, dice, rosters,
  possession defense, aerial actions, AI and versioned replay.
- `apps/web`: SVG court, controls, flight/spin/glass effects, optional audio,
  local saves and print layouts. Art is drawn in code; no asset CDN needed.
- `.github/workflows/pages.yml`: tests/builds pushes to `codex/browser-game`, then
  deploys `dist/` to GitHub Pages. Vite uses relative asset URLs for project paths.
- The [current PRD](blood_bowl_hardwood_carnage_nba_jam_prd.md) and
  [possession design](docs/superpowers/specs/2026-11-25-possession-defense-design.md)
  specify the new rules and versioning.

Original pitch: **James Peckham & Robert Peckham, February 2022**. Development
continues here with Codex. There is no orchestration-service dependency.
