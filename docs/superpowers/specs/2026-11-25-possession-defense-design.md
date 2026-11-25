# Possession and Defense Design

The current [PRD](../../../blood_bowl_hardwood_carnage_nba_jam_prd.md) is the
binding specification. James requested this PRD update first, followed by
implementation using writing-plans and subagent-driven-development.

## Approach

Keep the deterministic engine and the small court. Add a versioned possession
ruleset instead of rewriting historical match records. New browser games set
`config.ruleset: 'possession'` and use `hardwood-possession/3.0.0`; old configurations
continue to reconstruct v1/v2. All newly offered browser matches use v3.

Reduce each roster's effective MA to half, rounded up and capped to 2–4; remove
bonus ground movement. Backcourt setups and a six-square scoring/throw range give
defenders a chance to close before the next drive. This preserves later half-court
spectacle and legitimate fast-break scores after a turnover near the rim.

## State and resolution

- Add optional `ball.lastTouch` player ID, `state.throwIn` restart descriptor,
  and `player.reactionTurn`; optional fields preserve old replay shapes.
- A ball module owns D8 scatter, recovery and throw-in entitlement. A contact
  module owns clean swats, movement reactions, falls and pass contests.
- Extend the existing serializable Step queue for reactions/contests/scatter.
  Stop queued work whenever control changes, a throw-in starts, a carrier loses
  possession or the active player falls. Never apply a second automatic turnover
  after a restart or defensive recovery already changed the team turn.
- `collectBall` records a v3 touch and skips legacy burning-ball injury. `setup`
  records the receiver and clears restarts; half/full-time overrides restarts.
- Trace pass contests with a supercover line, stable flight order and one roll
  per defender per pass. A nearby defender is checked at release, then excluded
  from the flight-stage defender list.

## Presentation and compatibility

Display effective MA, remaining squares and actual path cost. Replace body-contact
controls with Swat ball, Recover ball, prone Pass and explicit throw-in controls.
Keep the flying-player presentation for prepared aerial plays. Replace old help
and printable foul/injury/GFI descriptions with the authoritative v3 rules.

Legacy saves are offered as read-only replay records; new setup uses v3 and does
not silently reinterpret or immediately overwrite an older autosave. The deployed
branch remains codex/browser-game. Publication authorization persists from the
existing user request to host the game for friends.

## Defaults chosen for the playtest

The PRD's numbers for effective MA, scoring range, 3+/4+ swats, D8 direction order,
four-bounce cap and three-square inbound are implementation defaults chosen to
make this playtest concrete. They are tunable. No new feature design is pending.
