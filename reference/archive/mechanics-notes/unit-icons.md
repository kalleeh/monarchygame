# Race-Specific Unit Icons Reference

**Created**: December 6, 2025  
**Purpose**: Visual reference for race-specific peasant and scum unit icons

---

## 🎨 Icon Design Philosophy

Each race has unique visual identity for universal units (peasants and scum):
- **Peasants**: Basic population/labor units
- **Green Scum**: Entry-level espionage units (1-2.5% death rate)
- **Elite Scum**: Advanced espionage units (0.88-0.94% death rate)

Icons reflect racial themes, culture, and strategic roles.

---

## 👥 Peasant Icons by Race

| Race | Icon | Name | Thematic |
|------|------|------|----------|
| **Human** | 👨‍🌾 | Human Peasant | Traditional farmer with pitchfork |
| **Elven** | 🧝 | Elven Commoner | Graceful forest dweller |
| **Goblin** | 👺 | Goblin Worker | Cunning cave laborer |
| **Droben** | 🪓 | Droben Laborer | Warrior-worker with axe |
| **Vampire** | 🧛 | Vampire Thrall | Enthralled servant |
| **Elemental** | 🌊 | Lesser Elemental | Minor elemental force |
| **Centaur** | 🐴 | Centaur Herder | Swift plains worker |
| **Sidhe** | ✨ | Sidhe Attendant | Magical servant |
| **Dwarven** | ⛏️ | Dwarven Miner | Mountain laborer |
| **Fae** | 🧚 | Fae Sprite | Tiny magical helper |

---

## 🕵️ Green Scum Icons by Race

| Race | Icon | Name | Thematic |
|------|------|------|----------|
| **Human** | 🕵️ | Human Spy | Cloaked intelligence operative |
| **Elven** | 🧝‍♂️ | Elven Scout | Swift woodland tracker |
| **Goblin** | 😈 | Goblin Sneak | Mischievous saboteur |
| **Droben** | ⚔️ | Droben Raider | Aggressive scout |
| **Vampire** | 🦇 | Vampire Bat | Shapeshifted spy |
| **Elemental** | 💨 | Air Wisp | Invisible air scout |
| **Centaur** | 🏹 | Centaur Tracker | Expert hunter-scout |
| **Sidhe** | 🔮 | Sidhe Seer | Mystical observer |
| **Dwarven** | 🔨 | Dwarven Scout | Tunnel explorer |
| **Fae** | 🧚‍♂️ | Fae Trickster | Mischievous spy |

---

## 🥷 Elite Scum Icons by Race

| Race | Icon | Name | Thematic |
|------|------|------|----------|
| **Human** | 🥷 | Human Assassin | Elite covert operative |
| **Elven** | 🧝‍♀️ | Elven Shadow | Master of stealth and archery |
| **Goblin** | 👹 | Goblin Infiltrator | Expert tunnel raider |
| **Droben** | 🗡️ | Droben Slayer | Elite combat infiltrator |
| **Vampire** | 🧛‍♂️ | Vampire Shadow | Night stalker |
| **Elemental** | ⚡ | Storm Spirit | Elite elemental spy |
| **Centaur** | 🎯 | Centaur Ranger | Master espionage specialist |
| **Sidhe** | 🌟 | Sidhe Phantom | Ethereal infiltrator |
| **Dwarven** | 🛡️ | Dwarven Sentinel | Elite underground operative |
| **Fae** | 🧚‍♀️ | Fae Enchanter | Master of illusion |

---

## 📊 Racial Scum Ratings (Reference)

From game mechanics documentation:

| Race | Scum Rating | Special Ability |
|------|-------------|-----------------|
| **Centaur** | 5/5 ⭐⭐⭐⭐⭐ | Direct scum killing |
| **Human** | 4/5 ⭐⭐⭐⭐ | Economic focus |
| **Vampire** | 4/5 ⭐⭐⭐⭐ | Defensive strength |
| **Sidhe** | 4/5 ⭐⭐⭐⭐ | Sorcery synergy |
| **Elven** | 3/5 ⭐⭐⭐ | Training efficiency |
| **Fae** | 3/5 ⭐⭐⭐ | Income generation |
| **Droben** | 3/5 ⭐⭐⭐ | Combat focus |
| **Goblin** | 2/5 ⭐⭐ | Siege warfare |
| **Elemental** | 2/5 ⭐⭐ | Building focus |
| **Dwarven** | 2/5 ⭐⭐ | Defensive focus |

---

## 💻 Usage Examples

### TypeScript Integration

