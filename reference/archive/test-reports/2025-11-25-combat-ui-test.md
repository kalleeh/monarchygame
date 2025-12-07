# Combat UI Test Report

**Date**: November 25, 2025, 21:20 CET  
**Test Method**: Playwright Browser Automation  
**Status**: ⚠️ **ISSUES IDENTIFIED**

---

## 🎯 Test Objective

Test the combat interface to verify:
1. Multiple unit selection functionality
2. Attack execution with selected units
3. Terrain and formation selection
4. Overall combat flow

---

## 🔍 Test Results

### **Issue #1: Unit Selection Not Working Properly** ⚠️

**Severity**: HIGH  
**Impact**: Users cannot select multiple units for battle

**Observed Behavior**:
- Clicking on a unit shows visual feedback (button becomes "active")
- However, "Selected Units" counter remains at 0
- Only one unit can be "active" at a time (single selection mode)
- Clicking another unit deselects the previous one

**Expected Behavior**:
- Multiple units should be selectable simultaneously
- "Selected Units (X)" counter should increment with each selection
- All selected units should show "active" state
- "Execute Battle" button should enable when units are selected

**Evidence**:
```yaml
# After clicking peasant unit:
button "👨‍🌾 peasant 100 ⚔️1 🛡️1" [active]
heading "Selected Units (0)"  # ❌ Should be (1)

# After clicking militia unit:
button "🛡️ militia 50 ⚔️2 🛡️3" [active]
button "👨‍🌾 peasant 100 ⚔️1 🛡️1"  # ❌ No longer active
heading "Selected Units (0)"  # ❌ Should be (2)
```

---

### **Issue #2: Execute Battle Button Remains Disabled** ⚠️

**Severity**: HIGH  
**Impact**: Users cannot execute attacks even after selecting target

**Observed Behavior**:
- "Execute Battle" button is always disabled
- Remains disabled even after:
  - Selecting a target kingdom
  - Clicking on units
  - Selecting terrain
  - Selecting formation

**Expected Behavior**:
- Button should enable when:
  - At least one unit is selected
  - A target kingdom is selected
  - Sufficient turns available

**Evidence**:
```yaml
# After selecting target and clicking units:
combobox: 'option "Northern Empire (Elven) - Land: 65" [selected]'
button "⚔️ knight 25 ⚔️4 🛡️4" [active]
button "Execute Battle" [disabled]  # ❌ Should be enabled
```

---

## 🔧 Root Cause Analysis

### **Code Investigation**

**File**: `frontend/src/components/BattleFormations.tsx`

**Unit Toggle Handler** (Line 145):
```typescript
const handleUnitToggle = (unitId: string) => {
  const isSelected = selectedUnits.some(u => u.id === unitId);
  console.log('Toggle unit:', unitId, 'Currently selected:', isSelected, 'Total selected:', selectedUnits.length);
  if (isSelected) {
    deselectUnit(unitId);
  } else {
    selectUnit(unitId);
  }
  // Log after action
  setTimeout(() => {
    console.log('After toggle, selected units:', selectedUnits.length);
  }, 100);
};
```

**Combat Store** (`frontend/src/stores/combatStore.ts`, Line 100):
```typescript
selectUnit: (unitId: string) => {
  const state = get();
  const unit = state.availableUnits.find(u => u.id === unitId);
  if (unit && !state.selectedUnits.find(u => u.id === unitId)) {
    set((state) => ({
      selectedUnits: [...state.selectedUnits, unit]
    }));
  }
},
```

**Potential Issues**:
1. **State Not Updating**: The `selectUnit` function may not be triggering re-renders
2. **Unit ID Mismatch**: The `unitId` passed might not match `availableUnits` IDs
3. **Drag-and-Drop Interference**: The DnD library might be intercepting clicks
4. **Available Units Empty**: `availableUnits` array might be empty on initialization

---

## 🧪 Additional Observations

### **Working Features** ✅
1. **Target Selection**: Dropdown works correctly
2. **Terrain Selection**: Buttons are clickable and functional
3. **Formation Selection**: Buttons are clickable and functional
4. **Visual Feedback**: Units show "active" state on click
5. **Drag-and-Drop**: Units can be reordered (status messages confirm)

### **UI State**
```yaml
Battle Statistics:
  - Total Battles: 0
  - Win Rate: 0%
  - Land Gained: 0

Available Units:
  - peasant: 100 (⚔️1 🛡️1)
  - militia: 50 (⚔️2 🛡️3)
  - knight: 25 (⚔️4 🛡️4)
  - cavalry: 10 (⚔️5 🛡️2)
  - archer: 30 (⚔️3 🛡️1)
  - mage: 5 (⚔️6 🛡️2)

Terrain Options: Plains, Forest, Mountains, Swamp, Desert
Formation Options: Defensive Wall, Cavalry Charge, Balanced Formation
```

---

## 🐛 Suspected Bugs

### **Bug #1: Unit Selection State Not Persisting**
**Location**: `combatStore.ts` or `BattleFormations.tsx`  
**Hypothesis**: The `selectUnit` action is called but state doesn't update properly

