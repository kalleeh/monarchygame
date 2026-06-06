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
- ✅ `ampx pipeline-deploy` fixed — pinned @aws-amplify deps to exact versions (build 406)
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

## Deep Scan — 2026-06-06 (4 parallel reviewers, all findings verified against source)

Reviewed backend Lambdas, shared mechanics, frontend stores/services, and React
components. Reviewer findings were triaged: most "Critical" claims were verified as
**false positives** before any code was changed.

### Fixed (5 confirmed issues)
- ✅ alliance-treasury withdraw: validate destination `kingdomId` is an alliance member
  (leader could previously route treasury gold to any kingdom). `handler.ts` ~line 155.
- ✅ rate-limiter: replaced non-atomic read-modify-write with conditional-update +
  bounded retry (closes concurrent rate-limit-bypass window; still fails open).
- ✅ spellStore: folded `calming_chant` +1 elan into the single `set()` (was a second
  non-atomic `set` that could interleave with a concurrent cast).
- ✅ useDiplomacyStore: moved treaty subscription from a module-level `let` into store
  state (avoids leak across kingdom switches / strict-mode remounts).
- ✅ UnitSummonInterface: converted DOM-read uncontrolled quantity input to controlled
  React state (removed `document.getElementById().value` reads).

Verification: backend 220/220, frontend 125/125, touched frontend files lint clean.

### Verified false positives (no change needed)
- Alliance treasury "no leader check" — leader IS verified (handler.ts:147-154).
- Ambush "critical bug" — code matches comment; intentional balance choice.
- "Math.random breaks combat replay" — replays play back stored rounds, not re-simulated;
  randomness is intended gameplay variance.
- Trade-accept double-spend & bounty double-claim — both guarded (conditional update
  on stored resources; bounty re-claim resets `claimedAt` so old reports are excluded).
- subscriptionManager cross-kingdom notifications — `startSubscriptions` calls
  `stopSubscriptions()` first and resets counters.

### ✅ TypeScript strict-mode cleanup (2026-06-06, follow-up)
- Cleared **all 153 pre-existing `tsc -b` errors** → **0**. README's "0 errors" claim is now
  actually true under `tsc -b` (build had been passing only because Vite/esbuild skips typecheck).
- Root-cause fixes (cascaded): new `SimKingdom` type for the balance-testing harness (~42 errors);
  relaxed `combatCache.wrap` generic to `any[]` (7); `NonNullable<>` on Amplify filter casts (6);
  removed unused `React` imports / type-only imports under verbatimModuleSyntax (~20).
- Real issues surfaced & fixed, not just silenced:
  - admin `updateResources` was passing `gold`/`population` the mutation/handler never accepted
    (silently ignored) — now passes only `turns` with an accurate toast.
  - combat AttackType ↔ BattleReport model enum mismatch — added explicit bidirectional mappers
    (combatService, BattleReportsRoute) instead of lossy casts.
  - `Unit.type` union widened to include espionage units (scouts/elite_scouts) it already carried.
- Verification: TypeScript 0 errors, ESLint 0/0, **806/806 tests** (220 backend + 461 shared +
  125 frontend), production build succeeds (~11s).

---

## Remaining Backlog

### Production Deployment
- ✅ Deployed to AWS Amplify production (monarchy.gurum.se) via CodeCommit CI/CD pipeline
- ✅ `ampx pipeline-deploy` fixed — pinned @aws-amplify deps to exact versions (build 406)
- Subscribe to SNS alert topic for monitoring notifications
- Validate CloudWatch dashboard and alarms

### Code health (from 2026-06-06 deep scan)
- ✅ Resolved all 153 `tsc` strict-mode errors (README claim now accurate)
- Consider making combat/thievery/AI RNG seedable for reproducible tests (enhancement,
  not a bug — current randomness is intended gameplay variance)

---

## Architecture Cleanup — 2026-06-06 (8-item agent-team refactor)

Investigated by 8 parallel read-only scouts, synthesized into a conflict-ordered plan,
then executed: disjoint items in parallel git worktrees, the coupled type/parser cluster
sequentially. Each item independently verified.

### Completed
- ✅ **CI typecheck no-op fixed** — `ci.yml` ran `tsc --noEmit` on the frontend's
  solution-style tsconfig, which checks NOTHING (root cause of the 153-error drift).
  Now `tsc -b` via a new `frontend` `typecheck` script.
- ✅ **Combat engine de-duplicated** — deleted the orphaned `frontend/src/utils/combatCache.ts`
  (zero importers; its 7 functions duplicated `shared/combat/combatCache.ts`, and its cache
  wrapper was a no-op identity fn). `shared/` is now the sole combat source.
- ✅ **KingdomResources unified** — one canonical type in new enum-free
  `shared/types/kingdom-resources.ts` (re-exported by `kingdom.ts` for backend; by
  `frontend/types/amplify.ts` for frontend). `turns` is now required + an index signature
  was added, which removed 6 `as unknown as Record<string,number>` casts. The local copy
  in AdminDashboard was deleted. (Split into a separate module because `kingdom.ts`'s
  `ErrorCode` enum violates the frontend's `erasableSyntaxOnly`.)
- ✅ **Deserialization layer** — new `frontend/src/utils/dynamoDbParsers.ts`
  (`parseKingdomResources` / `parseKingdomStats` / `parseKingdomUnits`); migrated the
  duplicated parse blocks in kingdomStore (×2) and AppRouter (×2).
- ✅ **Achievement-turns bug FIXED (real bug)** — `resource-manager` saveAchievements added
  reward turns to `resources.turns` only; every turn-spending action reads the authoritative
  `turnsBalance`, which is seeded once and never re-synced → rewarded turns were silently
  unspendable. Now credits `turnsBalance` too, capped at MAX_STORED_TURNS (72). +3 regression tests.
- ✅ **alliance-manager** composition-bonus recalculation de-duplicated into one helper.
- ✅ **shared/mechanics cleanup** — removed 2 genuinely-unused params; kept middle-positional
  ones (would shift call sites); documented the silent-clamp convention. No behavior change.
- ✅ **Oversized components split** — `AdminDashboard.tsx` 950→90 lines (5 panels →
  `admin/panels/*` + `adminShared.ts` + `StatusBadge.tsx`); `WorldMapMobile.tsx` 672→393
  (extracted `worldmap/TerritoryCard`, `MapSection`, `territoryTypes`).

Verification: backend tsc 0, frontend tsc 0, lint clean, **1270 tests pass**
(125 frontend + 684 backend + 461 shared), production build succeeds (~10s).

Deferred (out of scope, by design): legacy `resources.turns` field removal is a multi-season
data migration; `turnsBalance` overlay onto `resources.turns` for display is the interim pattern.

---

**Last Updated:** 2026-06-06  
**Status:** Deployed to production
