# Monarchy Game - Quality Standards

**Purpose:** Code quality rules and standards  
**When to use:** Code review, quality validation, development guidelines  
**Policy:** Zero tolerance - all standards are non-negotiable

---

## Quality Achievement Status

**Current Metrics (November 2025):**
- ✅ **TypeScript:** 0 compilation errors (strict mode)
- ✅ **ESLint:** 0 errors, 0 warnings
- ✅ **Tests:** 53/53 passing (100%)
- ✅ **Build:** Production ready (1.44MB, 3.35s)
- ✅ **Production Ready:** Yes

---

## Zero Tolerance Quality Policy

### Absolute Quality Requirements

**MANDATORY: Every single piece of code MUST:**
1. ✅ **Pass all linting checks** - Zero linting errors allowed
2. ✅ **Follow strict language standards** - Proper type annotations, no shortcuts
3. ✅ **Use proper import organization** - Sorted, unused imports removed
4. ✅ **Follow naming conventions** - Consistent style across codebase
5. ✅ **Include proper error handling** - No unhandled promises, comprehensive try/catch
6. ✅ **Have complete documentation** - Clear comments and API documentation
7. ✅ **Pass type checking** - Strict compliance with type systems

---

## Quality Enforcement Protocol

### Before Writing Code (CHECKPOINT 1)
- **MANDATORY: Zero errors policy confirmed**
- **Use sequential_thinking for comprehensive analysis**
- **Research current best practices**
- **Verify framework documentation**
- **Analyze project context and existing patterns**
- **Translate requirements into behavior scenarios**

### During Implementation (CHECKPOINT 2)
- **MANDATORY: Immediate quality validation after EVERY code change**
- **Apply technology-specific quality standards**
- **Validate implementation approach with research tools**
- **Use sequential_thinking for complex decisions**
- **Generate quality-first code from the start**

### Before Completion (CHECKPOINT 3)
- **MANDATORY: Final quality validation - zero tolerance enforcement**
- **Use sequential_thinking for comprehensive review**
- **Validate final implementation against current best practices**
- **Confirm zero errors across entire codebase**

---

## Code Quality Requirements

### Linting Standards
- **Zero errors or warnings**
- **ESLint configuration:** Strict mode enabled
- **Auto-fix on save:** Enabled in development
- **Pre-commit hooks:** Enforce linting before commits

### Type Safety
- **TypeScript strict mode:** Enabled
- **No explicit any types:** Use proper types or unknown
- **Complete type coverage:** All functions and variables typed
- **Interface definitions:** Comprehensive for all data structures

### Testing Requirements
- **Unit Tests:** All functions and methods
- **Integration Tests:** Component interactions
- **Edge Cases:** Boundary conditions and error scenarios
- **Behavior Tests:** User-facing functionality
- **Property-Based Tests:** Universal invariants and game balance
- **Coverage:** Minimum 90% for critical paths