**Debug Steps Needed**:
1. Check if `availableUnits` is populated on mount
2. Verify `unitId` matches between component and store
3. Add console logs to `selectUnit` function
4. Check if Zustand store is properly subscribed

### **Bug #2: Execute Battle Button Logic**
**Location**: `BattleFormations.tsx` (line ~160)  
**Hypothesis**: Button enable condition is too strict or checking wrong state

**Current Condition**:
```typescript
const handleExecuteBattle = async () => {
  if (selectedUnits.length > 0) {
    await executeBattle('enemy-territory');
  }
};
```

**Button Render** (needs verification):
```typescript
<button
  onClick={handleExecuteBattle}
  disabled={selectedUnits.length === 0 || !selectedTarget}
>
  Execute Battle
</button>
```

---

## 📋 Recommended Fixes

### **Fix #1: Debug Unit Selection** (Priority: HIGH)

**Step 1**: Add console logging to combat store:
```typescript
selectUnit: (unitId: string) => {
  const state = get();
  console.log('selectUnit called:', unitId);
  console.log('availableUnits:', state.availableUnits);
  const unit = state.availableUnits.find(u => u.id === unitId);
  console.log('Found unit:', unit);
  if (unit && !state.selectedUnits.find(u => u.id === unitId)) {
    console.log('Adding unit to selection');
    set((state) => ({
      selectedUnits: [...state.selectedUnits, unit]
    }));
  } else {
    console.log('Unit not added - already selected or not found');
  }
},
```

**Step 2**: Verify `initializeCombatData` populates units:
```typescript
initializeCombatData: () => {
  const mockUnits: Unit[] = [
    { id: 'peasant-1', type: 'peasant', count: 100, attack: 1, defense: 1, health: 100 },
    { id: 'militia-1', type: 'militia', count: 50, attack: 2, defense: 3, health: 100 },
    // ... more units
  ];
  console.log('Initializing combat data with units:', mockUnits);
  set({ availableUnits: mockUnits });
},
```

**Step 3**: Check if DnD is blocking clicks:
```typescript
// In SortableUnit component, separate drag and click handlers:
<div
  ref={setNodeRef}
  style={style}
  {...attributes}
  className={`unit-card ${isSelected ? 'selected' : ''}`}
>
  <div {...listeners} className="drag-handle">⋮⋮</div>
  <div onClick={onToggle} className="unit-content">
    {/* Unit content */}
  </div>
</div>
```

### **Fix #2: Enable Execute Battle Button** (Priority: HIGH)

**Current Issue**: Button is always disabled

**Fix**: Update button condition to check both units and target:
```typescript
<button
  onClick={handleExecuteBattle}
  disabled={selectedUnits.length === 0 || !selectedTarget || loading}
  className="execute-battle-btn"
>
  {loading ? 'Executing...' : 'Execute Battle'}
</button>
```

**Verify State**: Ensure `selectedTarget` is properly set:
```typescript
const [selectedTarget, setSelectedTarget] = useState<string>('');

// In select handler:
onChange={(e) => {
  console.log('Target selected:', e.target.value);
  setSelectedTarget(e.target.value);
}}
```

---

## 🎯 Testing Checklist

### **Manual Testing After Fixes**
- [ ] Click on peasant unit → "Selected Units (1)"
- [ ] Click on militia unit → "Selected Units (2)"
- [ ] Click on knight unit → "Selected Units (3)"
- [ ] All three units show "active" state
- [ ] Select target kingdom from dropdown
- [ ] "Execute Battle" button becomes enabled
- [ ] Click "Execute Battle" → Battle executes
- [ ] Battle report appears
- [ ] Selected units are cleared after battle

### **Edge Cases**
- [ ] Click same unit twice → Deselects unit
- [ ] Select all units → All show active
- [ ] Deselect all units → Button disables
- [ ] Change target mid-selection → Selection persists
- [ ] Drag unit while selected → Selection persists

---

## 📊 Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Unit Selection | ❌ BROKEN | State not updating |
| Multiple Selection | ❌ BROKEN | Only single selection works |
| Execute Button | ❌ BROKEN | Always disabled |
| Target Selection | ✅ WORKING | Dropdown functional |
| Terrain Selection | ✅ WORKING | Buttons functional |
| Formation Selection | ✅ WORKING | Buttons functional |
| Drag-and-Drop | ✅ WORKING | Reordering works |

**Overall Status**: ⚠️ **COMBAT SYSTEM NON-FUNCTIONAL**

**Critical Path Blocked**: Users cannot execute attacks due to unit selection failure.

---

## 🚀 Next Steps

1. **Immediate** (30 minutes):
   - Add debug logging to `selectUnit` function
   - Verify `availableUnits` initialization
   - Check console for errors during unit clicks

2. **Short Term** (1-2 hours):
   - Fix unit selection state management
   - Separate drag handlers from click handlers
   - Enable Execute Battle button with proper conditions

3. **Testing** (30 minutes):
   - Manual test all unit selection scenarios
   - Verify multiple selection works
   - Test complete attack flow end-to-end

---

**Report Generated**: November 25, 2025, 21:20 CET  
**Test Environment**: Playwright + Chrome  
**Application URL**: http://localhost:5173  
**Status**: ⚠️ CRITICAL ISSUES IDENTIFIED
