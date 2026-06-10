#!/usr/bin/env python3
"""One-shot wipe of all game data in the live API stack.

The new season-scoped schema makes seasonId required and adds GSIs; existing
rows predate it. Since the game is not live, the clean fix is to empty every
game table and reseed a fresh season. Run only when the game is NOT live.

Usage: python3 scripts/wipe-live-data.py
"""
import boto3

REGION = "eu-west-1"
STACK = "6m5nf6tv7rhernd2vgj5vdw4ba"  # live API stack suffix

MODELS = [
    "Alliance", "AllianceInvitation", "AllianceMessage", "BattleReport",
    "ClientError", "CombatNotification", "DefenseSettings", "DiplomaticRelation",
    "GameSeason", "GuildWar", "Kingdom", "RateLimit", "RestorationStatus",
    "Territory", "TradeOffer", "Treaty", "WarDeclaration", "WorldState",
]

ddb = boto3.client("dynamodb", region_name=REGION)


def wipe(table: str) -> int:
    desc = ddb.describe_table(TableName=table)["Table"]
    key_attrs = [k["AttributeName"] for k in desc["KeySchema"]]

    # Collect every key first (paginated full scan), then delete — avoids
    # mutating the table while a scan cursor is open.
    keys = []
    paginator = ddb.get_paginator("scan")
    for page in paginator.paginate(
        TableName=table,
        ProjectionExpression=",".join(f"#k{i}" for i in range(len(key_attrs))),
        ExpressionAttributeNames={f"#k{i}": a for i, a in enumerate(key_attrs)},
    ):
        for item in page["Items"]:
            keys.append({a: item[a] for a in key_attrs})

    for i in range(0, len(keys), 25):
        batch = keys[i:i + 25]
        request = {table: [{"DeleteRequest": {"Key": k}} for k in batch]}
        resp = ddb.batch_write_item(RequestItems=request)
        # Retry any unprocessed items until drained.
        unprocessed = resp.get("UnprocessedItems", {})
        while unprocessed:
            resp = ddb.batch_write_item(RequestItems=unprocessed)
            unprocessed = resp.get("UnprocessedItems", {})

    return len(keys)


def main() -> None:
    for model in MODELS:
        table = f"{model}-{STACK}-NONE"
        try:
            n = wipe(table)
            print(f"{table}: deleted {n} items")
        except ddb.exceptions.ResourceNotFoundException:
            print(f"{table}: not found, skipping")
    print("=== wipe complete ===")


if __name__ == "__main__":
    main()
