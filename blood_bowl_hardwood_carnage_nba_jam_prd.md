# Product Requirements: Blood Bowl — Hardwood Carnage

**Authors:** James Peckham & Robert Peckham · original pitch February 2022.
**Current revision:** November 25, 2026 — possession, defense and movement rebalance.
**Implementation:** deterministic TypeScript browser game, developed in Codex.
**Play:** https://jpeckham.github.io/HardwoodCarnage/

## 1. Current direction and precedence

Keep the small court and fantasy basketball spectacle, while giving defense a
real chance to stop a drive. Contact contests the ball; deliberate body blocks,
fouls, shoves, crowd surfing and injury actions are not part of new matches.
Players can naturally stumble or land badly and fall without being fouled.

This revision supersedes the earlier body-contact, unlimited-GFI and opening
Halfling-cannon balance rules. Historical rules versions 1 and 2 remain available
for exact replay reconstruction, not as defaults for new browser matches. New
matches use `hardwood-possession/3.0.0`, with `config.ruleset = possession`.

## 2. Court, rosters and pacing

- Turbo remains the default **9 × 16** court with six team turns per half.
  Classic geometry remains 15 × 26 with eight team turns per half.
- Preserve all faction identities and original MA/ST/AG/skills as roster data:
  Humans (Blitzer 7/3/3+, Catcher 8/2/2+); Orcs (Black Orc 4/4/5+, Blitzer
  6/3/3+); Skaven (Gutter Runner 9/2/2+, Rat Ogre 6/5/4+); Grak & Crumbleberry
  (Ogre 5/5/4+, Halfling 5/2/3+); five Goblins (base 6/2/3+) versus a duo.
- **Balance default:** effective on-court MA is `min(4, max(2, ceil(baseMA/2)))`.
  Thus Ogre/Halfling/Goblins move 3, Black Orc 2, Human Blitzer/Catcher and Gutter
  Runner 4, and Orc Blitzer/Rat Ogre 3. Display the effective value, remaining
  squares and the actual path cost. Every orthogonal or diagonal step costs 1.
- The displayed allowance is a hard cumulative cap per player per team turn.
  Switching selection, several clicks, rerolls or fire must not grant extra
  movement. Remove ground GFI bonus squares and unlimited on-fire movement.
  Standing costs 1 movement. A prone player may instead pass without standing.
- One-click runs remain, but reachable highlights and execution use the same
  full path length around blockers. Stop the path on a fall, lost ball or a
  pending decision; continue only when its failed check is successfully rerolled.
- Start/inbound formations are in the receiving sides' own backcourts: Turbo
  A at longitudinal row 2 and B at 13 (zero-based), Classic A at 5 and B at 20;
  mirror in half two. Duos remain adjacent and swarms have distinct positions.
- Maximum shooting range is 6 squares. Turbo flying dunks and teammate throws
  launch from within 6 of the rim (the center line); Classic dunk range remains
  3 and throw range 6. The opening formation plus movement cap must prevent an
  uncontestable opening run-and-score/cannon. A later turnover near the hoop can
  still create a legitimate immediate scoring chance; there is no artificial
  minimum-possession-turn scoring ban.

## 3. Ball-only contact and defensive reactions

- New matches expose **Swat ball**, not body Block/Blitz, Push, knockdown, armor
  or injury commands. Reject legacy body-contact commands atomically in v3.
- A standing defender adjacent to a standing or prone carrier may swat. Default
  swat check is 3+, +1 if the carrier has Dodge and +1 if stronger than the
  defender. Natural 1 fails, 6 succeeds. A successful swat releases and scatters
  the ball; it does not knock the carrier down. The swatter is the last touch.
- A carrier moving into or out of a standing enemy's reach provokes a reaction.
  Each defender gets at most one movement reaction per opponent team turn:
  1–3 miss, 4–5 bat the ball loose, 6 cleanly steal. A loose-ball result can
  immediately be recovered if it scatters onto a player. Record every roll.
- Leaving a marker also uses the carrier's normal AG dodge check. A failed dodge
  can be rerolled normally; accepting the failure makes the runner stumble and
  ends the team turn. No deliberate foul or injury is applied.
- On a fall, the carrier rolls AG to hang on: natural 1 fails, 6 succeeds. A good
  roll leaves the prone player holding the ball; failure releases and scatters
  it. Falling ends the player's activation. An out-of-bounds entitlement or an
  opponent recovery must not be overwritten by a second automatic turnover.
- New rules use standing/prone states for falls. Fire and glass retain visual
  spectacle and scoring style bonuses but never create armor/injury knockdowns.

## 4. Loose balls, scatter, recovery and throw-ins

- Track the last player (and therefore team) to touch the ball on every release,
  catch attempt, pickup, swat, bat, interception and inbound. Rolling on empty
  ground does not change the last touch.
- A loose ball scatters one square on a seeded **D8**: N, NE, E, SE, S, SW, W, NW
  in that order (N decreases court x; E increases longitudinal y).
