#!/usr/bin/env python3
"""One-off migration: rescale bloated AI kingdom armies to sane, mixed rosters.

Before the combat rebalance, the cheapest tier-0 unit was the best power-per-gold
buy and there was no land-based unit cap, so the turn-ticker AI stacked ~40,000
tier-0 units on ~100-land kingdoms — an unbreakable defensive wall. The code fix
(flattened cost curve + land-based unit cap + mixed-army AI training) prevents
this going forward, but the 500 already-seeded AI kingdoms keep their walls until
reset. This script recomputes each AI army to:

  - respect the land-based unit-count cap  (min(100k, max(2k, land*50)))
  - respect the gold troop cap             (max(2M, land*1000 + barracks*2000))
  - spread across all four tiers by weight (mirrors ai-strategist TIER_TRAIN_WEIGHTS)

and rewrites totalUnits + networth.

The numeric constants below MIRROR the TypeScript single sources of truth:
  shared/mechanics/tier-stats.ts        (TIER_STATS.GOLD)
  shared/mechanics/troop-cap-mechanics.ts (TROOP_CAP, UNIT_COUNT_CAP)
  shared/mechanics/ai-strategist.ts     (RACE_UNITS, RACE_ECON_MULT, TIER_TRAIN_WEIGHTS)
Keep them in sync if those files change.

Usage:
  python3 scripts/reset-ai-armies.py            # DRY RUN — prints before/after, no writes
  python3 scripts/reset-ai-armies.py --apply    # actually write to DynamoDB
"""
import sys
import boto3

REGION = "eu-west-1"
STACK = "6m5nf6tv7rhernd2vgj5vdw4ba"  # live API stack suffix
TABLE = f"Kingdom-{STACK}-NONE"

# --- Mirrors of the TS single-source-of-truth constants ---------------------
TIER_BASE_GOLD = [50, 350, 900, 2000]          # tier-stats.ts TIER_STATS.GOLD
TIER_TRAIN_WEIGHTS = [0.15, 0.25, 0.30, 0.30]  # ai-strategist.ts
TROOP_CAP_GOLD_PER_LAND = 1000
TROOP_CAP_GOLD_PER_BARRACKS = 2000
TROOP_CAP_MIN_GOLD = 2_000_000
UNIT_CAP_PER_LAND = 50
UNIT_CAP_MIN = 2_000
UNIT_CAP_MAX = 100_000
NETWORTH_UNIT_VALUE = 100  # networth per unit (combat-processor)

RACE_UNITS = {
    "Human":     ["peasants", "militia", "knights", "cavalry"],
    "Elven":     ["elven-scouts", "elven-warriors", "elven-archers", "elven-lords"],
    "Goblin":    ["goblins", "hobgoblins", "kobolds", "goblin-riders"],
    "Droben":    ["droben-warriors", "droben-berserkers", "droben-bunar", "droben-champions"],
    "Vampire":   ["thralls", "vampire-spawn", "vampire-lords", "ancient-vampires"],
    "Elemental": ["earth-elementals", "fire-elementals", "water-elementals", "air-elementals"],
    "Centaur":   ["centaur-scouts", "centaur-warriors", "centaur-archers", "centaur-chiefs"],
    "Sidhe":     ["sidhe-nobles", "sidhe-elders", "sidhe-mages", "sidhe-lords"],
    "Dwarven":   ["dwarven-militia", "dwarven-guards", "dwarven-warriors", "dwarven-lords"],
    "Fae":       ["fae-sprites", "fae-warriors", "fae-nobles", "fae-lords"],
}
RACE_ECON_MULT = {"Vampire": 2.0}  # all others 1.0

ddb = boto3.client("dynamodb", region_name=REGION)


def unit_count_cap(land: int) -> int:
    return min(UNIT_CAP_MAX, max(UNIT_CAP_MIN, int(land * UNIT_CAP_PER_LAND)))


