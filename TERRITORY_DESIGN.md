# Territory System Design

## Current State — What's Broken

Three completely separate territory systems exist with no links between them:

### 1. World Map (`WORLD_TERRITORIES` in WorldMap.tsx)
- 50 hardcoded named region slots (Crystalpeak, Ironhold Keep, etc.)
- Never stored in DynamoDB — exist only in memory
- Ownership is re-computed on every render by hashing AI kingdom IDs + name-matching
- Clicking "Claim Territory" on the world map updates **local React state only** — writes nothing to any store or database

### 2. Territory Store (`territoryStore.ts`)
- Initialises with 3 hardcoded mock territories: `Royal Capital`, `Northern Outpost`, `Eastern Village`
- These names don't match any of the 50 WORLD_TERRITORIES names, so the world map's name-matching always falls through to index-based assignment
- The store's `claimTerritory` action deducts resources locally but doesn't call any Lambda
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
- Coordinate spaces differ: WorldMap uses -8000 to +8000, territory-claimer validates -10000 to +10000, store uses 100-300 range

---

## Recommended Design: Two-Tier System

### Tier 1 — Regions (the 50 world map slots)

The 50 `WORLD_TERRITORIES` become **Regions** — large strategic zones visible on the world map. Each Region:
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

### Claiming Flow (Revised)

1. Player clicks a Region node on World Map (e.g. "Ironhold Keep")
2. Side panel shows: Region name, archetype, terrain, current owner, available Territory slots
3. Player clicks "Claim Territory Slot" → sub-dialog shows the available slot categories for that Region
4. Confirm → Lambda creates Territory record with `regionId = wt-07`, costs 500 gold + 1 turn
5. World Map node updates to show partial/full player ownership
6. Territory Management page lists territories grouped by Region with production stats and Region Bonus progress

### Fog of War

Keep the existing `FOG_RADIUS = 5000` system. Refine: fog is lifted per-Region when you own any Territory within 5000 units. Full visibility (showing slot count and Region Bonus status) requires owning a Territory in that Region or an adjacent one.

---

## Implementation Phases

### Phase 1 — Fix the Broken Link (no schema changes needed)

1. **Add `regionId` to Territory schema** — `regionId: a.string()` on the Territory model in `amplify/data/resource.ts`
2. **Route `/territories` correctly** — AppRouter.tsx should route to the actual working component (TerritoryExpansion, renamed), not dead code
3. **Fix WorldMap claim action** — `handleClaimTerritory` must call `AmplifyFunctionService.claimTerritory()` with `regionId: wt.id` instead of updating local React state only
4. **Fix ownership detection** — Replace name-matching with `regionId`-based lookup: fetch player's Territory records from store, mark world map slots as `'player'` where `territory.regionId === wt.id`

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

| Current | Rename to | Reason |
|---|---|---|
| `TerritoryExpansion.tsx` | Keep, rename display to "Territory Management" | This is the real management screen |
| `TerritoryManagement.tsx` (current, dead) | Delete or archive | Never routed, dead code |
| `WorldTerritory` interface | `RegionSlot` | Clarifies these are map regions |
| `WORLD_TERRITORIES` constant | `WORLD_REGIONS` | Same reason |
| Territory `type` field | `category` | Avoids collision with Region archetype |
| `defenseLevel` | `developmentLevel` | Misleading name |
| `availableExpansions` in store | `claimableRegions` | Better reflects the Region/slot concept |

---

## Critical Files to Change

| File | Change |
|---|---|
| `amplify/data/resource.ts` | Add `regionId: a.string()` to Territory; update claimTerritory mutation |
| `amplify/functions/territory-claimer/handler.ts` | Accept + persist `regionId`; add slot-count validation |
| `amplify/functions/resource-manager/handler.ts` | Add Territory-based income on top of building income |
| `amplify/functions/combat-processor/handler.ts` | Transfer Territory records on land gain |
| `frontend/src/stores/territoryStore.ts` | Replace mock init with real DynamoDB fetch; add `regionId` grouping |
| `frontend/src/components/WorldMap.tsx` | Fix `handleClaimTerritory`; fix `territoryOwnership` to use `regionId` |
| `frontend/src/AppRouter.tsx` | Route `/territories` to correct component |
