# Monarchy Game - Mechanics Reference

**Purpose:** Complete game mechanics reference for implementation and balancing  
**When to use:** Implementing features, calculating formulas, understanding game systems  
**Status:** All mechanics fully incorporated into game-data TypeScript files

---

## Quick Reference Index

```json
{
  "combat": {
    "land_acquisition": "6.79%-7.35% per Full Strike",
    "turn_costs": "4 base (scales with networth difference)",
    "attack_types": ["Controlled Strike", "Guerilla Raid", "Mob Assault", "Full Attack"],
    "casualties": {"with_ease": "5%", "good_fight": "15%", "failed": "25%"}
  },
  "building": {
    "max_buildrate": "26-28 without debt",
    "optimal_buildrate": "16-20",
    "development_cost": "310-325 gold per acre",
    "optimal_ratios": {
      "quarries": "30-35%",
      "barracks": "30-35%",
      "guildhalls": "10%",
      "temples": "12%",
      "forts": "5-6%"
    }
  },
  "sorcery": {
    "temple_thresholds": {"tier1": "2%", "tier2": "4%", "tier3": "8%", "tier4": "12%"},
    "elan_generation": {"sidhe_vampire": "0.005", "others": "0.003"},
    "spell_damage": {
      "sidhe_hurricane": "5.63% structures, 7.5% forts",
      "sidhe_banshee": "6.25% structures"
    }
  },
  "thievery": {
    "detection_optimal": "80-90% of max enemy scouts",
    "death_rates": {"green": "1-2.5%", "elite": "0.88-0.94%"},
    "operations": ["Loot", "Rob Guildhalls", "Spread Dissention", "Sabotage Alliances", "Intercept Caravans", "Desecrate Temples"]
  },
  "turns": {
    "generation_rate": "3 per hour (20 minutes each)",
    "encamp_bonus": {"24h": "+10 turns", "16h": "+7 turns"},
    "action_cost": "1 turn per action (regardless of quantity)"
  },
  "bounties": {
    "land_acquisition": "30% of killed realm",
    "structure_bonus": "~20% built ratio",
    "turn_savings": "100+ turns equivalent"
  },
  "restoration": {
    "damage_based": "48 hours",
    "death_based": "72 hours",
    "limitations": "No combat, sorcery, or espionage during restoration"
  }
}
```

---

## Combat System

### Land Acquisition Formula
- **Full Strike Range:** 6.79%-7.35% of target's total land
- **Success Modifier:** "With ease" = 7.0-7.35%, "Good fight" = 6.79-7.0%
- **Networth Scaling:** Affects percentage within range

### Warrior Race Rankings
1. **Droben** - Bunar: 27.50 attack (T3), 3.04% summon
2. **Elemental** - T4 advantage, 2.84% summon
3. **Goblin** - T4: 22.50 attack, 2.75% summon
4. **Dwarven** - T3: 22.50 attack, 2.75% summon

### Rule of 0.25% (Cash Conservation)
After achieving "with ease", reduce army by 25% each attack while maintaining effectiveness.

### Ambush Mechanics
- **Effectiveness:** 95% success rate
- **Removal:** Guerrilla Raid or Full Attack during conversion
- **Always assume:** Opponents have ambush set

---

## Building System

### Optimal Ratios (30k Acre Kingdom)
- **Quarries:** 30-35% (9,000-10,500)
- **Barracks:** 30-35% (9,000-10,500)
- **Guildhalls:** 10% (3,000 max - burning vulnerability)
- **Hovels:** 10% (3,000)
- **Temples:** 12% (3,600)
- **Forts:** 5-6% (1,500-1,800)

### Build Rate Mechanics
- **Maximum Sustainable:** 26-28 without debt
- **Optimal Range:** 16-20 for efficiency
- **Development Cost:** 310-325 gold per acre
- **Turn Cost:** 1 turn per building action

### Structure Categories
- **Permanent:** Quarries, Barracks, Hovels (survive attacks)
- **Perishable:** Guildhalls, Temples, Forts (vulnerable to destruction)

---

## Sorcery System

### Temple Requirements by Spell Tier
- **Tier 1 (2%):** Rousing Wind, Shattering Calm
- **Tier 2 (4%):** Hurricane, Lightning Lance
- **Tier 3 (8%):** Banshee Deluge
- **Tier 4 (12%):** Foul Light, major spells

### Spell Damage by Race

**Sidhe (Best):**
- Hurricane: 5.63% structures, 7.5% forts, 9% backlash
- Lightning Lance: 10% forts, 7% backlash
- Banshee Deluge: 6.25% structures, 7% backlash
- Foul Light: 8% peasant kill rate

**Elven/Fae:**
- Hurricane: 4.38% structures, 6.25% forts, 10% backlash
- Lightning Lance: 8.75% forts, 8% backlash
- Banshee Deluge: 5.0% structures, 8% backlash

**Vampire/Elemental:**
- Same damage as Elven/Fae
- Higher backlash: 13%/11%/11%

