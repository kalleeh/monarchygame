# Active Tasks & Development Tracking

**Purpose:** Current work, recent decisions, and next steps  
**When to use:** Understanding current development status and priorities  
**Updated:** 2026-04-03

---

## Current Status: Feature Complete

All planned features and code quality improvements are complete.

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

### Quality Metrics
- **Tests:** 778/778 passing (220 backend + 433 shared + 125 frontend)
- **TypeScript:** 0 compilation errors (strict mode)
- **ESLint:** 0 errors, 0 warnings
- **Build:** 2.0MB JS, 8.28s
- **Lambda Functions:** 19 registered + 2 EventBridge schedules
- **E2E Tests:** 21 Playwright specs (audited, no stale selectors)

---

## Remaining Backlog

### Production Deployment
- Deploy to AWS Amplify production (monarchy.gurum.se)
- Subscribe to SNS alert topic for monitoring notifications
- Validate CloudWatch dashboard and alarms

### Future Enhancements
- Territory system unification (3 disconnected implementations → unified two-tier model)
- Server-side rate limiting with DynamoDB (current is in-memory per Lambda instance)
- Additional GSIs for reverse-relationship queries (buyerId on TradeOffer, recipientId on Treaty, etc.)
- Bundle size optimization (2.0MB → target <1.5MB)

---

**Last Updated:** 2026-04-03  
**Status:** Feature complete, production deployment pending
