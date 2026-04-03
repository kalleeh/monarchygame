# Feature Enhancement Plan - Option D

**Project**: Monarchy Game Modernization
**Plan Created**: October 3, 2025
**Last Audited**: April 2026 (all streams complete)
**Methodology**: Phased implementation with IQC validation

---

## 🎯 **Overview**

Five major feature enhancements to increase player engagement, retention, and competitive depth.
This document reflects **actual implementation status** after the April 2026 completion sprint.

### **Feature Status Summary**

| Feature | Priority | Post-Sprint Status |
|---------|----------|--------------------|
| Tutorial/Onboarding | HIGH | ✅ 100% Complete |
| Player Rankings/Leaderboards | HIGH | ✅ 100% Complete (guild names resolved via GuildService.getPublicGuilds) |
| Achievement System | MEDIUM | ✅ 100% Complete (dashboard widget integrated into KingdomDashboard) |
| Advanced Combat Mechanics | MEDIUM | ✅ 100% Complete (replay capture wired in combatStore, routes exist, View Replay button in battle history) |
| Guild Warfare System | LOWER | ✅ 100% Complete (searchable guild picker in DeclareWarModal, guild name resolution in leaderboard) |

---

## ✅ **Fully Completed**

### **1. Tutorial/Onboarding — 100%**

- `TutorialOverlay`, `TutorialStep`, `ProgressIndicator`, `Tutorial.tsx` (React Spring)
- `tutorialStore.ts` — Zustand + localStorage, skip/restart, step count fixed (10 steps)
- 5 tutorial sequences: kingdom, combat, spell casting, territory, alliance
- Spotlight highlighting, keyboard nav (Arrow/Enter/Escape), mobile responsive
- Playwright test suites: `tutorial-functionality.spec.ts`, `tutorial-interactive.spec.ts`

---

### **3. Achievement System — 100%**

- 22 achievements across 6 categories (Combat, Economy, Territory, Social, Magic, Exploration), 4 tiers
- `achievementStore.ts` — Zustand + localStorage + DB persistence
- `achievementTriggers.ts` — all triggers wired:
  - Combat: `onBattleWon`, `onFlawlessVictory`, `onLandCaptured` → `combatStore.ts`
  - Economy: `onGoldChanged`, `onLandChanged`, `onPopulationChanged`, `onTradeCompleted` → `KingdomDashboard.tsx`, `useSummonStore.ts`
  - Magic: `onSpellCast` → `SpellCastingInterface.tsx` (on successful cast)
  - Social: `onAllianceFormed`, `onGuildJoined`, `onMessageSent` → `GuildManagement.tsx` create/join/accept/send
  - Exploration: `onTerritoryExplored(regionId)` → `WorldMap.tsx` after `startSettlement()` success (tracks unique regions for Cartographer)
  - Guild Warfare: `onGuildWarDeclared`, `onGuildWarContribution` → `GuildManagement.tsx`, `combatStore.ts`
- Reward application: gold + turns granted on unlock, double-grant guarded via `'achievement-rewards-granted'` localStorage key
- ID bug fixed: `'guild-formed'` → `'alliance-formed'`
- Route at `/kingdom/:id/achievements`, lazy-loaded, toast notifications on unlock
- `AchievementWidget` component created and integrated into `KingdomDashboard.tsx` — shows unlocked count, recently unlocked, nearest to completion, View All link

---

### **2. Player Rankings/Leaderboards — 100%**

- Live networth-based ranking with difficulty indicators (easy/fair/hard)
- Season-end Lambda ranking + `previousSeasonRank` persistence
- **Race-specific tabs**: 10 race tabs (All + Human/Elven/Goblin/Droben/Vampire/Elemental/Centaur/Sidhe/Dwarven/Fae), re-numbered within each
- **Rank delta indicators**: ▲/▼ vs previous season, "NEW" for first-season kingdoms
- **Guild aggregate tab**: groups by `guildId`, sums networth, sorted ranking
- **Player search**: live client-side filter
- Guild names resolved via `guildNamesMap` state using `GuildService.getPublicGuilds()`

---

### **4. Advanced Combat Mechanics — 100%**

