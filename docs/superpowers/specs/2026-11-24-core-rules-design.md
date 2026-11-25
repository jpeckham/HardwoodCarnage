# Hardwood Carnage rules design

Status: APPROVED — James selected the browser game with the compact arcade rules on 2026-11-25 ("go with that").

## Later user direction — Turbo court and publication

James requested a smaller map, faster play, half-court NBA Jam style dunks, an
Ogre throwing the ball-carrying Halfling through the hoop, and GitHub Pages for
friends. Turbo is the browser default: 9×16 court, six team turns per half,
two-step dunk run-up, eight-square dunk/throw range and four-square arc. On-fire
Turbo players skip the run-up. Turbo Ogre throws use AG minus one, minimum 2+.
These supersede the defaults below only for Turbo. Classic retains the original
court and distances. Replays record rules version 2 for Turbo, version 1 for
Classic. One-click paths pause at failed checks. Exhausted Turbo team turns end
automatically in the client with an explicit recorded endTurn command.

The duo starts adjacent in Turbo with the ball on the Halfling. A ready Ogre can
finish the active adjacent carrier's activation and throw them with one command.
Defensive ladders consume three ready adjacent Goblins near their own rim and
last through the opposing turn. Crowd injuries retain their 2D6 result; pushed
players stay off court until the next inbound, without promoting Stunned to KO.

## Intent and architecture

Build a browser game with a deterministic TypeScript rules engine, JSON commands, immutable transitions, serializable seeded RNG and ordered events. The browser platform supersedes the earlier Godot/Unity suggestion. All three PRD milestones remain in scope: core matches, swarm/aerial/fire mechanics, arcade presentation and a print-to-PDF tabletop kit. Core has no browser dependency.

## Approaches for the user to choose

1. **Compact arcade rules (recommended):** the explicit completion below; quick turns, no hidden dependency on a Blood Bowl edition.
2. **Edition-derived rules:** select a Blood Bowl edition and adapt its armor, assists, dice, skills and turns to basketball; needs another design round because basketball still needs its own shooting and clock rules.

## PRD numerical requirements (binding)

| Requirement | Value | Scope |
| --- | --- | --- |
| Court | 15 × 26 squares | Core |
| Standard side | 2 players | Core |
| Human Blitzer | MA 7, ST 3, AG 3+ | Core |
| Human Catcher | MA 8, ST 2, AG 2+; Catch, Dodge | Core |
| Black Orc | MA 4, ST 4, AG 5+; Grab, Brawler | Core |
| Orc Blitzer | MA 6, ST 3, AG 3+; Block | Core |
| Gutter Runner | MA 9, ST 2, AG 2+; Dodge, Weeping Dagger | Core |
| Rat Ogre | MA 6, ST 5, AG 4+; Frenzy, Prehensile Tail | Core |
| Ogre | MA 5, ST 5, AG 4+; Throw Team-Mate | Core roster; aerial skill later |
| Halfling | MA 5, ST 2, AG 3+; Right Stuff | Core roster; aerial skill later |
| Blitz | 1 per team turn | Core |
| Armor and injury | 2D6 each | Core |
| Shot clock | 4 possession team turns | Core |
| Basketball field goals | 2 / 3 points | Core brief; arc required by PRD |
| Swarm | 5 Goblins against 2 opponents | Milestone 2 |
| Goblin block penalty | −2 ST against ST 4+ | Milestone 2 |
| Goblin Ladder | 3 Goblins | Milestone 2 |
| Dunk run-up | at least 3 squares toward key | Milestone 2 |
| Aerial GFI | up to 3, each 2+ | Milestone 2 |
| Spins | 360°, 720°, Gorilla Flip; +1 each | Milestone 2 |
| Alley-oop range | within 6 squares of hoop | Milestone 2 |
| Fire streak | 3 same-player baskets without opposing score | Milestone 2 |
| Fire buffs | unlimited roll-free GFI; +2 AG for threes/dunks | Milestone 2 |
| Shatter | POW flaming dunk, ST 4+ or thrown Goblin/Halfling | Milestone 2 |
| Shatter style / glass | +1 point / +1 armor rolls in paint for half | Milestone 2 |
| Presentation | Godot 4.3+ or Unity; 16-bit style | Later |
| Original pitch | February 2022 | Attribution only |

## Proposed missing rules — user decision required

These are proposals, not PRD facts. Choosing approach 1 approves this entire section.

### Geometry and setup

Coordinates x=0..14, y=0..25; eight-neighbor movement and Chebyshev distance. Rims at (7,1), (7,24) are elevated, non-walkable. Paint x=5..9, y=0..5 or 20..25. Three-point shots originate at Euclidean squared distance >36 from the target rim; boundary is two points. All outside squares are crowd; baseline and sideline pushes use the same crowd rule. Team A starts (6,10),(8,10), B (6,15),(8,15); A has first possession, attacks y=24 in half 1. Swap ends in half 2. After scores, clock expiry and halves reset to these positions, mirrored when needed; receiving team's first available player holds ball. If no player can receive, ball lies at center (7,13).

### Turns and match

Two halves, eight turns per team per half (32 total team turns); ties allowed. Teams alternate. Each available player activates once per team turn: move up to MA, then one pass, shot or block ends activation; stand costs three movement. A stationary block is permitted only before moving unless Blitz declared. One Blitz per team turn permits movement plus one block; block costs one movement, ends activation. End-activation and end-turn commands permit stopping early. No assists or interceptions in milestone 1.

