import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';
import { nextD8 } from '../src/dice.js';
import type { Command, MatchConfig, MatchState, Player, Position } from '../src/index.js';

const { applyCommand, awardThrowIn, createMatch, effectiveMA, isPossessionGame, legalActions, replayMatch, scatterBall, serializeReplay } = core;
const config = { teamA: 'Reikland Reavers', teamB: 'Gouged Eye', court: 'arcade', ruleset: 'possession' } as const;
const make = (seed = 1) => createMatch(config, seed);
const get = (s: MatchState, id = 'A0') => s.players.find(p => p.id === id)!;
const accept = (s: MatchState, ...commands: Command[]) => commands.reduce(applyCommand, s);
const offered = (s: MatchState, type: Command['type'], id?: string) => legalActions(s, id).some(c => c.type === type);
const placeLoose = (s: MatchState, pos: Position, lastTouch = 'A0') => {
  s.ball = { carrier: null, pos, hot: false, lastTouch };
};
function assertAtomic(s: MatchState, command: Command) {
  const before = structuredClone(s);
  expect(() => applyCommand(s, command)).toThrow();
  expect(s).toEqual(before);
}

describe('possession match movement and range', () => {
  it('selects v3 while retaining legacy and base-roster movement', () => {
    const s = make();
    expect(s.rules).toBe('hardwood-possession/3.0.0');
    expect(isPossessionGame(s)).toBe(true);
    expect(s.players.map(p => p.ma)).toEqual([4, 4, 2, 3]);
    expect([1, 4, 5, 7, 9, 20].map(effectiveMA)).toEqual([2, 2, 3, 4, 4, 4]);
    expect(core.ROSTERS['Reikland Reavers'][0]!.ma).toBe(7);
    const legacy = createMatch({ teamA: config.teamA, teamB: config.teamB, court: config.court }, 1);
    expect(legacy.rules).toBe('hardwood-arcade/2.0.0');
    expect(isPossessionGame(legacy)).toBe(false);
    expect(get(legacy).ma).toBe(7);
    expect(legacy.ball).not.toHaveProperty('lastTouch');
    const classic = createMatch({ teamA: config.teamA, teamB: config.teamB }, 1);
    expect(classic.rules).toBe('hardwood-arcade/1.0.0');
    expect(classic).not.toHaveProperty('throwIn');
  });

  it.each([['arcade', 2, 13, 12], ['classic', 5, 20, 16]] as const)(
    'starts %s duos adjacent in the backcourt and mirrors sides at halftime',
    (court, firstA, firstB, halfTurn) => {
      let s = createMatch({ ...config, court }, 1);
      expect(s.players.map(p => p.pos.y)).toEqual([firstA, firstA, firstB, firstB]);
      expect(core.distance(get(s).pos, get(s, 'A1').pos)).toBe(1);
      expect(s.ball.lastTouch).toBe(s.ball.carrier);
      for (let i = 0; i < halfTurn; i++) s = applyCommand(s, { type: 'endTurn' });
      expect(s.half).toBe(2);
      expect(s.players.map(p => p.pos.y)).toEqual([firstB, firstB, firstA, firstA]);
      expect(s.ball.lastTouch).toBe('B0');
    },
  );

  it('gives Classic and Turbo swarms distinct backcourt tiles', () => {
    for (const court of ['arcade', 'classic'] as const) {
      const s = createMatch({ ...config, teamA: 'Goblin Swarm', court }, 1);
      const positions = s.players.filter(p => p.team === 'A').map(p => p.pos);
      expect(new Set(positions.map(p => JSON.stringify(p))).size).toBe(5);
      expect(positions.every(p => core.inBounds(p, s) && p.y === (court === 'arcade' ? 2 : 5))).toBe(true);
    }
  });

  it('charges one cumulative movement square to stand, even on fire', () => {
    let s = make();
    Object.assign(get(s), { status: 'prone', fire: true, moved: 1 });
    s = applyCommand(s, { type: 'stand', playerId: 'A0' });
    expect(get(s).moved).toBe(2);
    expect(s.active).toBe('A0');
    assertAtomic(s, { type: 'run', playerId: 'A0', to: { x: 3, y: 5 } });
    s = applyCommand(s, { type: 'run', playerId: 'A0', to: { x: 3, y: 4 } });
    expect(get(s).moved).toBe(4);
    expect(offered(s, 'move', 'A0')).toBe(false);
  });

  it('counts the actual path around blockers cumulatively over several commands', () => {
    let s = make();
    const a = get(s);
    Object.assign(a, { pos: { x: 0, y: 0 }, fire: true });
    get(s, 'A1').pos = { x: 0, y: 1 };
    get(s, 'B0').pos = { x: 1, y: 1 };
    get(s, 'B0').status = 'prone';
    s.ball.pos = a.pos;
    const destination = { x: 0, y: 2 }; // Four steps around a two-player wall.
    const run = { type: 'run', playerId: 'A0', to: destination } as const;
    expect(legalActions(s, 'A0')).toContainEqual(run);
    assertAtomic(s, { ...run, to: { x: 0, y: 5 } });
    s = accept(s, { type: 'move', playerId: 'A0', to: { x: 1, y: 0 } }, run);
    expect(get(s).pos).toEqual(destination);
    expect(get(s).moved).toBe(4);
    expect(s.events.filter(e => e.kind === 'roll')).toHaveLength(0);
    expect(offered(s, 'run', 'A0')).toBe(false);
    assertAtomic(s, { type: 'move', playerId: 'A0', to: { x: 0, y: 3 } });
    assertAtomic(s, { type: 'run', playerId: 'A0', to: { x: 0, y: 3 } });
  });

  it('gives a two-MA player neither ground GFI nor extra fire squares', () => {
    let s = make();
    s = applyCommand(s, { type: 'endTurn' });
    s = applyCommand(s, { type: 'run', playerId: 'B0', to: { x: 3, y: 11 } });
    expect(get(s, 'B0').moved).toBe(2);
    assertAtomic(s, { type: 'move', playerId: 'B0', to: { x: 3, y: 10 } });
    get(s, 'B0').fire = true;
    assertAtomic(s, { type: 'move', playerId: 'B0', to: { x: 3, y: 10 } });
  });

  it('only offers and executes shots within six squares of the attacking rim', () => {
    let s = make();
    const shoot = { type: 'shoot', playerId: 'A0' } as const;
    expect(offered(s, 'shoot', 'A0')).toBe(false);
    assertAtomic(s, shoot);
    get(s).pos = { x: 4, y: 7 };
    assertAtomic(s, shoot);
    get(s).pos = { x: 4, y: 8 };
    expect(offered(s, 'shoot', 'A0')).toBe(true);
    s = applyCommand(s, shoot);
    expect(s.teams[0]!.score).toBe(3);
  });
});

