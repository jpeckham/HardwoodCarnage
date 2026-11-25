export interface RosterPlayer { name: string; ma: number; st: number; ag: number; skills: string[] }
export const ROSTERS = {
  'Reikland Reavers': [
    {name:'Human Blitzer',ma:7,st:3,ag:3,skills:[]},
    {name:'Human Catcher',ma:8,st:2,ag:2,skills:['Catch','Dodge']},
  ],
  'Gouged Eye': [
    {name:'Black Orc',ma:4,st:4,ag:5,skills:['Grab','Brawler']},
    {name:'Orc Blitzer',ma:6,st:3,ag:3,skills:['Block']},
  ],
  'Skavenblight': [
    {name:'Gutter Runner',ma:9,st:2,ag:2,skills:['Dodge','Weeping Dagger']},
    {name:'Rat Ogre',ma:6,st:5,ag:4,skills:['Frenzy','Prehensile Tail']},
  ],
  'Grak & Crumbleberry': [
    {name:'Ogre',ma:5,st:5,ag:4,skills:['Throw Team-Mate']},
    {name:'Halfling',ma:5,st:2,ag:3,skills:['Right Stuff']},
  ],
  'Goblin Swarm': Array.from({length:5},(_,i)=>({name:`Goblin ${i+1}`,ma:6,st:2,ag:3,skills:['Stunty','Dodge','Right Stuff']})),
} satisfies Record<string, RosterPlayer[]>;
export type RosterName = keyof typeof ROSTERS;
