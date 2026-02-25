# Territory System Design

## Current State — What's Broken

Three completely separate territory systems exist with no links between them:

### 1. World Map (`WORLD_REGIONS` in WorldMap.tsx)
- 50 hardcoded named region slots (Crystalpeak, Ironhold Keep, etc.)
- Never stored in DynamoDB — exist only in memory
- Ownership is re-computed on every render by hashing AI kingdom IDs + regionId-matching
- Clicking "Dispatch Settlers" on the world map deducts gold/turns and writes a `PendingSettlement` to Zustand + localStorage — territory enters **Settling** state, NOT immediately owned
- When `tickSettlements()` completes the countdown the territory auto-completes client-side only — no DynamoDB write

### 2. Territory Store (`territoryStore.ts`)
- Initialises with 3 hardcoded mock territories: `Royal Capital` (regionId `wt-03`), `Northern Outpost` (regionId `wt-02`), `Eastern Village` (regionId `wt-04`)
- The store's `claimTerritory` action (legacy) deducts resources locally but doesn't call any Lambda
- The new settler path (`startSettlement` / `tickSettlements`) is client-only
- `TerritoryExpansion.tsx` (what `/territories` routes to) is entirely mock-based

### 3. DynamoDB Territory table
- Real persisted layer, written by the `territory-claimer` Lambda
- `TerritoryManagement.tsx` (the DynamoDB-connected component) is **never routed to** — it's dead code
- The create form has manual x/y coordinate inputs with no connection to the world map
- Resource generation (`resource-manager` Lambda) ignores Territory records entirely — it reads only `kingdom.buildings`
- Combat adds/subtracts from `kingdom.resources.land` as a raw number — no Territory records are transferred

### Additional disconnects
- Territory `type` (capital/settlement/outpost/fortress) is cosmetic — no Lambda or mechanic uses it
- `defenseLevel` field exists but is never mechanically applied
- Coordinate spaces differ: WorldMap uses -8000 to +8000, territory-claimer validates -10000 to +10000, store uses 100–300 range

---

## Recommended Design: Two-Tier System

### Tier 1 — Regions (the 50 world map slots)

The 50 `WORLD_REGIONS` are **Regions** — large strategic zones visible on the world map. Each Region:
- Has a fixed name, position, and terrain archetype
- Is controlled by whoever owns the majority of its Territory slots
- Awards a **Region Bonus** (20% production multiplier) to the controlling kingdom each resource tick
- Contains a fixed number of Territory slots based on archetype:

| Archetype | Slots | Terrain flavour |
|---|---|---|
| capital | 5 | Rich plains, trade hub |
| settlement | 3 | Farming, population |
| outpost | 2 | Scouting, border control |
| fortress | 4 | Mountain, defensible |

Regions are NOT persisted — they stay as the static array. Control is computed from which kingdoms own Territory records with `regionId = wt-XX`.

### Tier 2 — Territories (DynamoDB records, individual holdings)

Each Territory belongs to a Region (`regionId`) and has a `category` that drives what it produces:

| Category | Gold/tick | Population/tick | Land/tick | Special |
|---|---|---|---|---|
| farmland | 20 | 30 | 50 | Food stability bonus |
| mine | 60 | 5 | 10 | Fortification discount |
| forest | 10 | 10 | 30 | Scout range bonus |
| port | 80 | 20 | 5 | Trade multiplier |
| stronghold | 5 | 0 | 0 | +defence, blocks raids |
| ruins | 0 | 0 | 0 | Excavate for one-time gold |

Terrain type (`plains | mountains | coastal | forest`) multiplies the base values (plains ×1.0, mountains mines ×1.5, coastal ports ×1.5, etc.).

### Progression

| Stage | Territories | Regions controlled |
|---|---|---|
| Start | 1 (capital territory) | 0 fully controlled |
| Early game | 3–5 | 1–2 |
| Mid game | 10–15 | 3–5 |
| Peak | 20–30 | 8–12 |

With 100 active players contesting 150 total slots, every slot is meaningful. Territory conquest (via combat) transfers specific named places — not an abstract land number.

### Claiming Flow — As Built

1. Player opens the World Map and clicks a neutral Region node (e.g. "Ironhold Keep").
2. The slide-in side panel shows: Region name, archetype, territory slot count, ownership badge, and — if visible and neutral — the cost breakdown.
3. The panel runs three pre-flight checks in order:
   - **Contested?** If the region borders both a player-owned and enemy-owned region within `CLAIM_ADJACENCY_RADIUS` (3500 units), the panel shows "⚔ Contested Region — take it by combat" and the dispatch button is absent.
   - **Adjacent?** If no player-owned region is within 3500 units, the panel shows "⚠ Too far from your territory" and the button is disabled.
   - **Affordable?** Cost fields turn red and the button is disabled if the player lacks gold or turns.
