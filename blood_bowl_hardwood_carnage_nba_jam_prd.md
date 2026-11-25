# Product Requirements Document: *Blood Bowl: Hardwood Carnage* (*NBA Jam* Edition)

**Subtitle:** 2v2 (and 5-Goblin Swarm) Arcade Fantasy Basketball with Flaming Spin Dunks & Backboard Shatters

**Original Pitch By:** James Peckham & Robert Peckham (February 2022)

**Target Build Environment:** Beluga Multi-Agent Orchestrator (`beluga-labs/beluga`) — Parallel Git Worktree Execution

## 1. Executive Summary & Vision

*Blood Bowl: Hardwood Carnage* is a fast-paced, turn-based tactical arcade basketball game fusing *Blood Bowl*'s gridiron violence, asymmetric fantasy rosters, and push-your-luck dice rolls (`GFI`, `Blitz`, `Armor Rolls`) with the over-the-top 2v2 spectacle of *NBA Jam*. Coaches field star duos—or an asymmetric **5-Goblin Swarm**—on a polished hardwood court where shoving defenders into the bleachers is legal, alley-oops chain into flaming $720^\circ$ spin dunks, and three consecutive buckets ignite players in literal flames capable of shattering glass backboards.

## 2. Multi-Agent Worktree Architecture (For Beluga Execution)

To parallelize development across Beluga worktrees and P2P Friends nodes, the codebase is divided into four isolated modules:

| Worktree / Module | Owner Role / Agent Scope | Core Responsibility | 
| ----- | ----- | ----- | 
| `wt/bb-hardwood-core` | Core Rules & Dice Agent | Deterministic turn-based court state, Block dice (`Attacker Down`, `Push`, `Defender Stumbles`, `POW!`), 2D6 Armor/Injury tables, Turnover rules, and Team Rerolls. | 
| `wt/jam-gameplay` | Basketball & Roster Agent | 2v2 star duo rosters, 5-Goblin Swarm mechanics, Shot Clock, Alley-Oop leap resolution, `"He's On Fire!"` state machine, and backboard shatter hazards. | 
| `wt/jam-vfx-audio` | Arcade VFX & Audio Agent | Flaming dunk trails, exploding glass shard physics, hardwood skid marks, crowd hype meter, and 90s arcade announcer callouts (`"BOOMSHAKALAKA!"`, `"FROM DOWNTOWN!"`). | 
| `wt/jam-tabletop-kit` | Print & Play Rules Agent | Generates printable $15 \times 26$ hardwood court grids, custom 2v2 / 5-Goblin player stat cards, and quick-reference dunk/injury tables for physical tabletop play. | 

## 3. Core Functional Requirements

### 3.1 Pitch & Roster Rules (`wt/jam-gameplay`)

* **Court Dimensions:** $15 \times 26$ square hardwood grid featuring 3-point arcs, painted key zones, bleachers bordering the sidelines (for crowd-surf injury rolls), and elevated rim/backboard tiles at each end.

* **Asymmetric Roster Formats:**

  * **Standard 2v2 Star Duos:** Coaches draft 2 iconic *Blood Bowl* players from classic factions:

    * *Reikland Reavers:* Human Blitzer (`MA 7, ST 3, AG 3+`) + Human Catcher (`MA 8, ST 2, AG 2+`, `Catch`, `Dodge`).

    * *Gouged Eye:* Black Orc (`MA 4, ST 4, AG 5+`, `Grab`, `Brawler`) + Orc Blitzer (`MA 6, ST 3, AG 3+`, `Block`).

    * *Skavenblight:* Gutter Runner (`MA 9, ST 2, AG 2+`, `Dodge`, `Weeping Dagger`) + Rat Ogre (`MA 6, ST 5, AG 4+`, `Frenzy`, `Prehensile Tail`).

    * *Grak & Crumbleberry:* Ogre (`MA 5, ST 5, AG 4+`, `Throw Team-Mate`) + Halfling (`MA 5, ST 2, AG 3+`, `Right Stuff`).

  * **The "5-Goblin" Swarm Rule Exception:** Goblin coaches may field **5 Goblins simultaneously** against any 2-player opponent. Individual Goblins suffer `-2 ST` on blocks against `ST 4+` Big Guys, but gain `Stunty`, `Dodge`, `Right Stuff`, and the **Goblin Ladder** action—allowing 3 Goblins to stack vertically to contest rim-height dunks or launch the ball-carrier via `Throw Team-Mate` straight through the hoop.

* **No Fouls, Only Turnovers:** Goblin referees are strictly bribed or KO'd pre-game. Pushing, shoving, and one `Blitz` per turn are completely legal. A **Turnover** triggers only on a failed `Dodge`, failed `Go For It (GFI)`, dropped `Pass/Catch`, Shot Clock expiration (4 turns), or a botched `Dunk` landing.

### 3.2 Signature *NBA Jam* Mechanics (`wt/jam-gameplay`)

* **Flaming Spin Dunks & Alley-Oops:**

  * Moving at least 3 squares toward the key and passing an `Agility (AG)` + `Leap` check launches an aerial dunk sequence.

  * Coaches may chain up to three `GFI` (`2+`) rolls mid-air to add **Spin Modifiers** ($360^\circ$, $720^\circ$, *Gorilla Flip*), granting $+1$ per spin to beat defending blockers at the rim and multiplying crowd hype.

  * **Alley-Oop Pass:** A teammate within 6 squares of the hoop can `Pass` to a mid-air leaping teammate, bypassing ground tackle zones and automatically triggering a Slam Dunk attempt.

* **`"HE'S ON FIRE!"` Status Effect:**

  * Scoring 3 consecutive baskets with the same player without the opposing team scoring ignites that player in literal flames.

  * **On-Fire Buffs:** Unlimited `GFI` movement squares without rolling, $+2\text{ AG}$ on all 3-pointers and dunks, immunity to standard `Push` results, and an ignited basketball that forces an `Armor Roll` on any defender who intercepts or steals it.

* **Glass Backboard Shatter:**

  * Executing a `POW!`-powered flaming spin dunk with a `ST 4+` player (or a thrown Goblin/Halfling) shatters the glass backboard.

  * Awards **+1 Bonus Style Point** and showers the painted key in hazardous glass shards, inflicting $+1$ to all `Armor Rolls` on knockdowns inside the paint for the remainder of the half.

## 4. Technical Stack & Milestones for Beluga Agents

* **Core Logic (`wt/bb-hardwood-core`):** Deterministic TypeScript or Rust state machine with full turn replay serialization and AI coach sparring bots.

* **Client & Presentation (`wt/jam-vfx-audio`):** Godot 4.3+ or Unity 2D-HD isometric sprite/low-poly hybrid camera with exaggerated 16-bit hit-stop, screen shake, and announcer callouts.

* **Milestone 1 (Core Court & 2v2 Loop):** $15 \times 26$ grid movement, Block dice resolution, passing/shooting mechanics, and Turnover state machine.

* **Milestone 2 (5-Goblin Swarm & Spin Dunks):** Asymmetric 5-Goblin roster rules, Goblin Ladder / `Throw Team-Mate` dunks, `"He's On Fire!"` streak logic, and backboard shatter hazards.

* **Milestone 3 (Arcade Juice & Printable Tabletop Kit):** Flaming particle trails, retro announcer audio triggers, and printable PDF pitch/stat cards via `wt/jam-tabletop-kit`.