Leaving an adjacent standing opponent requires AG dodge with −1 for each standing opponent adjacent to destination; each adjacent enemy Prehensile Tail adds another −1. Natural 1 always fails, 6 always succeeds. Up to two additional ground GFI squares, 2+ each. Failed dodge/GFI knocks down and ends team turn after any reroll choice.

### Blocks, injury and skills

D6 faces: Attacker Down, Both Down, Push, Push, Defender Stumbles, POW. Higher ST rolls two dice and chooses, or three when more than double; lower ST gives defender choice with symmetric counts. Equal ST one die. Explicit choice command precedes resolution; no reroll after selecting. Both Down knocks down each without Block. Dodge prevents Defender Stumbles knockdown but still pushes. Attacker Down knocks down attacker **without a turnover**, honoring PRD's exhaustive turnover list. Losing ball on a block also does not itself end team turn.

Push one square away, chosen from the three forward squares (Grab permits any adjacent square); occupied push destinations unavailable, no chain pushes. If no available square, defender knocked down in place. Outside means crowd injury without armor. Follow-up optional into vacated square. Frenzy forces follow-up and a second block if both standing/adjacent; second block does not cost another Blitz. Brawler permits one reroll of a Both Down die on non-Blitz blocks. Weeping Dagger adds +1 injury on its knockdowns. Catch and Dodge each permit one free reroll of their applicable failed roll per activation; never reroll a reroll.

Armor targets: Human Blitzer 9+, Catcher 8+, Black Orc 10+, Orc Blitzer 9+, Gutter Runner 8+, Rat Ogre 9+, Ogre 10+, Halfling 7+. Armor breaks on 2D6 >= target. Injury 2–7 stunned, 8–9 KO, 10–12 removed. Stunned skips next own turn then prone; prone can stand; KO attempts 4+ recovery at half; removed stays out. Ball falls on carrier's square on knockdown, crowd ball returned at nearest in-bounds square. No bounce/scatter. Crowd injury may remove player even when ball remains on court.

### Basketball and rerolls

Pick up loose ball on entry using AG (same tackle modifier); failed pickup leaves ball loose, ends activation, **no turnover**. Pass to standing teammate within six squares: AG pass (−1 when distance >3, −1 per adjacent standing enemy), then AG catch (−1 per adjacent standing enemy). Dropped pass or catch leaves ball on receiver square and ends team turn. Shooting allowed anywhere: AG, −1 beyond three-point arc, −1 per adjacent standing enemy; natural 1/6 rule. Made field goal awards two/three and switches possession with setup; miss leaves ball under target rim at (7,2) or (7,23), ends activation but no turnover.

Three team rerolls per half, at most one per team turn, optional decision on failed checks or unselected block dice. A skill reroll and a team reroll cannot reroll the same check twice. Pending decisions block unrelated commands. Declining failed check applies its consequence. A catch failure may offer the Catch reroll before team reroll eligibility is considered.

Possession shot clock starts at four. End of a possessing team's turn decrements it; expiration returns possession, emits turnover and resets clock. A shot attempt resets clock even on a miss. Possession gained by pickup/catch during opponent's turn starts its clock when that team next acts. Dunk-landing turnover is reserved for milestone 2; no dunk command accepted in core.

## Determinism and validation

Version rules as hardwood-arcade/1.0.0, replay schema 1. Replay stores complete config, seed, accepted commands; reconstruct state and ordered events from seed. Reject unsupported versions, malformed configuration and malformed commands clearly. Reject any illegal command before state or RNG mutation; transition uses a clone and returns it only on success. Seed RNG is uint32 xorshift with a defined nonzero fallback for zero. No wall clock or random APIs in core. Public API: createMatch(config, seed), legalActions(state, playerId), applyCommand(state, command), serializeReplay(replay), replayMatch(replay).

## Approval record

James approved the recommended browser platform and compact arcade rules on 2026-11-25: "go with that".

## Implementation decisions for milestone 2 and the browser

Use a dependency-light DOM/SVG court and Vite build. Support local hotseat and AI,
seeded replays, local autosave, keyboard-accessible controls and muted-by-default
Web Audio / speech callouts. Print layouts use browser Save as PDF.
Goblins use MA 6, ST 2, AG 3+, AV 8+ (builder defaults). Swarm versus swarm is
rejected. Ladder needs three adjacent available Goblins, one carrying the ball;
it launches that carrier or adds one contest penalty per ladder at the rim.
Throw Team-Mate requires an adjacent Right Stuff carrier within six of the rim.
Dunks require three forward steps in the activation and distance at most three
from the rim; ally-oops require a receiver with that run-up and passer within six
of the rim. Leap uses AG, followed by 0–3 aerial 2+ spin rolls, then AG landing
modified by spins, fire and rim defenders. A block-face roll of POW powers a
successful flaming spin dunk to shatter; a thrown Right Stuff carrier qualifies
for the strength exception. Steal is an adjacent AG check against a carrier,
with fire armor on success. These additions fill unspecified mechanics; they
preserve the PRD numbers. A score ends the team turn, so inbound belongs to the
other coach. Streaks survive a teammate's basket but reset on opposing scores.