- If it reaches an empty tile, it rests there. If it reaches a standing player,
  attempt an immediate AG recovery. A failed catch counts as that player's touch
  and bounces again. Bound chained recovery/bounce attempts at four; a rim also
  rebounds, with bounded resolution. Preserve a valid, recoverable loose ball.
- Players can enter a loose-ball tile and attempt pickup. A player already on it,
  including a prone player, can **Recover ball**; prone recovery adds 1 to AG.
  A failed recovery ends the activation and scatters it. A successful recovery
  may be followed by an available move/pass. Immediate recovery/scatter rolls
  are not reroll prompts; normal dodge/pass/catch/dunk checks retain rerolls.
- A defender recovering/intercepting during the other team's action immediately
  gains possession and the next team turn; no queued movement/pass continues.
- When any scatter crosses any court boundary, stop scattering and award a
  throw-in to the team that **did not touch it last**. A swatted-out ball is out
  on the defender, not the former carrier. A fumbled-out ball is out on the
  fumbler. Show who touched it and who gets the inbound.
- Place the nearest eligible player of the entitled team at the nearest free
  boundary tile (standing them for the restart if necessary). Only that team's
  designated thrower can act until the throw-in is resolved. Inbound within
  3 squares to a standing teammate or an empty tile; catch attempts can fail and
  scatter again. Throwing in consumes the thrower's activation. Disallow an
  inbound to the thrower's own tile, a rim, an opponent or out of bounds.
- If the entitled side is already acting (e.g. a defending swat goes out), keep
  its team turn. Otherwise switch once to the entitled side. Half/full-time
  transitions supersede the restart. Never lose or double-apply the entitlement.

## 5. Passing, including from the ground

- Release and flight contests apply to ordinary passes, alley-oop ball releases
  and throw-in passes, including inbounds aimed at empty tiles. Special plays
  must not silently bypass the new ball-defense rules.
- A standing **or prone** ball carrier may pass to a standing teammate within
  6 squares. Passing while prone adds 1 to the normal AG pass target; adjacent
  enemies do not disable the action. Passing ends the passer's activation.
- A standing opponent adjacent to the passer can strip or bat the release.
  For each release, a defender rolls once: 1–3 miss, 4–5 bat loose, 6 clean steal.
- After a successful AG release, trace the pass using a deterministic supercover
  grid line. Every traversed square adjacent to or occupied by a standing enemy
  is contested, including the receiver area. Test defenders in flight order with
  stable ID tie-breaking. A defender already tested at release is not tested
  twice on that pass. Each gets the same miss/bat/steal roll.
- A clean interception gives that defender possession. A bat releases/scatters
  the ball at the contested flight square, with the defender as last touch.
  Neither result harms a player's body or continues the original pass chain.
- If no defender stops it, resolve the usual catch. A failed pass/catch scatters
  at the receiver area with the correct passer/receiver last touch and causes
  the normal dropped-pass turnover unless an earlier recovery/restart has
  already changed control. Catch and Dodge skills and team rerolls still apply.
- Retain exactly deterministic seeded events and replay for standing/prone,
  adjacent-release and multiple-contested-square cases. Illegal pass inputs must
  not change the state or consume RNG.

## 6. Arcade fantasy spectacle

- Keep flaming spin dunks, 360°/720°/Gorilla Flip styles, alley-oops, crowd hype,
  screen impact, announcer calls and optional audio. Two forward steps set up a
  Turbo dunk, three in Classic; neither fire nor presentation bypasses MA/range.
- Keep the Ogre/Halfling and five-Goblin ladder/teammate-throw combinations. They
  now need setup and range, rather than scoring directly from the opening spot.
- Up to three aerial 2+ spin checks remain; they do not grant ground squares.
- Three unanswered baskets by one player ignite them; the +2 three/dunk AG bonus
  and flaming presentation remain, without unlimited movement or injury effects.
- Qualifying POW-powered flaming spin dunks can shatter, add +1 style point and
  show glass. Glass is visual in v3; do not reinstate armor or forced injuries.

## 7. Delivery, compatibility and acceptance

- TypeScript core with immutable commands, seeded RNG, legal-actions API, AI,
  serializable pending decisions and exact replay. V3 config/rules mismatch or
  malformed JSON must be rejected before mutation. Preserve historical v1/v2
  replay behavior behind the absence of the v3 ruleset flag.
- Update browser controls, overlays, play-by-play, help, roster cards and printed
  rules together. Prone pass, swat, recover and entitled throw-in must all be
  discoverable and usable in solo AI and local hotseat. Old saves must not silently
  resume with a different ruleset; load legacy matches read-only in replay theater
  and offer the updated match setup.
- Tests must show: exact movement caps across multiple clicks/rerolls/fire;
  no opening uncontestable scoring play for every faction; clean swats and
  reactive defense; falls with retained and lost balls; last-touch-correct
  throw-ins on every edge; recoveries and bounded bounce chains; prone and
  contested passes; AI completion and exact v3 replay; preserved legacy tests.
- Commit PRD/design/plan before implementation, then use the requested
  subagent-driven workflow, task reviews, and final review. Publish the verified
  update through the existing GitHub Pages workflow on codex/browser-game.
