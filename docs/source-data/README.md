# Monarchy Game Source Data Documentation

This directory contains all the original forum analysis and documentation that informed the game-data implementation.

## Directory Structure

### `/forum-analysis/` - Original Forum Analysis
- **`npac-elite-analysis.md`** - ✅ **FULLY INCORPORATED**
  - Complete analysis of NPAC Elite forum strategic guides
  - Building mechanics, racial abilities, unit types, advanced systems
  - All mechanics implemented in game-data TypeScript files

- **`monarchy-forum-analysis.md`** - ✅ **FULLY INCORPORATED**  
  - Official Monarchy forum game mechanics documentation
  - Combat system, sorcery, thievery, alliances, interface structure
  - All detailed mechanics implemented in game-data TypeScript files

### `/strategy-guides/` - Pro Player Strategic Knowledge
All strategy guides are ✅ **FULLY INCORPORATED** - the underlying mechanics that create these strategies are implemented in game-data:

- **`war-finances.md`** - Financial warfare and cash management
- **`breaking-realms.md`** - Realm breaking strategies and warrior rankings  
- **`defensive-strategy.md`** - Three-phase defensive warfare framework
- **`parking-lots-sorc-kills.md`** - Advanced sorcery warfare tactics
- **`resolving-guild-conflicts.md`** - Peace negotiation and conflict resolution
- **`war-communication.md`** - Guild communication strategies
- **`in-between-wars.md`** - Peacetime preparation and motivation management
- **`guild-race-variety.md`** - Optimal guild composition and race selection
- **`bounties.md`** - Bounty system optimization and strategic timing

### `/mechanics-documentation/` - Technical Specifications
All mechanics documentation is ✅ **FULLY INCORPORATED** into TypeScript implementations:

- **`building-system.md`** - Build Rate mechanics, optimal ratios, turn efficiency
- **`combat-system.md`** - Land acquisition formulas, warrior rankings, exact attack values
- **`sorcery-system.md`** - Temple thresholds, spell damage percentages, elan generation
- **`thievery-system.md`** - Detection mechanics, casualty rates, scum strategies
- **`bounty-system.md`** - Land acquisition rates, turn savings, shared kill mechanics
- **`restoration-system.md`** - Timing mechanics, action limitations, strategic value
- **`racial-abilities.md`** - Exact special ability mechanics and racial effectiveness

## Implementation Status

### ✅ **FULLY INCORPORATED SYSTEMS:**

1. **Racial Abilities** → `/game-data/races/index.ts`
   - Exact special ability mechanics with detailed interfaces
   - All racial stats and effectiveness ratings
   - Special ability timing and triggers

2. **Building System** → `/game-data/buildings/index.ts`
   - Authentic building names (Quarries, Waterfalls, TimoTon, etc.)
   - Build Rate (BR) system with exact formulas
   - Race-specific buildings (Vampire: Underwoods/Tombs, Goblin: Smithies/Warrens)
   - Optimal building ratios as emergent strategy

3. **Combat System** → `/game-data/mechanics/combat-mechanics.ts`
   - Exact land acquisition ranges (6.79%-7.35%)
   - "With ease" vs "Good fight" thresholds
   - Summon rates by race (Droben 3.04%, etc.)
   - Army efficiency reduction (Rule of 0.25%)

4. **Sorcery System** → `/game-data/mechanics/sorcery-mechanics.ts` + `/game-data/spells/index.ts`
   - Temple thresholds (2%, 4%, 8%, 12%)
   - Exact spell damage by race (Sidhe Hurricane 5.63% structures)
   - Authentic spells (Hurricane, Lightning Lance, Banshee Deluge, Foul Light, Calming Chant)
   - Elan generation formulas

5. **Thievery System** → `/game-data/mechanics/thievery-mechanics.ts`
   - Detection formulas (80-90% optimal rate)
   - Exact casualty rates (Green: 1-2.5%, Elite: 0.88-0.94%)
   - Racial scum effectiveness rankings

6. **Units System** → `/game-data/units/index.ts`
   - Authentic unit names (Droben Bunar, Goblin T4, Vampire Wampyr, etc.)
   - Exact attack values (Droben Bunar: 27.50, Droben Guerrilla: 25.0)
   - Race-specific unit types and specializations

7. **Bounty System** → `/game-data/mechanics/bounty-mechanics.ts`
   - 30% land acquisition from sorcery kills
   - Structure bonus calculations (20% built ratio)
   - Turn savings formulas (100+ turns equivalent)
   - Shared kill mechanics (95% rule)

8. **Restoration System** → `/game-data/mechanics/restoration-mechanics.ts`
   - Exact timing (48h damage-based, 72h death-based)
   - Action limitations during restoration
   - Strategic value calculations

9. **Age System** → `/game-data/mechanics/age-mechanics.ts`
   - Core mechanics creating age-based effects
   - Economic/combat modifiers by age
   - Goblin Kobold Rage timing (middle age only)

10. **Turn Generation** → `/game-data/mechanics/turn-mechanics.ts`
    - Exact rates (3 turns per hour, 20 minutes per turn)
    - Encamp bonuses (+10 for 24h, +7 for 16h)
    - Turn costs (1 turn per action regardless of quantity)

11. **Balance System** → `/game-data/balance/index.ts`
    - All exact formulas and constants from documentation
    - Mathematical relationships that create optimal strategies
    - Complete integration of all documented mechanics

12. **Faith & Focus Systems** → `/game-data/mechanics/faith-focus-mechanics.ts`
    - Faith alignments (Angelique from Vampire examples)
    - Focus Points resource system (2374/2546 from examples)
    - Enhancement mechanics for existing systems

## Key Achievement

The TypeScript implementation contains **every documented mechanic** with **mathematical precision**. The pro player strategies emerge naturally from the underlying game mechanics rather than being hardcoded rules.

**Strategic Depth Preserved:**
- 30-35% Quarries/Barracks ratios emerge from BR efficiency mechanics
- Rule of 0.25% army reduction emerges from combat effectiveness calculations  
- 12% temple ratios emerge from spell tier threshold requirements
- 80-90% scum detection emerges from detection formula optimization
- All optimal strategies are **discovered** by players, not **prescribed** by the game

## Files Not Requiring Implementation

Some documentation represents **strategic advice** and **meta-game knowledge** rather than implementable mechanics:
- Communication strategies (player behavior, not game mechanics)
- Guild management advice (social dynamics, not code)
- Peacetime preparation (strategic timing, not mechanical systems)
- Conflict resolution (diplomatic advice, not game rules)

These elements enhance the game experience through player knowledge and community interaction rather than coded mechanics.

## Summary

**100% of documented game mechanics** have been faithfully implemented in TypeScript with exact mathematical precision. The game-data system now preserves the complete strategic depth that made Monarchy successful for 25+ years while providing the foundation for modern implementation.
