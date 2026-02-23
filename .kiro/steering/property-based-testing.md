# Property-Based Testing Guidelines - Monarchy Game

**Purpose:** When and how to use Property-Based Testing (PBT) following Kiro best practices  
**When to use:** Complex systems with invariants, game balance, business logic validation  
**Framework:** fast-check (JavaScript equivalent of Kiro's Hypothesis)

---

## When to Use Property-Based Testing

### ✅ **Perfect Use Cases**
- **Game Balance Testing** - Race balance, combat mechanics, economic systems
- **Business Logic Invariants** - Rules that must always hold true
- **Data Structure Operations** - Serialization/deserialization, transformations
- **API Contracts** - Input validation, idempotency, round-trip properties
- **Mathematical Functions** - Calculations that have universal properties

### ❌ **Avoid PBT For**
- **Simple Unit Tests** - Single input/output examples
- **UI Component Testing** - Visual/interaction testing
- **Integration Tests** - External service dependencies
- **Performance Testing** - Timing-sensitive operations

---

## Kiro PBT Methodology

### 1. **Properties as Universal Statements**
Properties start with "For any..." and express invariants:

```typescript
// ✅ CORRECT: Universal property
it('property: combat strength monotonicity', () => {
  fc.assert(fc.property(
    fc.integer({ min: 100, max: 10000 }),
    fc.integer({ min: 100, max: 10000 }),
    (attackerStr, defenderStr) => {
      // For any attacker stronger than defender, land should be gained
      return attackerStr > defenderStr * 2 
        ? calculateLandGained(attackerStr, defenderStr) > 0
        : true;
    }
  ));
});

// ❌ WRONG: Example-based test
it('should gain 100 land when attacking with 2000 vs 1000', () => {
  expect(calculateLandGained(2000, 1000)).toBe(100);
});
```

### 2. **Common Property Shapes**

**Invariant Properties:**
```typescript
// Something that should always be true
it('property: resource conservation invariant', () => {
  fc.assert(fc.property(
    fc.record({ gold: fc.nat(), land: fc.nat() }),
    (kingdom) => {
      const before = getTotalResources(kingdom);
      const after = getTotalResources(processAction(kingdom, 'build'));
      return after <= before; // Resources never increase without cause
    }
  ));
});
```

**Round-Trip Properties:**
```typescript
// Serialize then deserialize should return original
it('property: kingdom serialization round-trip', () => {
  fc.assert(fc.property(
    kingdomGenerator,
    (kingdom) => {
      const serialized = serializeKingdom(kingdom);
      const deserialized = deserializeKingdom(serialized);
      return deepEqual(kingdom, deserialized);
    }
  ));
});
```

**Idempotency Properties:**
```typescript
// Doing operation twice = doing it once
it('property: delete operation idempotency', () => {
  fc.assert(fc.property(
    fc.string(),
    (kingdomId) => {
      const result1 = deleteKingdom(kingdomId);
      const result2 = deleteKingdom(kingdomId);
      return result1.status === result2.status;
    }
  ));
});
```

### 3. **Input Generation Strategies**

**Use Domain-Specific Generators:**
```typescript
// Custom generators for game entities
const kingdomGenerator = fc.record({
  id: fc.string(),
  race: fc.constantFrom('Human', 'Droben', 'Sidhe', 'Elven'),
  land: fc.integer({ min: 1000, max: 50000 }),
  resources: fc.record({
    gold: fc.nat(),
    population: fc.nat(),
    mana: fc.nat()
  })
});

const combatScenarioGenerator = fc.record({
  attacker: kingdomGenerator,
  defender: kingdomGenerator,
  attackType: fc.constantFrom('standard', 'raid', 'siege')
});
```

---

## Implementation Standards

### File Organization
```
src/
├── __tests__/
│   ├── unit/                    # Example-based tests
│   ├── integration/             # Service integration tests
│   └── property-based/          # PBT tests
│       ├── balance.property.test.ts
│       ├── combat.property.test.ts
│       └── generators/
│           ├── kingdom.generator.ts
│           └── combat.generator.ts
```

### Naming Conventions
- **Test Files**: `*.property.test.ts`
- **Test Names**: `property: [description]`
- **Generators**: `[entity]Generator`

### Configuration
```typescript
// Configure fast-check for game testing
const config = {
  numRuns: 100,        // Default test cases
  maxSkipsPerRun: 100, // Skip invalid inputs
  seed: 42,            // Reproducible tests
  verbose: true        // Show counterexamples
};

fc.configureGlobal(config);
```

---

## Quality Standards

### Property Test Requirements
- [ ] **Universal Statement** - Property starts with "For any..."
- [ ] **Clear Invariant** - What should always be true
- [ ] **Appropriate Generators** - Domain-specific input generation
- [ ] **Preconditions** - Filter invalid inputs with `fc.pre()`
- [ ] **Meaningful Assertions** - Test actual business logic
- [ ] **Shrinking Support** - Minimal failing examples

### Example Template
```typescript
it('property: [invariant description]', () => {
  fc.assert(fc.property(
    // Input generators
    generator1,
    generator2,
    (input1, input2) => {
      // Preconditions (if needed)
      fc.pre(isValidInput(input1, input2));
      
      // Execute operation
      const result = systemUnderTest(input1, input2);
      
      // Assert invariant
      return invariantHolds(result, input1, input2);
    }
  ), { numRuns: 200 }); // Adjust runs for complex properties
});
```

---

## Integration with Existing Tests

### Complement, Don't Replace
- **Keep unit tests** for specific examples and edge cases
- **Add PBT** for invariants and universal properties
- **Use integration tests** for service boundaries

### Test Pyramid with PBT
```
    E2E Tests (Few)
   ─────────────────
  Integration Tests
 ───────────────────
Property-Based Tests  ← New layer
─────────────────────
   Unit Tests (Many)
```

---

## Debugging Failed Properties

### When Properties Fail
1. **Examine the counterexample** - fast-check provides minimal failing case
2. **Check preconditions** - Are inputs valid for the property?
3. **Verify the property** - Is the invariant correctly stated?
4. **Fix the implementation** - Or update the property if specification changed

### Example Debugging
```typescript
// Failed property shows minimal counterexample:
// Counterexample: { attacker: 1000, defender: 999, expected: true, actual: false }

// This reveals edge case: equal strength should not guarantee land gain
it('property: combat strength advantage', () => {
  fc.assert(fc.property(
    fc.integer({ min: 100, max: 10000 }),
    fc.integer({ min: 100, max: 10000 }),
    (attackerStr, defenderStr) => {
      // Fixed: require significant advantage
      fc.pre(attackerStr > defenderStr * 1.2); // Precondition
      return calculateLandGained(attackerStr, defenderStr) > 0;
    }
  ));
});
```

---

## Performance Considerations

### Test Execution
- **Start with 100 runs** for development
- **Increase to 1000+ runs** for CI/CD
- **Use seeds** for reproducible failures
- **Parallel execution** for independent properties

### Generator Efficiency
- **Avoid expensive generators** in tight loops
- **Cache complex objects** when possible
- **Use `fc.pre()` sparingly** - prefer better generators

---

**Last Updated:** December 2025  
**Framework:** fast-check v3.x  
**Methodology:** Kiro PBT best practices