- `shared/combat/combatCache.ts`: `TERRAIN_MODIFIERS`, `FORMATION_MODIFIERS`, `applyTerrainToUnitPower` exported for both frontend and Lambda
- `combat-processor/handler.ts` Lambda now applies:
  - Formation offense multiplier (attacker's chosen formation)
  - Terrain modifiers: defense bonus for defender, unit-class penalties (cavalry/infantry/siege) for attacker
  - Terrain resolved from `Territory.terrainType` on defender's territory records
- `amplify/data/resource.ts`: `terrainType` added as optional field to `processCombat` mutation
- `BattleFormations.tsx` (633 lines): drag-and-drop UI for formation selection
- `TerrainSelector.tsx`: terrain selection UI
- Siege mechanics: `startSiege`, `updateSiege`, `completeSiege` fully implemented in `combatStore.ts`
- Replay capture wired in `combatStore.executeBattle` (both auth and demo modes)
- Routes: `/kingdom/:id/replays` and `/kingdom/:id/replay/:replayId`
- Components extracted: `ReplaysListRoute.tsx`, `ReplayRoute.tsx`
- View Replay button in battle history

---

### **5. Guild Warfare System — 100%**

- Full guild org layer: create, join, leave, kick, invite, accept, chat, treasury
- Individual kingdom war declaration via `war-manager` Lambda (existing)
- `GuildService.ts` extended: `declareGuildWar`, `resolveGuildWar`, `concedeGuildWar`, `recordGuildWarContribution`, `loadGuildWars`, `findActiveWarBetween` (localStorage-backed prototype)
- `combatStore.ts`: `maybeRecordGuildWarScore` fires after every auth-mode victory — scores 1pt/10 acres
- Wars tab fully replaced in `GuildManagement.tsx`:
  - Active war card: vs enemy, live score, time remaining countdown, member contribution table
  - Concede/Resolve buttons (leader-gated)
  - War history (past 10 wars with Won/Lost/Tied badge)
- `DeclareWarModal.tsx` has searchable guild picker with `GuildService.getPublicGuilds()`
- Leaderboard resolves guild names via `guildNamesMap` state

---

## ✅ All Streams Complete

All 5 features and 3 remaining streams (E, F, G) were completed in the April 2026 sprint.

---

## 🧩 **Holistic Gameflow — Final State**

With all streams complete, the full engagement loop is closed:

```
New Player
    ↓
[Tutorial] — teaches all 5 major systems in sequence
    ↓
[Kingdom Dashboard]
    ├── AchievementWidget (Stream G) — shows nearest achievements → drives action
    ├── Battle History + "View Replay" (Stream E) → review strategy → improve play
    └── Guild Wars panel → active war status visible at a glance
    ↓
[Leaderboard]
    ├── Race tabs → motivate racial strategy mastery
    ├── Guild tab with real names (Stream F) → alliance competition
    └── Rank delta → urgency + competitive motivation
    ↓
[Guild Management → Wars tab]
    └── Declare War with guild picker (Stream F) → coordinated alliance warfare
    ↓
[Combat]
    ├── Formation + terrain choices → meaningful strategy
    ├── Siege mechanics → fortified territory gameplay
    └── Post-battle replay (Stream E) → learning loop
    ↓
[Achievements]
    ├── Dashboard widget (Stream G) → continuous visibility
    └── Rewards (gold/turns) applied on unlock → tangible progression
```

---

## 📈 **Success Metrics** (unchanged)

| System | Metric | Target |
|--------|--------|--------|
| Tutorial | Completion rate | 70%+ |
| Leaderboards | Daily engagement | 40%+ active players |
| Achievements | Unlocked per player | 5+ average |
| Advanced Combat | Formation usage | 30%+ battles |
| Guild Warfare | Guild participation | 60%+ members |

---

## ⚠️ **Known Limitations**

| Item | Notes |
|------|-------|
| Guild warfare persistence | localStorage-backed prototype; production would need Amplify `GuildWar` model |
| Terrain in demo mode | Lambda not called in demo mode; terrain/formation only apply in auth mode combat |

---

**Plan Status**: All features and streams complete.
**Last Updated**: April 2026
**Owner**: Development Team
