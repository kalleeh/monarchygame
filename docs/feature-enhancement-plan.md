# Feature Enhancement Plan - Option D

**Project**: Monarchy Game Modernization
**Plan Created**: October 3, 2025
**Last Audited**: February 2026 (post-implementation sprint)
**Methodology**: Phased implementation with IQC validation

---

## 🎯 **Overview**

Five major feature enhancements to increase player engagement, retention, and competitive depth.
This document reflects **actual implementation status** after the February 2026 implementation sprint.

### **Feature Status Summary**

| Feature | Priority | Post-Sprint Status |
|---------|----------|--------------------|
| Tutorial/Onboarding | HIGH | ✅ 100% Complete |
| Player Rankings/Leaderboards | HIGH | ✅ 90% Complete |
| Achievement System | MEDIUM | ✅ 98% Complete |
| Advanced Combat Mechanics | MEDIUM | 🟡 75% Complete |
| Guild Warfare System | LOWER | 🟡 70% Complete |

---

## ✅ **Fully Completed**

### **1. Tutorial/Onboarding — 100%**

- `TutorialOverlay`, `TutorialStep`, `ProgressIndicator`, `Tutorial.tsx` (React Spring)
- `tutorialStore.ts` — Zustand + localStorage, skip/restart, step count fixed (10 steps)
- 5 tutorial sequences: kingdom, combat, spell casting, territory, alliance
- Spotlight highlighting, keyboard nav (Arrow/Enter/Escape), mobile responsive
- Playwright test suites: `tutorial-functionality.spec.ts`, `tutorial-interactive.spec.ts`

---

### **3. Achievement System — 98%**

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
- **Remaining (2%)**: Achievement dashboard widget (see below)

---

### **2. Player Rankings/Leaderboards — 90%**

- Live networth-based ranking with difficulty indicators (easy/fair/hard)
- Season-end Lambda ranking + `previousSeasonRank` persistence
- **Race-specific tabs**: 10 race tabs (All + Human/Elven/Goblin/Droben/Vampire/Elemental/Centaur/Sidhe/Dwarven/Fae), re-numbered within each
- **Rank delta indicators**: ▲/▼ vs previous season, "NEW" for first-season kingdoms
- **Guild aggregate tab**: groups by `guildId`, sums networth, sorted ranking
- **Player search**: live client-side filter
- **Remaining (10%)**: Guild names show as `Guild [id.slice(0,8)]` because `Kingdom` type has no `guildName` field — needs name resolution pass

---

### **4. Advanced Combat Mechanics — 75%**

