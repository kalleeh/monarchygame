# Decision History - Monarchy Game

## Amplify Gen 2 Migration Decisions

### Decision: Direct Lambda Invocation over API Gateway
**Date**: September 2025  
**Context**: Need for server-side game mechanics with minimal latency  
**Decision**: Use AWS SDK Lambda client for direct function invocation  
**Rationale**: 
- Eliminates API Gateway overhead and cold starts
- Provides type-safe interfaces through AWS SDK v3
- Maintains security through IAM roles and Amplify auth
- Reduces complexity in routing and middleware

### Decision: Ambient Module Declarations for Amplify Imports
**Date**: September 2025  
**Context**: TypeScript compilation errors with `$amplify/env/*` imports  
**Decision**: Create ambient module declarations in `amplify/types.d.ts`  
**Rationale**:
- Follows TypeScript best practices for external module typing
- Provides type safety for environment variable access
- Maintains compatibility with Amplify Gen 2 build system
- Prevents runtime errors from undefined environment variables

### Decision: Server-Side Authority Architecture
**Date**: September 2025  
**Context**: Security vulnerability with client-side game calculations  
**Decision**: Move all authoritative calculations to Lambda functions  
**Rationale**:
- Prevents client-side cheating and manipulation
- Ensures data consistency through atomic DynamoDB transactions
- Maintains game balance through server-validated mechanics
- Provides audit trail through CloudWatch logging

**Trade-offs**:
- Increased Lambda invocation costs
- Slightly higher latency for game actions
- More complex error handling across network boundaries
- **Benefits outweigh costs**: Security and integrity are paramount

### Decision: Game-Data Module Integration
**Date**: August 2025  
**Context**: Need for authentic game mechanics from pro player documentation  
**Decision**: Create centralized `game-data/` modules with exact formulas  
**Rationale**:
- Preserves authentic gameplay mechanics
- Enables easy balance adjustments
- Provides single source of truth for calculations
- Supports both client previews and server authority

### Decision: TypeScript Strict Mode with Type Assertions
**Date**: September 2025  
**Context**: Balance between type safety and development velocity  
**Decision**: Use strict TypeScript with strategic type assertions  
**Rationale**:
- Catches potential runtime errors at compile time
- Provides better IDE support and refactoring safety
- Strategic assertions for AWS SDK and Amplify integration points
- Maintains code quality without excessive boilerplate

### Decision: Vitest over Jest for Testing
**Date**: September 2025  
**Context**: Need for modern testing framework with TypeScript support  
**Decision**: Use Vitest with v8 coverage provider  
**Rationale**:
- Native TypeScript support without additional configuration
- Faster test execution and hot module replacement
- Better ESM support for modern JavaScript patterns
- Integrated coverage reporting with configurable thresholds

## Architecture Decisions

### Decision: React 19 with Concurrent Features
**Date**: August 2025  
**Context**: Need for responsive UI with real-time updates  
**Decision**: Adopt React 19 with concurrent rendering  
**Rationale**:
- Improved performance for complex game interfaces
- Better handling of real-time GraphQL subscriptions
- Enhanced user experience with smoother animations
- Future-proofing for upcoming React features

### Decision: AWS Amplify Gen 2 over Gen 1
**Date**: August 2025  
**Context**: Starting new project with modern AWS tooling  
**Decision**: Use Amplify Gen 2 with TypeScript-first approach  
**Rationale**:
- Better TypeScript integration and type generation
- Simplified configuration with code-first approach
- Improved local development experience
- Long-term support and feature development focus

### Decision: PostgreSQL over DynamoDB for Primary Database
**Date**: August 2025  
**Context**: Complex relational data with ACID requirements  
**Decision**: Use Aurora Serverless v2 with PostgreSQL  
**Rationale**:
- Complex relationships between kingdoms, alliances, territories
- ACID transactions for game state consistency
- Familiar SQL for complex queries and reporting
- GraphQL integration through Amplify data layer

