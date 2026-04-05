# Active Tasks & Development Tracking

**Purpose:** Current work, recent decisions, and next steps  
**When to use:** Understanding current development status and priorities  
**Updated:** 2026-04-05

---

## Current Status: Production Ready

All planned features, code quality improvements, and backlog items are complete.

### Completed (April 2026 Sprint)
- ✅ All 5 feature enhancement streams (Tutorial, Leaderboard, Achievements, Combat Mechanics, Guild Warfare)
- ✅ All 3 remaining streams (E: Combat Replay, F: Guild Browser, G: Achievement Widget)
- ✅ Server-side rate limiting on all expensive Lambda handlers
- ✅ CloudWatch monitoring: 3 alarms + dashboard + SNS alerts
- ✅ Shared `verifyOwnership` utility — eliminated ownership check duplication across 11 handlers
- ✅ Shared `parseJsonField` — standardized JSON parsing across all handlers
- ✅ `dbQuery` with GSIs — replaced full-table scans in 8 handlers (13 scan replacements)
- ✅ `dbConditionalUpdate` — atomic trade offer acceptance (race condition fix)
- ✅ 5 new GSIs added (CombatNotification, TradeOffer, DiplomaticRelation, Treaty, AllianceInvitation)
- ✅ Dead code removed: amplify-configure.ts, backend-monitoring.ts, CombatPage, LazyKingdomCreation, TradeEconomy, MagicSystem, ResourceDisplay, ErrorAlert
- ✅ Tailwind utility classes replaced with inline styles (LoadingSkeleton, LoadingButton, Spinner, Skeleton)
- ✅ Accessibility: skip-to-content, focus traps in HelpModal/UnitRoster/DeclareWarModal, WCAG color contrast
- ✅ AppRouter refactored: 4 inline components extracted (KingdomList, BattleReportsRoute, ReplaysListRoute, ReplayRoute)
- ✅ kingdom-cleanup: proper resource.ts + package.json, registered in backend.ts
- ✅ DynamoDB permissions scoped to `*-NONE` table ARN pattern (least privilege)
- ✅ fetchWorldState handler added to season-manager
- ✅ 4 shared mechanics test failures fixed
- ✅ All documentation updated

### Completed (April 5, 2026 — 6 Deep Scan Passes, ~65 bugs fixed)

#### Security Fixes
- ✅ territory-claimer: server-side goldCost computation (was client-trusted — free upgrades exploit)
- ✅ season-manager fetchWorldState: ownership verification (was leaking fog-of-war data)
- ✅ trade-processor: integer validation on quantity/pricePerUnit (fractional values allowed free trades)
- ✅ unit-trainer: goldCostPerUnit bounds (MIN=50, MAX=4000) to prevent 1-gold tier-3 training
- ✅ bounty-processor: server-side landGained verification via BattleReport GSI query
- ✅ verify-ownership: delimiter-aware matching (was substring — false positive risk)
- ✅ Self-target checks added to thievery-processor and spell-caster
- ✅ faith-processor: 'faith' added to restoration blocked actions list

#### Combat System Fixes
- ✅ Casualty calculation uses real unit counts (was using bonus-inflated effective counts)
- ✅ Siege casualty inflation capped to real unit count (battle reports were inaccurate)
- ✅ Demo-mode casualties keyed by unit.type (was unit.id — units were immortal)
- ✅ Combat rate limit increased from 5 to 10 per minute

#### Data Integrity Fixes
- ✅ All inline JSON.parse → parseJsonField across season-lifecycle (7), turn-ticker (4), faith-processor (1)
- ✅ sidheBuildings written as object (was JSON.stringify — mixed serialization)
- ✅ data-client: ListTables paginated (handles >100 tables in shared AWS accounts)
- ✅ data-client: dbBatchWrite retries UnprocessedItems with exponential backoff
- ✅ season-lifecycle: per-item error handling in ranking and trade refund loops
- ✅ turn-ticker: encamp bonus off-by-one fixed (+1 for already-applied tick)

#### Frontend Robustness
- ✅ DiplomacyService: 4 phantom GraphQL queries + 1 subscription replaced with real model queries
- ✅ localStorage JSON.parse wrapped in try/catch (kingdomStore, tradeStore, achievementTriggers, GuildBrowse, GuildOverview)
- ✅ CombatReplayViewer: handles empty rounds array (server-loaded replays)
- ✅ Demo combat mock response shape fixed (was causing JSON.parse crash)
- ✅ Toaster added to demo mode render path (notifications were silently lost)
- ✅ /admin added to protectedRoutes

#### Infrastructure
- ✅ kingdom-cleanup: missing await on checkRateLimit
- ✅ ErrorCode enum: added RATE_LIMITED
- ✅ Shared KingdomResources: added mana field
- ✅ package.json added to 6 Lambda function directories
- ✅ Thievery-processor: removed redundant scum_kill dbGet
- ✅ Leaderboard.css: added missing bounty table/tab styles

### Backlog Items Cleared (April 5, 2026)
- ✅ DynamoDB rate limiter — already implemented (was incorrectly listed as in-memory)
- ✅ Territory system — already coherent (single store + component + Lambda; legacy TerritoryManagement.tsx is dead code)
- ✅ Additional GSIs — DiplomaticRelation.targetKingdomId added (only missing one; all others already existed)
- ✅ Bundle size optimization — React Flow lazy-loaded with WorldMap (~172KB off initial page load)

### Quality Metrics
- **Tests:** 778/778 passing (220 backend + 433 shared + 125 frontend)
- **TypeScript:** 0 compilation errors (strict mode)
- **ESLint:** 0 errors, 0 warnings
- **Build:** 1.64MB JS, ~4s
- **Lambda Functions:** 19 registered + 2 EventBridge schedules
- **E2E Tests:** 21 Playwright specs (audited, no stale selectors)
- **Security:** 6 input validation exploits fixed, ownership checks on all handlers
- **Codebase scans:** 6 passes, ~65 bugs fixed, no actionable issues remaining

---

## Remaining Backlog

### Production Deployment
- Deploy to AWS Amplify production (monarchy.gurum.se)
- Subscribe to SNS alert topic for monitoring notifications
- Validate CloudWatch dashboard and alarms

---

**Last Updated:** 2026-04-05  
**Status:** Production ready, deployment pending