### Elan Generation
- **Sidhe/Vampire:** ceil(Temples × 0.005)
- **Other Races:** ceil(Temples × 0.003)
- **Example:** 1,000 temples = 5 elan/turn (Sidhe) vs 3 elan/turn (others)

---

## Thievery System

### Detection Mechanics
- **Requirement:** 100 Green scum minimum
- **Optimal Rate:** 80-90% of max enemy scouts visible
- **Death Rates:** Green 1-2.5%, Elite 0.88-0.94%

### Scum Operations (2-4 turns each)
1. **Loot** - Steal gold (~3-5M per success)
2. **Rob Guildhalls** - Destroy economic buildings
3. **Spread Dissention** - Kill peasants
4. **Sabotage Alliances** - Break defensive support
5. **Intercept Caravans** - Steal resource transfers
6. **Desecrate Temples** - Reduce magical capabilities

### Racial Scum Rankings
1. Centaur (best)
2. Human (4/5 rating)
3. Vampire (4/5 rating)
4. Sidhe (4/5 rating)
5. Elven (3/5 rating)

---

## Racial Abilities

### Special Abilities
- **Human:** Caravan frequency 2x (12h vs 24h cooldown)
- **Elven:** Remote fog casting (guild-wide coverage)
- **Goblin:** Kobold Rage (T2 bonus in middle age)
- **Droben:** Boosted summons (3.04% networth)
- **Vampire:** Enhanced elan (0.005 vs 0.003)
- **Elemental:** Fort destruction on Controlled Strike
- **Centaur:** Direct scum killing ability
- **Sidhe:** Circle summoning (emergency temples)

### Combat Ratings (1-5 scale)
- **War:** Droben 5, Goblin/Elemental/Dwarven 4, Human/Vampire/Fae 3
- **Sorcery:** Sidhe 5, Elven/Vampire/Elemental/Fae 4, Human 3
- **Scum:** Centaur 5, Human/Vampire/Sidhe 4, Elven/Fae 3
- **Defense:** Dwarven 5, Elven/Vampire 4, others 3
- **Economy:** Human 5, Elven/Goblin/Fae 3, others 2

---

## Turn & Resource Systems

### Turn Generation
- **Base Rate:** 3 turns per hour (20 minutes each)
- **Encamp 24h:** +10 bonus turns
- **Encamp 16h:** +7 bonus turns
- **Action Cost:** 1 turn per action (regardless of quantity)

### Cash Management
- **Safe Amount:** 1.0-1.5x total acreage in millions
- **War Allocation:** 33-50% for initial setup
- **Looting Risk:** 5 successful loots = ~15M stolen
- **Protection:** 80-90% scum detection rate

---

## Bounty System

### Mechanics
- **Land Acquisition:** 30% of killed realm's land
- **Structure Bonus:** ~20% built ratio included
- **Turn Savings:** 100+ turns equivalent at BR 18
- **Shared Kills:** 95% rule (sorcerer + warrior coordination)

### Optimal Timing
- **Collection:** After tithing exhaustion (11k-15k acres)
- **Claiming:** Immediate unless in defensive war
- **Strategic Hold:** Semi-secret weapon for first strike

---

## Restoration System

### Timing
- **Damage-Based:** 48 hours (70%+ structure loss)
- **Death-Based:** 72 hours (complete elimination)
- **Cache Duration:** Fixed, no extensions

### Limitations During Restoration
- ❌ No combat (attacks or defense)
- ❌ No sorcery (casting or receiving)
- ❌ No espionage (scum operations)
- ✅ Limited building allowed
- ✅ Encamp usage permitted
- ✅ Communication maintained

---

## Strategic Principles

### War Preparation
- **Cash Requirements:** 2.5M per 1k acres (offensive), 4-4.5M (defensive)
- **Turn Reserve:** 30-40 turns for refortification
- **Timing:** 2-3 build cycles + 1 turn set between wars

### Defensive Posture
- **Under 20k:** 50% scum, 50% T3/T4 troops
- **Over 20k:** Add T1/T2 to prevent Guerrilla Raids
- **Detection:** 80-90% of max enemy scouts visible

### Guild Composition (8 realms)
1. Sidhe (sorcerer)
2. Elven (fog + parking lots)
3. Droben (realm breaker)
4. Goblin (land taker)
5-6. Human x2 (versatile)
7-8. Elemental x2 (fighter-mage)

**Capability Matrix:** 6 Sorcerers, 6 Warriors, 3 Scummers

---

## Implementation Notes

**All mechanics documented here are fully implemented in:**
- `/game-data/mechanics/` - Mathematical formulas
- `/game-data/races/` - Racial abilities and stats
- `/game-data/units/` - Combat values
- `/game-data/buildings/` - Building ratios
- `/game-data/spells/` - Sorcery system
- `/game-data/balance/` - Game balance constants

**Source Documentation:**
- NPAC Elite Forum (2010-2014) - Pro player strategies
- Official Monarchy Forums - Game mechanics
- 25+ years of player-discovered optimal strategies

---

**Last Updated:** November 2025  
**Status:** Production-ready, all systems implemented