## Technology Stack Decisions

### Decision: Vite over Create React App
**Date**: August 2025  
**Context**: Build tool selection for frontend development  
**Decision**: Use Vite for build tooling and development server  
**Rationale**:
- Significantly faster development server startup
- Better ESM support and tree shaking
- More flexible configuration options
- Active development and community support

### Decision: React Flow for Interactive Maps
**Date**: August 2025  
**Context**: Need for interactive territory visualization  
**Decision**: Use React Flow for world map implementation  
**Rationale**:
- Excellent performance with large node graphs
- Built-in zoom, pan, and selection capabilities
- Extensible with custom node and edge types
- Strong TypeScript support and documentation


## April 2026 Architecture Decisions

### Decision: Direct DynamoDB SDK over Amplify Data Client in Lambda
**Date**: March 2026  
**Context**: Amplify Data Client requires model_introspection from amplify_outputs.json which is unavailable in Lambda bundles  
**Decision**: Use direct DynamoDB SDK via shared `data-client.ts` module  
**Rationale**:
- Table names auto-discovered via ListTables API at cold start
- Provides dbGet, dbCreate, dbUpdate, dbDelete, dbQuery, dbConditionalUpdate, dbBatchWrite
- parseJsonField handles DynamoDB's string-serialized JSON fields consistently
- No dependency on Amplify frontend libraries in Lambda

### Decision: Shared verifyOwnership Utility
**Date**: April 2026  
**Context**: Ownership verification was copy-pasted across all 19 Lambda handlers (~8 lines each)  
**Decision**: Extract to shared `verify-ownership.ts` utility  
**Rationale**:
- Checks all Cognito identity representations (sub, username, email, preferred_username, cognito:username)
- Returns null on success or error object on failure
- Reduces duplication from ~150 lines to 19 one-line calls

### Decision: GSI Queries over Full Table Scans
**Date**: April 2026  
**Context**: Lambda handlers used `dbList` (DynamoDB Scan) filtered client-side, which is O(n) on table size  
**Decision**: Add GSIs and use `dbQuery` for all relationship lookups  
**Rationale**:
- 10 GSIs across 10 models cover all common query patterns
- Reduces DynamoDB read costs by 10-100x at scale
- Eliminates scalability bottleneck for 500+ kingdom games

### Decision: In-Memory Rate Limiting over DynamoDB-Based
**Date**: April 2026  
**Context**: Need server-side rate limiting to prevent Lambda spam from malicious clients  
**Decision**: In-memory sliding window per Lambda instance  
**Rationale**:
- Sufficient for expected scale (50-200 concurrent players)
- Zero additional infrastructure cost
- Per-action limits (5 combat/min, 10 builds/min, etc.)
- Trade-off: not distributed — concurrent Lambda instances each have their own window

### Decision: CloudWatch Monitoring Stack
**Date**: April 2026  
**Context**: Production deployment needs observability  
**Decision**: CDK-defined monitoring in backend.ts with dedicated stack  
**Rationale**:
- 3 alarms: Lambda errors (≥5/5min), p99 duration (>10s), DynamoDB throttles (≥10/5min)
- Dashboard with 4 widgets (invocations, errors, duration p50/p99, throttles)
- SNS topic for alert notifications
- Deployed automatically with `ampx deploy`

### Decision: Keep 17 Zustand Stores Separate (Not Consolidate)
**Date**: April 2026  
**Context**: Considered merging combatStore + combatReplayStore + formationStore  
**Decision**: Keep stores separate  
**Rationale**:
- Many small stores is the Zustand-recommended pattern
- The 3 stores map to distinct lifecycle phases: prepare → execute → review
- Data flows one direction (no bidirectional dependency)
- combatReplayStore uses `persist` middleware — merging would complicate persistence
- Separate stores enable independent future evolution (replay export, formation sharing, spectator mode)