# Reference Materials - Historical Game Mechanics Research

**Location**: Moved from `/docs/source-data/` (Nov 2025)  
**Status**: ✅ 100% Incorporated into TypeScript Implementation  
**Purpose**: Historical reference only - not loaded into active development context

## Why This Directory Exists

These are **source research documents** from the original Monarchy game:
- Forum analysis from 2010-2014
- Pro player strategy guides
- Original game mechanics documentation

**All mechanics are now implemented in:**
- `/game-data/mechanics/*.ts` (TypeScript implementations)
- `/docs/01-MECHANICS-REFERENCE.md` (consolidated quick reference)

## When to Use These Files

**Load on-demand when you need:**
1. Historical context for "why was it designed this way?"
2. Original forum discussions and player insights
3. Detailed strategy guides for game balance decisions
4. Verification of exact original mechanics

**Don't load for:**
- Bug fixes
- UI/UX improvements
- Code refactoring
- Performance optimization
- Most feature development

## Directory Structure

```
reference/
├── README.md (this file)
├── forum-analysis/          # Community insights (2010-2014)
│   ├── monarchy-forum-analysis.md
│   └── npac-elite-analysis.md
├── mechanics-documentation/ # Original game systems
│   ├── combat-system.md
│   ├── sorcery-system.md
│   ├── thievery-system.md
│   ├── building-system.md
│   ├── bounty-system.md
│   ├── restoration-system.md
│   └── racial-abilities.md
└── strategy-guides/         # Pro player strategies
    ├── bounties.md
    ├── breaking-realms.md
    ├── defensive-strategy.md
    ├── guild-race-variety.md
    ├── in-between-wars.md
    ├── parking-lots-sorc-kills.md
    ├── resolving-guild-conflicts.md
    ├── war-communication.md
    └── war-finances.md
```

## Implementation Status

**100% Complete** - All documented mechanics faithfully implemented in `/game-data/mechanics/*.ts`

---

**For active development, use `/docs/01-MECHANICS-REFERENCE.md` instead.**