describe('possession loose balls and throw-ins', () => {
  it.each([
    [8, 1, { x: 3, y: 7 }], [1, 2, { x: 3, y: 8 }],
    [2, 3, { x: 4, y: 8 }], [3, 4, { x: 5, y: 8 }],
    [4, 5, { x: 5, y: 7 }], [5, 6, { x: 5, y: 6 }],
    [6, 7, { x: 4, y: 6 }], [7, 8, { x: 3, y: 6 }],
  ] as const)('uses seeded D8 at seed %i to scatter in direction %i', (seed, direction, pos) => {
    const s = make(seed);
    if (seed === 1) expect(nextD8(seed)).toEqual({ value: 2, rng: 270369 });
    scatterBall(s, { x: 4, y: 7 }, 'A0');
    expect(s.ball).toMatchObject({ carrier: null, pos, lastTouch: 'A0' });
    expect(s.events.filter(e => e.kind === 'roll').map(e => e.value)).toEqual([direction]);
  });

  it('offers prone recovery on the same tile and keeps a successful activation available', () => {
    const s = make();
    placeLoose(s, get(s).pos, 'B0');
    get(s).status = 'prone';
    expect(offered(s, 'recover', 'A0')).toBe(true);
    const result = applyCommand(s, { type: 'recover', playerId: 'A0' });
    expect(result.ball).toMatchObject({ carrier: 'A0', lastTouch: 'A0' });
    expect(result.active).toBe('A0');
    expect(get(result).used).toBe(false);
    expect(get(result).status).toBe('prone');
    expect(result.events.find(e => e.kind === 'roll')?.text).toContain('4+');
    expect(result.pending).toBeNull();
    expect(result.turn).toBe(s.turn);
  });

  it('ends activation and scatters after failing an immediate same-tile recovery', () => {
    const s = make(2);
    placeLoose(s, get(s).pos, 'B0');
    get(s, 'A1').pos = { x: 4, y: 1 };
    const result = applyCommand(s, { type: 'recover', playerId: 'A0' });
    expect(result.pending).toBeNull();
    expect(result.ball).toMatchObject({ carrier: null, pos: { x: 3, y: 3 }, lastTouch: 'A0' });
    expect(get(result).used).toBe(true);
    expect(result.active).toBeNull();
    expect(result.turn).toBe(s.turn);
    assertAtomic(s, { type: 'recover', playerId: 'A1' });
  });

  it('stops the rest of a run on a failed pickup without offering a reroll', () => {
    const s = make(2);
    placeLoose(s, { x: 2, y: 3 }, 'B0');
    const result = applyCommand(s, { type: 'run', playerId: 'A0', to: { x: 3, y: 4 } });
    expect(get(result)).toMatchObject({ pos: { x: 2, y: 3 }, moved: 1, used: true });
    expect(result.ball).toMatchObject({ carrier: null, pos: { x: 2, y: 4 }, lastTouch: 'A0' });
    expect(result.pending).toBeNull();
    expect(result.active).toBeNull();
  });

  it('continues the rest of a run after a clean pickup by the active player', () => {
    const s = make();
    placeLoose(s, { x: 2, y: 3 }, 'B0');
    s.possession = 'B';
    const result = applyCommand(s, { type: 'run', playerId: 'A0', to: { x: 3, y: 4 } });
    expect(get(result)).toMatchObject({ pos: { x: 3, y: 4 }, moved: 2, used: false });
    expect(result.ball).toMatchObject({ carrier: 'A0', pos: { x: 3, y: 4 }, lastTouch: 'A0' });
    expect(result).toMatchObject({ current: 'A', possession: 'A', turn: 0, active: 'A0', pending: null });
  });

  it('immediately gives a defender recovering a hot ball control and only one new turn', () => {
    const s = make(78);
    const defender = get(s, 'B1');
    defender.pos = { x: 4, y: 8 };
    s.active = 'A0';
    s.ball.hot = true;
    scatterBall(s, { x: 4, y: 7 }, 'A0');
    expect(s.ball).toMatchObject({ carrier: 'B1', pos: defender.pos, hot: true, lastTouch: 'B1' });
    expect(s).toMatchObject({ possession: 'B', current: 'B', turn: 1, active: null, shotClock: 4 });
    expect(s.events.filter(e => e.kind === 'roll').map(e => e.value)).toEqual([3, 3]);
    expect(s.events.some(e => e.kind === 'armor' || e.kind === 'injury')).toBe(false);
  });

  it('updates last touch on a failed catch before a chained bounce goes out', () => {
    const s = make(4);
    get(s, 'B0').pos = { x: 8, y: 8 };
    // The chosen seed scatters south, fails the Black Orc recovery, then scatters south again.
    scatterBall(s, { x: 7, y: 8 }, 'A0');
    expect(s.ball.lastTouch).toBe('B0');
    expect(s.throwIn?.team).toBe('A');
    expect(s.turn).toBe(0);
  });

  it('stops after four chained bounces without losing a recoverable loose ball', () => {
    const s = make(10186);
    [get(s), get(s, 'B0')].forEach((p: Player, i) => {
      p.pos = { x: 4, y: 6 + i };
      p.ag = 5;
    });
    scatterBall(s, { x: 4, y: 7 }, 'B0');
    expect(s.events.filter(e => e.kind === 'roll').map(e => e.value)).toEqual([7, 2, 3, 4, 7, 1, 3, 3]);
    expect(s.ball).toMatchObject({ carrier: null, pos: { x: 4, y: 7 }, lastTouch: 'B0' });
    expect(s.throwIn ?? null).toBeNull();
  });

  it('rebounds off a rim without changing the last player to touch it', () => {
    const s = make();
    scatterBall(s, { x: 5, y: 13 }, 'A0');
    expect(s.ball).toMatchObject({ carrier: null, pos: { x: 3, y: 15 }, lastTouch: 'A0' });
    expect(s.events.filter(e => e.kind === 'roll').map(e => e.value)).toEqual([2, 2]);
  });

  it.each([
    [8, { x: 0, y: 8 }, { x: 0, y: 8 }], [4, { x: 8, y: 8 }, { x: 8, y: 8 }],
    [6, { x: 4, y: 0 }, { x: 4, y: 0 }], [2, { x: 4, y: 15 }, { x: 4, y: 15 }],
  ] as const)('awards the opposite side when a D8 bounce at seed %i exits the court', (seed, from, spot) => {
    const s = make(seed);
    scatterBall(s, from, 'A0');
    expect(s.throwIn).toMatchObject({ team: 'B', spot });
    const thrower = get(s, s.throwIn!.throwerId);
    expect(thrower).toMatchObject({ team: 'B', pos: spot, status: 'standing' });
    expect(s).toMatchObject({ current: 'B', possession: 'B', turn: 1, active: null });
    expect(s.ball).toMatchObject({ carrier: null, pos: spot, lastTouch: 'A0' });
    expect(legalActions(s).every(c => c.type === 'throwIn' && c.playerId === thrower.id)).toBe(true);
    assertAtomic(s, { type: 'endTurn' });
    assertAtomic(s, { type: 'throwIn', playerId: 'A0', to: { x: 4, y: 6 } });
    assertAtomic(s, { type: 'throwIn', playerId: thrower.id, to: spot });
  });

  it('places the closest eligible thrower at a free boundary tile even during its own turn', () => {
    const s = make();
    Object.assign(get(s), { pos: { x: 1, y: 8 }, status: 'prone', moved: 2, used: true });
    Object.assign(get(s, 'A1'), { moved: 1, used: true });
    get(s, 'B0').pos = { x: 0, y: 8 };
    awardThrowIn(s, { x: -1, y: 8 }, 'B0');
    expect(s.throwIn).toMatchObject({ team: 'A', throwerId: 'A0' });
    expect(s.throwIn!.spot.x).toBe(0);
    expect(s.throwIn!.spot).not.toEqual({ x: 0, y: 8 });
    expect(s).toMatchObject({ current: 'A', possession: 'A', turn: 0 });
    expect(get(s)).toMatchObject({ status: 'standing', moved: 2, used: true });
    expect(get(s, 'A1')).toMatchObject({ moved: 1, used: true });
    const inbound = legalActions(s).find(c => c.type === 'throwIn')!;
    expect(inbound).toBeDefined();
    const result = applyCommand(s, inbound);
    expect(result.throwIn ?? null).toBeNull();
    expect(result.turn).toBe(0);
    expect(get(result).used).toBe(true);
  });

  it('validates an inbound destination, then rolls a catch or leaves it on an empty tile', () => {
    const s = make();
    get(s, 'A0').pos = { x: 4, y: 0 };
    get(s, 'A1').pos = { x: 3, y: 1 };
    get(s, 'B0').pos = { x: 5, y: 1 };
    awardThrowIn(s, { x: 4, y: -1 }, 'B0');
    const inbound = (to: Position): Command => ({ type: 'throwIn', playerId: 'A0', to });
    for (const to of [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 4, y: -1 }, { x: 4, y: 4 }]) {
      expect(legalActions(s)).not.toContainEqual(inbound(to));
      assertAtomic(s, inbound(to));
    }
    const caught = applyCommand(s, inbound({ x: 3, y: 1 }));
    expect(caught.ball).toMatchObject({ carrier: 'A1', lastTouch: 'A1' });
    expect(caught.turn).toBe(0);
    expect(caught.pending).toBeNull();
    const empty = applyCommand(s, inbound({ x: 5, y: 0 }));
    expect(empty.ball).toMatchObject({ carrier: null, pos: { x: 5, y: 0 }, lastTouch: 'A0' });
    expect(empty.rng).toBe(s.rng);
  });

  it('uses the receiver as the last touch if a failed inbound catch bounces back out', () => {
    const s = make(2);
    get(s, 'A0').pos = { x: 4, y: 15 };
    get(s, 'A1').pos = { x: 3, y: 15 };
    awardThrowIn(s, { x: 4, y: 16 }, 'B0');
    const result = applyCommand(s, { type: 'throwIn', playerId: 'A0', to: { x: 3, y: 15 } });
    expect(result).toMatchObject({ current: 'B', possession: 'B', turn: 1, pending: null });
    expect(result.ball.lastTouch).toBe('A1');
    expect(result.throwIn).toMatchObject({ team: 'B', spot: { x: 2, y: 15 } });
  });

  it.each([11, 23])('supersedes a restart at the end of court turn %i', turn => {
    const s = make();
    s.turn = turn;
    s.current = 'B';
    awardThrowIn(s, { x: -1, y: 10 }, 'B0');
    expect(s.turn).toBe(turn + 1);
    expect(s.throwIn ?? null).toBeNull();
    if (turn === 11) {
      expect(s.half).toBe(2);
      expect(s.ball.carrier).toBe('B0');
    } else expect(s.over).toBe(true);
  });
});

