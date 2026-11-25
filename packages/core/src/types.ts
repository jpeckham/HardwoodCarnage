import type { Position, CourtMode } from './court.js';
import type { RosterName, RosterPlayer } from './rosters.js';
export type Side = 'A' | 'B';
export interface MatchConfig { teamA: RosterName; teamB: RosterName; court?:CourtMode }
export interface Player extends RosterPlayer {
  id: string; team: Side; pos: Position; armor: number;
  status: 'standing'|'prone'|'stunned'|'ko'|'removed';
  moved: number; forward: number; used: boolean; offCourt:boolean; skillUsed: string[];
  streak: number; fire: boolean;
}
export interface Team { id: Side; name: RosterName; score: number; rerolls: number; rerollUsed: boolean; blitzUsed: boolean }
export interface GameEvent { id: number; kind: string; text: string; playerId?: string; pos?: Position; value?: number }
export type BlockFace = 'Attacker Down'|'Both Down'|'Push'|'Defender Stumbles'|'POW!';
export type Command =
  | {type:'move'; playerId:string; to:Position}
  | {type:'run'; playerId:string; to:Position}
  | {type:'stand'|'shoot'|'steal'|'endActivation'|'formLadder'; playerId:string; targetId?:string}
  | {type:'pass'; playerId:string; targetId:string}
  | {type:'alleyOop'|'throwTeamMate'; playerId:string; targetId:string; spins:number}
  | {type:'block'; playerId:string; targetId:string; blitz:boolean}
  | {type:'dunk'|'ladder'; playerId:string; spins:number}
  | {type:'endTurn'|'decline'}
  | {type:'reroll'; source:'team'|'skill'}
  | {type:'chooseBlock'; index:number}
  | {type:'brawler'; index:number}
  | {type:'push'; to:Position}
  | {type:'follow'; yes:boolean};
export type Step =
  | {type:'check'; playerId:string; label:string; target:number; skill?:string; success:Step[]; failure:Step[]}
  | {type:'move'; playerId:string; to:Position}
  | {type:'walk'; playerId:string; to:Position}
  | {type:'knock'; playerId:string; sourceId?:string}
  | {type:'ball'; playerId:string|null; pos?:Position; hot?:boolean}
  | {type:'finish'; playerId:string}
  | {type:'turnover'; reason:string}
  | {type:'score'; playerId:string; points:number; dunk:boolean; spins:number; thrown:boolean}
  | {type:'clockReset'}
  | {type:'event'; kind:string; text:string; playerId:string};
export type Pending =
  | {type:'check'; check:Extract<Step,{type:'check'}>; roll:number; remaining:Step[]}
  | {type:'block'; attacker:string; defender:string; chooser:Side; dice:BlockFace[]; blitz:boolean; frenzy:boolean; brawlerUsed:boolean}
  | {type:'push'; attacker:string; defender:string; destinations:Position[]; knock:boolean; frenzy:boolean}
  | {type:'follow'; attacker:string; defender:string; to:Position; frenzy:boolean};
export interface MatchState {
  rules:string; config:MatchConfig; seed:number; rng:number;
  teams:Team[]; players:Player[]; current:Side; possession:Side;
  ball:{carrier:string|null; pos:Position; hot:boolean};
  half:1|2; turn:number; shotClock:number; active:string|null; over:boolean;
  pending:Pending|null; glass:Side[]; ladders:string[][]; hype:number; events:GameEvent[]; commands:Command[];
}
export interface Replay { schema:1; rules:string; config:MatchConfig; seed:number; commands:Command[] }