### Property-Based Testing Integration
- **Use PBT for game balance** - Race balance, combat mechanics, economic systems
- **Test invariants** - Rules that must always hold true across all inputs
- **Generate test cases** - Hundreds of automatically generated scenarios
- **Follow Kiro methodology** - Properties as universal statements ("For any...")
- **Framework**: fast-check (JavaScript equivalent of Kiro's Hypothesis)

### Documentation Standards
- **API Documentation:** Complete parameter and return descriptions
- **Inline Comments:** Complex logic explanation
- **README Updates:** Project setup and usage
- **Architecture Decisions:** Rationale documentation
- **Examples:** Working code samples

---

## React & Frontend Standards

### Component Quality
```typescript
// ✅ CORRECT: Proper TypeScript interface
interface Props {
  text: string;
  onClick: () => void;
}

function Component({ text, onClick }: Props) {
  return <button onClick={onClick}>{text}</button>;
}

// ❌ WRONG: PropTypes (deprecated in React 19)
Component.propTypes = { text: PropTypes.string };
```

### Hook Dependencies
```typescript
// ✅ CORRECT: Complete dependency arrays
useEffect(() => {
  console.log(count);
}, [count]);

// ✅ CORRECT: Memoized with complete dependencies
const handleSubmit = useCallback((orderDetails) => {
  post('/product/' + productId + '/buy', {
    referrer,
    orderDetails
  });
}, [productId, referrer]);

// ✅ CORRECT: Only recalculates when dependencies change
const visibleItems = useMemo(() => {
  return searchItems(allItems, searchOptions);
}, [allItems, searchOptions]);
```

### Error Handling
```typescript
// ✅ CORRECT: Comprehensive error handling
try {
  if (!input) {
    throw new Error('Input is required');
  }
  
  const result = await operation(input);
  return result;
} catch (error) {
  logger.error('Operation failed', { input, error });
  throw error;
}
```

---

## AWS Amplify Gen 2 Standards

### GraphQL Schema
```typescript
// ✅ CORRECT: Proper authorization patterns
const schema = a.schema({
  Kingdom: a.model({
    // fields
  }).authorization((allow) => [allow.authenticated()]),
  
  BattleReport: a.model({
    // fields  
  }).authorization((allow) => [allow.owner()]),
});
```

### Lambda Functions
```typescript
// ✅ CORRECT: Proper error handling and validation
export const handler = async (event: any) => {
  try {
    // Input validation
    const input = JSON.parse(event.body);
    if (!input.kingdomId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'kingdomId required' })
      };
    }
    
    // Business logic
    const result = await processAction(input);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

---

## Anti-Patterns Prevention

### Never Use These Patterns
1. **Loose typing** (any, unknown without proper handling)
2. **Unused variables/imports** (clean code violation)
3. **Missing error handling** (unhandled promises/exceptions)
4. **Inconsistent naming** (mixed conventions)
5. **Security vulnerabilities** (injection, XSS, etc.)
6. **Performance anti-patterns** (unnecessary loops, memory leaks)
7. **Untested code** (missing test coverage)

---

## Implementation Quality Checklist

### Immediate Validation (Run after EVERY code change)
- [ ] **Zero linting errors** (language-specific linter compliance)
- [ ] **Zero type errors** (strict type checking compliance)
- [ ] **No unused variables/imports** (clean code standards)
- [ ] **Proper naming conventions** (consistent style)
- [ ] **Complete error handling** (no unhandled promises/exceptions)
- [ ] **Full documentation** (API and inline documentation)
- [ ] **Security compliance** (no security anti-patterns)

### Final Quality Gates
- [ ] **All tests passing** (unit, integration, e2e)
- [ ] **Build succeeds** (compilation/bundling successful)
- [ ] **No regressions** (existing functionality preserved)
- [ ] **Performance acceptable** (meets performance requirements)
- [ ] **Documentation complete** (API docs and examples)

---

## Validation Commands

```bash
# TypeScript Compilation
npx tsc --noEmit
# Result: ✅ 0 errors

# ESLint Check
npm run lint
# Result: ✅ 0 errors, 0 warnings

# Test Suite
npm test -- --run
# Result: ✅ 53/53 tests passing (100%)

# Production Build
npm run build
# Result: ✅ SUCCESS (1.44MB, 3.35s)
```

---

## Failure Recovery Protocol

If any quality issue is detected:
1. **STOP immediately** - Do not provide code with quality issues
2. **Use sequential_thinking to analyze the failure systematically**
3. **Research similar issues**
4. **Consult documentation**
5. **Only provide code after ALL quality issues are resolved**

---

## Performance Standards

### Build Metrics
```
Bundle Size:     1.44MB (optimized)
Build Time:      3.35s
Load Time:       <3s on 3G
Lighthouse:      95+ Performance
```

### Optimization Requirements
- **Code Splitting:** Lazy loading for heavy components
- **State Optimization:** useMemo, useCallback for performance
- **Asset Optimization:** Image compression, font subsetting

---

## Security Standards

### Server-Side Authority
- ✅ All resource changes happen in Lambda functions only
- ✅ Atomic DynamoDB transactions prevent race conditions
- ✅ Input validation with AWS Powertools schemas
- ✅ Conditional expressions ensure data consistency

### Client-Side Safety
- ✅ Frontend only makes preview calculations (clearly marked)
- ✅ All authoritative calculations moved to Lambda
- ✅ No direct database access from frontend
- ✅ Proper error handling and user feedback

---

## Accessibility Standards

**WCAG 2.1 AA Compliance:**
- Contrast ratio: 4.5:1 minimum for normal text
- Contrast ratio: 3:1 minimum for large text
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

---

**Last Updated:** November 2025  
**Status:** Production-ready standards  
**Compliance:** 100% across all metrics
