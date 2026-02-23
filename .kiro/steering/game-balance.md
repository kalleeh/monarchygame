---
inclusion: manual
---

# Game Balance and Testing Strategy

## Balance System Overview

### Mathematical Foundation
- **Comprehensive balance formulas**: 12,077 lines of exact calculations
- **10 race balance**: Precise summon rates and racial abilities
- **Combat system**: Land acquisition formulas with thresholds
- **Economic balance**: Build rates and resource optimization
- **Mathematical optimization**: Based on pro player documentation

### Balance Principles

#### Race Balance Standards
- No race should have >60% or <40% win rate in balanced play
- Maximum 60% difference between strongest and weakest races
- Each race has distinct advantages and viable strategies
- Racial bonuses create meaningful strategic choices

#### Combat Balance Thresholds
- **With Ease**: 2:1 attack ratio → 6.79-7.35% land gain
- **Good Fight**: 1.2:1 attack ratio → 6.7-7.0% land gain  
- **Failed Attack**: <1.2:1 ratio → 0% land gain
- Land gain calculations preserve competitive balance

#### Economic Balance
- **Optimal Build Rate**: 16-20% for competitive play
- **Resource efficiency**: Balanced across all races
- **Progression curves**: Clear power scaling paths
- **Economic strategies**: Viable alternative to military focus

## Testing Strategy

### Automated Balance Testing
```typescript
// Balance validation framework
describe('Race Balance Matrix', () => {
  test('all races competitive in 1000+ game simulation', () => {
    // Test each race against all others
    // Validate win rates within 40-60% range
    // Ensure no dominant strategies
  })
})
```

### AI Simulation Framework
- **AI Players**: Use balance formulas for optimal decisions
- **Strategy Types**: Aggressive, defensive, economic, balanced
- **Game Simulation**: Complete games between AI players
- **Statistical Analysis**: Large-scale balance validation

### Performance Benchmarks
- **Formula Accuracy**: UI calculations match balance formulas 100%
- **Test Performance**: Complete suite runs in <10 minutes
- **Regression Prevention**: Automated tests in CI/CD pipeline

## Balance Monitoring

### Quality Gates
1. Race balance within acceptable variance
2. Strategy viability across all approaches  
3. Formula integration accuracy
4. Performance requirements met
5. No regression in balance changes

### Analytics Dashboard
- Real-time balance monitoring
- Race performance tracking
- Strategy effectiveness analysis
- Balance issue detection and recommendations

## Implementation Guidelines

### Balance Formula Integration
- All UI components must use official balance formulas
- No hardcoded values or approximations
- Consistent calculation methods across features
- Real-time validation of balance adherence

### Testing Requirements
- Unit tests for all balance formulas
- Integration tests for UI calculations
- Simulation tests for race balance
- Performance tests for calculation speed

### Balance Maintenance
- Regular balance analysis reports
- Automated detection of balance issues
- Version-controlled balance parameters
- Historical balance tracking and analysis