- `shared/combat/combatCache.ts`: `TERRAIN_MODIFIERS`, `FORMATION_MODIFIERS`, `applyTerrainToUnitPower` exported for both frontend and Lambda
- `combat-processor/handler.ts` Lambda now applies:
  - Formation offense multiplier (attacker's chosen formation)
  - Terrain modifiers: defense bonus for defender, unit-class penalties (cavalry/infantry/siege) for attacker
  - Terrain resolved from `Territory.terrainType` on defender's territory records
- `amplify/data/resource.ts`: `terrainType` added as optional field to `processCombat` mutation
- `BattleFormations.tsx` (633 lines): drag-and-drop UI for formation selection
- `TerrainSelector.tsx`: terrain selection UI
- Siege mechanics: `startSiege`, `updateSiege`, `completeSiege` fully implemented in `combatStore.ts`
- **Remaining (25%)**: Combat replay viewer not integrated into game flow (store exists, component exists, route missing, not wired to battles)

---

### **5. Guild Warfare System — 70%**

- Full guild org layer: create, join, leave, kick, invite, accept, chat, treasury
- Individual kingdom war declaration via `war-manager` Lambda (existing)
- `GuildService.ts` extended: `declareGuildWar`, `resolveGuildWar`, `concedeGuildWar`, `recordGuildWarContribution`, `loadGuildWars`, `findActiveWarBetween` (localStorage-backed prototype)
- `combatStore.ts`: `maybeRecordGuildWarScore` fires after every auth-mode victory — scores 1pt/10 acres
- Wars tab fully replaced in `GuildManagement.tsx`:
  - Active war card: vs enemy, live score, time remaining countdown, member contribution table
  - Concede/Resolve buttons (leader-gated)
  - War history (past 10 wars with Won/Lost/Tied badge)
- **Remaining (30%)**: Declare war modal uses manual Guild ID + name input — needs a guild browser/search picker from existing Browse Alliances data

---

## 🔧 **Remaining Implementation: 3 Focused Streams**

### **Stream E: Combat Replay Integration**

The replay store (`combatReplayStore.ts`) and viewer component (`CombatReplayViewer.tsx`) exist but are
not wired to the game. Players have no way to access replays.

**Tasks:**

1. **Wire replay capture** — In `combatStore.ts`, after `executeBattle` resolves (both auth and demo
   modes), build a replay record and call `useCombatReplayStore.getState().addReplay(replayData)`.
   The replay data should include: attacker/defender info, units, formation used, terrain, result,
   land gained, casualties, timestamp.

2. **Add replay route** — In `AppRouter.tsx`, add route `/kingdom/:kingdomId/replay/:replayId`
   rendering `CombatReplayViewer`. Also add a "Replays" nav option from KingdomDashboard.

3. **View Replay button** — In the battle history display (wherever `battleHistory` is rendered in
   the dashboard), add a "View Replay" button/link for each past battle that navigates to the replay.

**Files to touch:** `combatStore.ts`, `AppRouter.tsx`, `KingdomDashboard.tsx` (or wherever battle
history is displayed), `combatReplayStore.ts` (check store interface first).

---

### **Stream F: Guild Browser for War Declaration**

The declare war modal in `GuildManagement.tsx` requires players to manually type a Guild ID and name,
which breaks the UX. `GuildService.ts` already has guild listing via `browseGuilds()` or similar.

**Tasks:**

1. **Replace manual input with guild picker** — In the declare war modal (around line 1080 of
   `GuildManagement.tsx`), replace the two text inputs (Guild ID + Guild Name) with a searchable
   guild list. Fetch available guilds using `GuildService.browseGuilds()` (or whatever the browse
   method is — read `GuildService.ts` to find it). Show guild name + member count + power. Clicking
   selects that guild for war declaration.

2. **Leaderboard guild names** — In `AppRouter.tsx`, when building the kingdoms array passed to
   `Leaderboard`, make a pass to resolve guild names. Either:
   - Add `guildName?: string` to the `Kingdom` type in `types/kingdom.ts`
   - And populate it in the AppRouter kingdoms transform from whatever guild data is available
   - OR: in `Leaderboard.tsx` Guilds tab, use guild names from a `GuildService.loadMyGuildInfo()`
     call if that's easier. The simplest approach: if `GuildService` has a list of known guilds in
     localStorage, use those names.

**Files to touch:** `GuildManagement.tsx` (declare war modal), `GuildService.ts` (verify browse
method), `frontend/src/types/kingdom.ts` (add `guildName`), `AppRouter.tsx` or `Leaderboard.tsx`.

---

### **Stream G: Achievement Dashboard Widget**

Achievements are only accessible via a separate route. Players who don't explicitly navigate there
never see their achievement progress. A dashboard panel drives discovery and engagement.

**Tasks:**

1. **Build `AchievementWidget` component** — Create
   `/frontend/src/components/achievements/AchievementWidget.tsx`:
   - Shows count: "X / 22 achievements unlocked"
   - Shows the most recently unlocked achievement (name + icon + tier badge)
   - Shows the single achievement closest to completion (progress bar, e.g. "Warrior: 7/10 victories")
   - "View All" link → `/kingdom/:kingdomId/achievements`
   - Design: compact panel matching the dark fantasy style of other dashboard panels

2. **Integrate into KingdomDashboard** — Add `<AchievementWidget kingdomId={kingdomId} />` in a
   visible section of `KingdomDashboard.tsx`. Read the dashboard layout first to find the right spot
   (not buried at the bottom — somewhere players see early in the session).

**Files to touch:** Create new `AchievementWidget.tsx`, `KingdomDashboard.tsx`.

---

## 🧩 **Holistic Gameflow — Final State**

With these three streams complete, the full engagement loop is closed:

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
| Combat replay viewer | Component exists (`CombatReplayViewer.tsx`) but not routed; Stream E completes this |
| Lambda test failures | `handler.test.ts` had pre-existing type errors before this sprint; not introduced by sprint work |

---

**Plan Status**: Implementation sprint complete. Streams E/F/G remaining.
**Last Updated**: February 2026
**Owner**: Development Team