4. Player clicks "Dispatch Settlers" — `handleClaimTerritory` deducts gold and turns from `kingdomStore`, then calls `useTerritoryStore.getState().startSettlement(...)`.
5. The region node immediately switches to the **Settling** state (amber, flag ⚑, turn countdown in label).
6. Each time the player earns turns, the caller invokes `tickSettlements(turnsAdded)`. When `turnsRemaining` reaches 0, the function returns the completed settlement and the caller adds it to `ownedTerritories` and fires a toast.
7. The World Map node updates to green (player-owned) on the next render.

### Fog of War

Keep the existing `FOG_RADIUS = 5000` system. Fog is lifted per-Region when you own any Territory within 5000 units. Full visibility (showing slot count and Region Bonus status) requires owning a Territory in that Region or an adjacent one.

---

## Territory Acquisition Mechanics

The three mechanics below are all implemented client-side in `WorldMap.tsx` and `territoryStore.ts`. None yet persist to DynamoDB.

### 1. Distance-Scaled Costs

Claim costs scale linearly with the Euclidean distance from the nearest player-owned region, so expansion deep into enemy territory is meaningfully more expensive than consolidating a nearby border.

**Formulas** (from `claimCost()` in `WorldMap.tsx`):

```
goldCost     = round( BASE_GOLD[type]  × (1 + nearestDistance / 3000) / 50 ) × 50
turnCost     = ceil(  BASE_TURNS[type] × (1 + nearestDistance / 3000) )
settlingTurns = max(2, round(2 + nearestDistance / 1500))
```

`nearestDistance` is the Euclidean distance (world units) from the target region to the closest region the player already owns. Gold is rounded to the nearest 50g. `settlingTurns` is capped at a minimum of 2 and rises to roughly 8 for the most distant regions.

**Base costs per archetype:**

| Archetype | BASE_GOLD | BASE_TURNS |
|---|---|---|
| capital | 1000g | 5 turns |
| settlement | 500g | 3 turns |
| outpost | 300g | 2 turns |
| fortress | 800g | 4 turns |

**Example:** A settlement 1500 units from the nearest owned region:
- `goldCost = round(500 × (1 + 1500/3000) / 50) × 50 = round(500 × 1.5 / 50) × 50 = 15 × 50 = 750g`
- `turnCost = ceil(3 × 1.5) = 5 turns`
- `settlingTurns = max(2, round(2 + 1500/1500)) = max(2, 3) = 3 turns`

So a settlement 1500 units away costs **750g + 5 turns** to dispatch and **settles in 3 turns**.

### 2. Settler Mechanic (Turn-Based)

Claiming a region does not transfer ownership immediately. Instead, a settler party is dispatched and travels for `settlingTurns` turns before the region is secured.

**State shape** (`PendingSettlement` in `territoryStore.ts`):

```typescript
interface PendingSettlement {
  regionId: string;        // which WORLD_REGIONS slot
  regionName: string;      // display name
  kingdomId: string;       // 'current-player' in demo mode
  turnsRemaining: number;  // countdown to completion
  totalTurns: number;      // original settling duration
  goldRefund: number;      // 50% of gold paid, returned if raided
  startedAtTurns: number;  // kingdom turns count when started
}
```

**Flow:**

1. `handleClaimTerritory` deducts resources and calls `startSettlement(settlement)`.
2. `startSettlement` appends the record to `pendingSettlements` and writes the updated array to `localStorage` so settlers survive a page refresh.
3. Each time the player earns turns, the caller invokes `tickSettlements(turnsAdded)`. The function decrements `turnsRemaining` for every pending settlement whose `kingdomId === 'current-player'`. Settlements at or below 0 are moved to the returned `completed` array; the rest are persisted back to localStorage.
4. The caller iterates `completed`, calls `addTerritory(...)` to move each finished settlement into `ownedTerritories`, and fires a success toast.

**Raiding:** An enemy can spend 2 turns to cancel any settling in progress:
- `handleRaidSettlers` deducts 2 turns and calls `raidSettlement(regionId)`.
- `raidSettlement` finds the first `PendingSettlement` for that region whose `kingdomId !== 'current-player'`, removes it from the array, persists the remainder to localStorage, and returns `{ refundGold }`.
- The caller does NOT currently return the gold refund to the enemy's treasury (demo limitation — gold refund is stored in the record for future use).

**Map visuals:**