```typescript
import { getRaceUnitIcon, getUnitDisplay } from '@/game-data/units';

// Get specific icon
const humanPeasant = getRaceUnitIcon('human', 'peasant');
console.log(humanPeasant.emoji); // 👨‍🌾
console.log(humanPeasant.description); // "Human Peasant"

// Get formatted display
const display = getUnitDisplay('elven', 'greenScum', 150);
console.log(display); // "🧝‍♂️ Elven Scout (150)"

// Get all icons for a race
const sidheIcons = getAllRaceIcons('sidhe');
console.log(sidheIcons.peasant.emoji); // ✨
console.log(sidheIcons.greenScum.emoji); // 🔮
console.log(sidheIcons.eliteScum.emoji); // 🌟
```

### React Component Example

```tsx
import { getRaceUnitIcon } from '@/game-data/units';

function UnitCard({ race, unitType, count }) {
  const icon = getRaceUnitIcon(race, unitType);
  
  return (
    <div className="unit-card">
      <span className="unit-icon">{icon.emoji}</span>
      <div className="unit-info">
        <h4>{icon.description}</h4>
        <p>{icon.thematic}</p>
        <span className="unit-count">{count}</span>
      </div>
    </div>
  );
}
```

---

## 🎨 Design Rationale

### Human (Balanced)
- **Peasant**: Traditional farmer (👨‍🌾) - represents balanced economy
- **Green Scum**: Detective/spy (🕵️) - intelligence gathering
- **Elite Scum**: Ninja (🥷) - elite covert operations

### Elven (Training & Magic)
- **Peasant**: Elf (🧝) - graceful forest dwellers
- **Green Scum**: Male elf (🧝‍♂️) - swift scouts
- **Elite Scum**: Female elf (🧝‍♀️) - master archers/shadows

### Goblin (Siege & Cunning)
- **Peasant**: Goblin face (👺) - mischievous workers
- **Green Scum**: Devil (😈) - sneaky saboteurs
- **Elite Scum**: Ogre (👹) - tunnel raiders

### Droben (Pure Offense)
- **Peasant**: Axe (🪓) - warrior culture
- **Green Scum**: Crossed swords (⚔️) - aggressive scouts
- **Elite Scum**: Dagger (🗡️) - combat infiltrators

### Vampire (Fortification & Dark Magic)
- **Peasant**: Vampire (🧛) - enthralled servants
- **Green Scum**: Bat (🦇) - shapeshifted spies
- **Elite Scum**: Male vampire (🧛‍♂️) - night stalkers

### Elemental (Building & Nature)
- **Peasant**: Water wave (🌊) - elemental forces
- **Green Scum**: Wind (💨) - invisible scouts
- **Elite Scum**: Lightning (⚡) - storm spirits

### Centaur (Espionage Master)
- **Peasant**: Horse (🐴) - swift herders
- **Green Scum**: Bow and arrow (🏹) - expert trackers
- **Elite Scum**: Target (🎯) - master rangers

### Sidhe (Sorcery Master)
- **Peasant**: Sparkles (✨) - magical attendants
- **Green Scum**: Crystal ball (🔮) - mystical seers
- **Elite Scum**: Star (🌟) - ethereal phantoms

### Dwarven (Defense Master)
- **Peasant**: Pickaxe (⛏️) - mountain miners
- **Green Scum**: Hammer (🔨) - tunnel scouts
- **Elite Scum**: Shield (🛡️) - underground sentinels

### Fae (Income Master)
- **Peasant**: Fairy (🧚) - tiny sprites
- **Green Scum**: Male fairy (🧚‍♂️) - tricksters
- **Elite Scum**: Female fairy (🧚‍♀️) - illusionists

---

## 📝 Implementation Notes

### File Structure
```
game-data/units/
├── index.ts           # Main unit definitions
└── unit-icons.ts      # Race-specific icon mappings
```

### Type Safety
All icons are fully typed with TypeScript interfaces:
- `UnitIcon`: Individual icon definition
- `RaceUnitIcons`: Complete set for a race
- `RACE_UNIT_ICONS`: Master mapping object

### Fallback Behavior
If a race is not found, generic fallback icons are used:
- Peasant: 👤 (Generic person)
- Green Scum: 🔍 (Magnifying glass)
- Elite Scum: 🎭 (Theater mask)

---

## 🔄 Future Enhancements

### Potential Additions
1. **Animated Icons**: SVG animations for unit actions
2. **Seasonal Variants**: Holiday-themed icons
3. **Achievement Icons**: Special icons for veteran units
4. **Status Indicators**: Wounded, blessed, cursed states
5. **Formation Icons**: Visual indicators for unit formations

### Accessibility
- All icons include descriptive text
- Screen reader compatible
- High contrast mode support planned
- Keyboard navigation friendly

---

**Status**: ✅ Complete - All Images Generated  
**Quality**: Production-ready SD3.5 artwork  
**Coverage**: All 10 races × 3 unit types = 30 unique images  
**Location**: `/output/unit-assets/images/`  
**Total Size**: ~46MB (1.3-1.8MB per image)  
**Format**: PNG, 1024x1024, high detail