def troop_cap_gold(land: int, barracks: int) -> int:
    return max(
        TROOP_CAP_MIN_GOLD,
        land * TROOP_CAP_GOLD_PER_LAND + barracks * TROOP_CAP_GOLD_PER_BARRACKS,
    )


def sane_army(race: str, land: int, barracks: int) -> dict:
    """Compute a mixed, capped roster for an AI kingdom."""
    units = RACE_UNITS.get(race, RACE_UNITS["Human"])
    mult = RACE_ECON_MULT.get(race, 1.0)
    gold_cap = troop_cap_gold(land, barracks)
    count_cap = unit_count_cap(land)

    # Allocate the gold cap across tiers by weight, then clamp the total head-count
    # to the land-based cap (scaling all tiers proportionally if needed).
    raw = []
    for tier in range(len(units)):
        cost_per = round(TIER_BASE_GOLD[tier] * mult)
        tier_gold = gold_cap * TIER_TRAIN_WEIGHTS[tier]
        raw.append(max(0, int(tier_gold // cost_per)))

    total = sum(raw)
    if total > count_cap and total > 0:
        scale = count_cap / total
        raw = [int(q * scale) for q in raw]

    return {units[t]: raw[t] for t in range(len(units)) if raw[t] > 0}


def as_num(v) -> int:
    """Read a DynamoDB attribute that may be {'N': '...'} or nested."""
    if isinstance(v, dict) and "N" in v:
        return int(float(v["N"]))
    return 0


def parse_map(attr) -> dict:
    """Parse a DynamoDB Map attribute → {key: int}. Handles missing/empty."""
    if not attr or "M" not in attr:
        return {}
    return {k: as_num(v) for k, v in attr["M"].items()}


def main() -> None:
    apply = "--apply" in sys.argv
    mode = "APPLY" if apply else "DRY RUN"
    print(f"=== reset-ai-armies ({mode}) — table {TABLE} ===\n")

    paginator = ddb.get_paginator("scan")
    scanned = changed = 0

    for page in paginator.paginate(
        TableName=TABLE,
        FilterExpression="isAI = :t",
        ExpressionAttributeValues={":t": {"BOOL": True}},
        ProjectionExpression="id, #n, race, #r, totalUnits, buildings",
        ExpressionAttributeNames={"#n": "name", "#r": "resources"},
    ):
        for item in page["Items"]:
            scanned += 1
            kid = item["id"]["S"]
            name = item.get("name", {}).get("S", kid)
            race = item.get("race", {}).get("S", "Human")
            res = parse_map(item.get("resources"))
            buildings = parse_map(item.get("buildings"))
            old_units = parse_map(item.get("totalUnits"))

            land = res.get("land", 100)
            gold = res.get("gold", 0)
            barracks = buildings.get("barracks", 0)

            old_total = sum(old_units.values())
            new_units = sane_army(race, land, barracks)
            new_total = sum(new_units.values())
            networth = land * 1000 + gold + new_total * NETWORTH_UNIT_VALUE

            # Only touch kingdoms whose army actually shrinks (the bloated ones).
            if new_total >= old_total:
                continue
            changed += 1

            print(
                f"{name[:22]:22} {race:9} land={land:>6} "
                f"units {old_total:>6} -> {new_total:>5}  cap={unit_count_cap(land)}"
            )

            if apply:
                new_units_attr = {k: {"N": str(v)} for k, v in new_units.items()}
                ddb.update_item(
                    TableName=TABLE,
                    Key={"id": {"S": kid}},
                    UpdateExpression="SET totalUnits = :u, networth = :n",
                    ExpressionAttributeValues={
                        ":u": {"M": new_units_attr},
                        ":n": {"N": str(networth)},
                    },
                )

    print(f"\n=== {mode}: scanned {scanned} AI kingdoms, "
          f"{'updated' if apply else 'would update'} {changed} ===")
    if not apply:
        print("Re-run with --apply to write these changes.")


if __name__ == "__main__":
    main()