describe('possession replay', () => {
  it('reconstructs accepted movement and a pending restart exactly', () => {
    let s = make(70);
    s = accept(s,
      { type: 'run', playerId: 'A0', to: { x: 3, y: 6 } },
      { type: 'endTurn' },
      { type: 'run', playerId: 'B1', to: { x: 4, y: 15 } },
      { type: 'endTurn' },
      { type: 'run', playerId: 'A0', to: { x: 4, y: 8 } },
      { type: 'shoot', playerId: 'A0' },
      { type: 'decline' },
    );
    expect(s.throwIn).toMatchObject({ team: 'A', spot: { x: 5, y: 15 } });
    expect(s.ball.lastTouch).toBe('B1');
    expect(replayMatch(JSON.parse(serializeReplay(s)))).toEqual(s);
    expect(s.throwIn).toBeDefined();
    const inbound = legalActions(s).find(c => c.type === 'throwIn')!;
    s = applyCommand(s, inbound);
    expect(replayMatch(JSON.parse(serializeReplay(s)))).toEqual(s);
  });

  it('rejects malformed configuration and v3 rules/config mismatches before executing a replay', () => {
    expect(() => createMatch({ ...config, ruleset: 'unknown' } as unknown as MatchConfig, 1)).toThrow();
    const parsed = JSON.parse(serializeReplay(make()));
    expect(() => replayMatch({ ...parsed, rules: 'hardwood-arcade/2.0.0' })).toThrow();
    delete parsed.config.ruleset;
    expect(() => replayMatch(parsed)).toThrow();
    const s = make();
    delete s.config.ruleset;
    assertAtomic(s, { type: 'endTurn' });
  });
});