| State | Node colour | Label prefix |
|---|---|---|
| Player settlers en route | Amber (#b45309), dashed gold border | ⚑ name (Nt) |
| Enemy settlers en route | Red-orange (#c2410c), dashed orange border | ⚔ name |
| Contested (no settlers) | Deep red (#7f1d1d), dashed red border | ⚔ name |

### 3. Contested Zones

A neutral region is **contested** when it is simultaneously bordered by at least one player-owned region AND at least one enemy-owned region, both within `CLAIM_ADJACENCY_RADIUS` (3500 world units).

**Detection** (`isContested()` in `WorldMap.tsx`):

```typescript
function isContested(
  region: RegionSlot,
  ownership: Record<string, 'player' | 'enemy' | 'neutral'>,
): boolean {
  const neighbours = WORLD_REGIONS.filter(
    r => r.id !== region.id && dist(r.position, region.position) <= CLAIM_ADJACENCY_RADIUS
  );
  const hasPlayer = neighbours.some(r => ownership[r.id] === 'player');
  const hasEnemy  = neighbours.some(r => ownership[r.id] === 'enemy');
  return hasPlayer && hasEnemy;
}
```

**Behaviour:**

- The claim panel shows a dark-red alert box: "⚔ Contested Region — This region lies between kingdoms. It can only be taken through combat."
- The "Dispatch Settlers" button is not rendered; `handleClaimTerritory` also guards against this and fires an error toast if called programmatically.
- The region node renders in deep red with a dashed red border, distinct from regular enemy nodes.
- Contested status is re-evaluated on every render as ownership changes — a region that was contested can become claimable again if the bordering enemy region is captured.

---

## Implementation Phases

### Phase 1 — Fix the Broken Link (no schema changes needed) — COMPLETE

The following client-side mechanics are implemented and working:

- `RegionSlot` interface and `WORLD_REGIONS` constant replacing the old `WorldTerritory` / `WORLD_TERRITORIES` naming
- `claimCost()` — distance-scaled gold, turn, and settlingTurns calculation
- `isAdjacentToPlayer()` — adjacency gate using `CLAIM_ADJACENCY_RADIUS`
- `isContested()` — contested-zone detection
- `PendingSettlement` interface, `startSettlement`, `raidSettlement`, and `tickSettlements` in `territoryStore.ts`
- localStorage persistence of pending settlements across page refreshes
- `handleClaimTerritory` — full pre-flight checks (contested → adjacency → resources) then settler dispatch
- `handleRaidSettlers` — 2-turn cost to cancel enemy settlers
- Map node visual states for settling, enemy-settling, and contested
- Side panel state variants for each condition
- `territoryOwnership` computed via `regionId` lookup with fallback index-based assignment for demo territories

**Remaining in Phase 1:**

- Wire `tickSettlements` into the turn-earning flow so completed settlements auto-promote to `ownedTerritories`
- Return the gold refund to the raiding kingdom's treasury when `raidSettlement` succeeds
- Persist new `ownedTerritories` entries to DynamoDB via the `territory-claimer` Lambda (currently client-only)

### Phase 2 — Mechanical Grounding (schema + Lambda)

5. **Territory-based resource production** — `resource-manager` Lambda sums per-territory income (by `category` + terrain multiplier) on top of building income
6. **Slot validation in territory-claimer** — Validate that the target Region has available slots before allowing claim
7. **Combat transfers Territory records** — `combat-processor` finds defender's least-defended Territory and transfers `kingdomId` to attacker when `landGained > 0`

### Phase 3 — Region Bonus

8. **Compute Region control in resource tick** — Check for full Region ownership and apply 20% multiplier
9. **Show Region Bonus progress in WorldMap panel** — "3/5 slots — 2 more for Region Bonus"
10. **Group territories by Region** in Territory Management view

---

## Recommended Renames

| Current | Rename to | Status |
|---|---|---|
| `TerritoryExpansion.tsx` | Keep, rename display to "Territory Management" | Pending |
| `TerritoryManagement.tsx` (current, dead) | Delete or archive | Pending |
| `WorldTerritory` interface | `RegionSlot` | **Done** — renamed in WorldMap.tsx |
| `WORLD_TERRITORIES` constant | `WORLD_REGIONS` | **Done** — renamed in WorldMap.tsx |
| Territory `type` field | `category` | Pending |
| `defenseLevel` | `developmentLevel` | Pending |
| `availableExpansions` in store | `claimableRegions` | Pending |

---

## Critical Files to Change

| File | Change |
|---|---|
| `amplify/data/resource.ts` | Add `regionId: a.string()` to Territory; update claimTerritory mutation |
| `amplify/functions/territory-claimer/handler.ts` | Accept + persist `regionId`; add slot-count validation |
| `amplify/functions/resource-manager/handler.ts` | Add Territory-based income on top of building income |
| `amplify/functions/combat-processor/handler.ts` | Transfer Territory records on land gain |
| `frontend/src/stores/territoryStore.ts` | Replace mock init with real DynamoDB fetch; wire `tickSettlements` into turn-earning; return gold refund on raid |
| `frontend/src/components/WorldMap.tsx` | Wire settler completion into `ownedTerritories`; persist completed claim to Lambda |
| `frontend/src/AppRouter.tsx` | Route `/territories` to correct component |
