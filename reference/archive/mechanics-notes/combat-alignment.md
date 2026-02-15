# Combat Mechanics - Reference Data Alignment

**Date**: November 25, 2025, 22:43 CET  
**Status**: ✅ **NOW ALIGNED** with reference data  
**Source**: `game-data/mechanics/combat-mechanics.ts`

---

## ✅ Now Aligned with Reference Data

### **Casualty Rates** (from `combat-mechanics.ts`)

| Result Type | Offense Ratio | Attacker Losses | Defender Losses |
|-------------|---------------|-----------------|-----------------|
| **With Ease** | >= 2.0 | 5% | 20% |
| **Good Fight** | >= 1.2 | 15% | 15% |
| **Failed** | < 1.2 | 25% | 5% |

### **Land Acquisition** (from `combat-mechanics.ts`)

| Result Type | Land Gained |
|-------------|-------------|
| **With Ease** | 7.0-7.35% of target land |
| **Good Fight** | 6.79-7.0% of target land |
| **Failed** | 0% |

### **Gold Looting** (from `combat-mechanics.ts`)

```typescript
goldLooted = landGained × 1000
```

---

## 📊 Implementation Details

### **Power Calculation**
```typescript
attackerPower = Σ(unit.attack × unit.count)
defenderPower = Σ(unit.defense × unit.count)
formationBonus = formation.bonuses.attack / 100
totalPower = attackerPower × (1 + formationBonus)
offenseRatio = totalPower / defenderPower
```

### **Result Determination**
```typescript
if (offenseRatio >= 2.0) {
  resultType = 'with_ease'
  attackerCasualtyRate = 0.05  // 5%
  defenderCasualtyRate = 0.20  // 20%
} else if (offenseRatio >= 1.2) {
  resultType = 'good_fight'
  attackerCasualtyRate = 0.15  // 15%
  defenderCasualtyRate = 0.15  // 15%
} else {
  resultType = 'failed'
  attackerCasualtyRate = 0.25  // 25%
  defenderCasualtyRate = 0.05  // 5%
}
```

### **Land Calculation**
```typescript
if (resultType === 'with_ease') {
  landPercentage = 0.070 + (Math.random() * 0.0035)  // 7.0-7.35%
  landGained = floor(defenderLand × landPercentage)
} else if (resultType === 'good_fight') {
  landPercentage = 0.0679 + (Math.random() * 0.0021)  // 6.79-7.0%
  landGained = floor(defenderLand × landPercentage)
} else {
  landGained = 0
}
```

---

## 🎯 Example Battles

### **Example 1: With Ease Victory**
```
Attacker: 100 peasants (1 atk), 50 militia (2 atk)
  Total Power: 100×1 + 50×2 = 200

Defender: 50 peasants (1 def), 20 militia (3 def)
  Total Power: 50×1 + 20×3 = 110

Offense Ratio: 200/110 = 1.82 < 2.0 → Good Fight (not With Ease)

Result: Victory (Good Fight)
Your Losses: 15% → 15 peasants, 7 militia
Enemy Losses: 15% → 7 peasants, 3 militia
Land Gained: 6.79-7.0% of 100 = 6-7 acres
Gold Gained: 6-7 × 1000 = 6,000-7,000
```

### **Example 2: True With Ease**
```
Attacker: 200 peasants (1 atk), 100 militia (2 atk)
  Total Power: 200×1 + 100×2 = 400

Defender: 50 peasants (1 def), 20 militia (3 def)
  Total Power: 50×1 + 20×3 = 110

Offense Ratio: 400/110 = 3.64 >= 2.0 → With Ease

Result: Victory (With Ease)
Your Losses: 5% → 10 peasants, 5 militia
Enemy Losses: 20% → 10 peasants, 4 militia
Land Gained: 7.0-7.35% of 100 = 7 acres
Gold Gained: 7 × 1000 = 7,000
```

### **Example 3: Failed Attack**
```
Attacker: 50 peasants (1 atk), 20 militia (2 atk)
  Total Power: 50×1 + 20×2 = 90

Defender: 100 peasants (1 def), 50 militia (3 def)
  Total Power: 100×1 + 50×3 = 250

Offense Ratio: 90/250 = 0.36 < 1.2 → Failed

Result: Defeat (Failed)
Your Losses: 25% → 12 peasants, 5 militia
Enemy Losses: 5% → 5 peasants, 2 militia
Land Gained: 0
Gold Gained: 0
```

---

## 📋 Reference Data Compliance

### **✅ Implemented from Reference**:
- [x] Offense ratio thresholds (2.0, 1.2)
- [x] Casualty rates (5%, 15%, 20%, 25%)
- [x] Land acquisition percentages (6.79-7.35%)
- [x] Gold looting formula (1000 per acre)
- [x] Formation bonus application (percentage-based)

### **🔄 Not Yet Implemented** (Future):
- [ ] Ambush mechanics (95% effectiveness)
- [ ] Controlled Strike (1-100% targeting)
- [ ] Army reduction efficiency (Rule of 0.25%)
- [ ] Summon mechanics (race-specific rates)
- [ ] Fort defense calculations
- [ ] Structure destruction (10% of gained land)
- [ ] Networth scaling for land acquisition

---

## 🎮 Strategic Implications

### **With Ease (2.0x+ power)**:
- **Minimal losses** (5%) - sustainable warfare
- **Maximum land gain** (7.0-7.35%)
- **Optimal for land expansion**
- Enables "Rule of 0.25%" army reduction strategy

### **Good Fight (1.2-2.0x power)**:
- **Moderate losses** (15%) - costly but viable
- **Good land gain** (6.79-7.0%)
- **Balanced risk/reward**
- Requires careful army management

### **Failed (<1.2x power)**:
- **Heavy losses** (25%) - devastating
- **No land gain** (0%)
- **Avoid at all costs**
- Triggers restoration mechanics if severe

---

## 📝 Future Enhancements

### **Phase 2: Advanced Mechanics**
1. **Ambush System**: 95% effectiveness, detection/removal
2. **Controlled Strike**: Precision targeting (1-100%)
3. **Army Efficiency**: Rule of 0.25% reduction
4. **Summon Mechanics**: Race-specific rates (2.5-3.04%)
5. **Fort Defense**: Race-specific fort values
6. **Structure Destruction**: 10% of gained land
7. **Networth Scaling**: Affects land acquisition range

### **Phase 3: Pro Strategies**
1. **Cash Conservation**: Optimal army sizing
2. **Networth Inflation**: Summon optimization
3. **Ambush Counter**: Detection and removal tactics
4. **Progression Strategy**: CS1 → CS100 → Full Strike

---

**Implementation Date**: November 25, 2025  
**Status**: ✅ ALIGNED with reference data  
**Source**: `game-data/mechanics/combat-mechanics.ts`  
**Quality**: Authentic mechanics, strategic depth preserved
