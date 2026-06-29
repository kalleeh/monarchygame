import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { combatProcessor } from '../functions/combat-processor/resource';
import { resourceManager } from '../functions/resource-manager/resource';
import { buildingConstructor } from '../functions/building-constructor/resource';
import { unitTrainer } from '../functions/unit-trainer/resource';
import { spellCaster } from '../functions/spell-caster/resource';
import { territoryClaimer } from '../functions/territory-claimer/resource';
import { seasonManager } from '../functions/season-manager/resource';
import { warManager } from '../functions/war-manager/resource';
import { tradeProcessor } from '../functions/trade-processor/resource';
import { diplomacyProcessor } from '../functions/diplomacy-processor/resource';
import { seasonLifecycle } from '../functions/season-lifecycle/resource';
import { thieveryProcessor } from '../functions/thievery-processor/resource';
import { faithProcessor } from '../functions/faith-processor/resource';
import { bountyProcessor } from '../functions/bounty-processor/resource';
import { allianceTreasury } from '../functions/alliance-treasury/resource';
import { allianceManager } from '../functions/alliance-manager/resource';
import { turnTicker } from '../functions/turn-ticker/resource';

import { kingdomCleanup } from '../functions/kingdom-cleanup/resource';

/**
 * Monarchy Game Data Schema - Enhanced with Field-Level Authorization & Input Validation
 * IQC Compliant: Integrity (proper types), Quality (clean structure), Consistency (naming)
 */

// Shared Enums for Input Validation
const RaceType = a.enum(['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae']);
const GameAge = a.enum(['early', 'middle', 'late']);
const AttackType = a.enum(['standard', 'raid', 'siege', 'pillage']);
const TerritoryType = a.enum(['capital', 'settlement', 'outpost', 'fortress']);
const TerrainType = a.enum(['plains', 'forest', 'mountains', 'desert', 'swamp', 'coastal']);
const NotificationType = a.enum(['attack', 'defense', 'victory', 'defeat', 'alliance', 'trade']);
const InvitationStatus = a.enum(['pending', 'accepted', 'declined']);
const MessageType = a.enum(['general', 'announcement', 'war', 'diplomacy', 'intel', 'strike']);
const SeasonStatus = a.enum(['active', 'transitioning', 'completed']);
const WarStatus = a.enum(['declared', 'active', 'resolved', 'ceasefire']);
const TradeOfferStatus = a.enum(['open', 'accepted', 'cancelled', 'expired']);
const DiplomaticStatus = a.enum(['neutral', 'friendly', 'allied', 'hostile', 'war']);
const TreatyType = a.enum(['non_aggression', 'trade_agreement', 'military_alliance', 'ceasefire']);
const TreatyStatus = a.enum(['proposed', 'active', 'expired', 'broken']);
const RestorationType = a.enum(['none', 'damage_based', 'death_based']);
const GuildWarStatus = a.enum(['ACTIVE', 'ENDED']);

const schema = a.schema({
  // Shared enum definitions
  RaceType,
  GameAge,
  AttackType,
  TerritoryType,
  TerrainType,
  NotificationType,
  InvitationStatus,
  MessageType,
  SeasonStatus,
  WarStatus,
  TradeOfferStatus,
  DiplomaticStatus,
  TreatyType,
  TreatyStatus,
  RestorationType,
  GuildWarStatus,

  Kingdom: a
    .model({
      // Public fields — readable by all authenticated; owner has full access
      name: a.string().required()
        .authorization((allow) => [allow.authenticated().to(['read']), allow.owner()]),
      race: a.ref('RaceType').required()
        .authorization((allow) => [allow.authenticated().to(['read']), allow.owner()]),
      currentAge: a.ref('GameAge').required()
        .authorization((allow) => [allow.authenticated().to(['read']), allow.owner()]),
      isAI: a.boolean().default(false),
      isActive: a.boolean().default(true),
      networth: a.integer().default(0),
      reputation: a.integer().default(100)
        .authorization((allow) => [allow.authenticated().to(['read']), allow.owner()]),
      // Every kingdom belongs to exactly one season. Required so season-scoped
      // queries (leaderboard, targets, AI roster) can never miss a row, and so
      // an orphan kingdom with no season can't exist.
      seasonId: a.id().required(),
      createdAt: a.datetime(),
      ageStartTime: a.datetime(),
      // Owner fields — full owner access (create/read/update); others get null
      resources: a.json()
        .authorization((allow) => [allow.owner()]),
      stats: a.json()
        .authorization((allow) => [allow.owner()]),
      buildings: a.json()
        .authorization((allow) => [allow.owner()]),
      totalUnits: a.json()
        .authorization((allow) => [allow.owner()]),
      turnsBalance: a.integer()
        .authorization((allow) => [allow.owner()]),
      lastResourceTick: a.datetime()
        .authorization((allow) => [allow.owner()]),
      encampEndTime: a.string()
        .authorization((allow) => [allow.owner()]),
      encampBonusTurns: a.integer()
        .authorization((allow) => [allow.owner()]),
      isOnline: a.boolean().default(false)
        .authorization((allow) => [allow.owner()]),
      lastActive: a.datetime()
        .authorization((allow) => [allow.owner()]),
      guildId: a.id()
        .authorization((allow) => [allow.owner()]),
      aiPersonality: a.string()
        .authorization((allow) => [allow.authenticated().to(['read']), allow.owner()]),
    })
    .secondaryIndexes((index) => [
      index('seasonId').sortKeys(['networth']).queryField('listKingdomsBySeasonNetworth'),
      // Note: isActive (boolean) cannot be a GSI key in Amplify Gen 2 — turn-ticker uses dbList+filter
    ])
    .authorization((allow) => [
      // Players can create their kingdom and read it; all writes go through Lambda
      allow.owner().to(['read', 'create']),
      // All authenticated players can read all kingdoms (leaderboard, combat targets, etc.)
      allow.authenticated().to(['read']),
      // Lambda resource grants are applied at the schema level below (allow.resource()
      // is only available on AllowModifier, not BaseAllowModifier used here)
    ]),

  Territory: a
    .model({
      name: a.string().required(),
      type: a.ref('TerritoryType').required(),
      coordinates: a.json().required(),
      terrainType: a.ref('TerrainType').required(),
      resources: a.json().required(),
      buildings: a.json().required(),
      defenseLevel: a.integer().required(),
      kingdomId: a.id().required(),
      regionId: a.string(),
      category: a.enum(['farmland', 'mine', 'forest', 'port', 'stronghold', 'ruins']),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .secondaryIndexes((index) => [
      index('kingdomId').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
    ]),

  // Client-side error/crash reports. Written by the frontend errorReporter so we can
  // proactively monitor what users hit (uncaught errors, unhandled rejections, React
  // error-boundary catches) instead of waiting for manual reports.
  ClientError: a
    .model({
      message: a.string().required(),
      stack: a.string(),
      source: a.string(),          // 'window.onerror' | 'unhandledrejection' | 'errorBoundary' | manual tag
      url: a.string(),             // location.pathname + search when it fired
      kingdomId: a.string(),
      userAgent: a.string(),
      appVersion: a.string(),
      fingerprint: a.string(),     // hash of message+top-of-stack for dedup/grouping
      occurredAt: a.datetime().required(),
      ttl: a.integer(),            // epoch seconds for DynamoDB TTL auto-expiry
    })
    .secondaryIndexes((index) => [
      index('source').sortKeys(['occurredAt']),
    ])
    // Any authenticated user may create (report their own crashes); reads are owner-only
    // plus admins via the data console / CloudWatch. Keeps reporting cheap and safe.
    .authorization((allow) => [
      allow.authenticated().to(['create']),
      allow.owner(),
    ]),

  Alliance: a
    .model({
      name: a.string().required(),
      description: a.string(),
      leaderId: a.id().required(),
      memberIds: a.json().required(),
      maxMembers: a.integer().required(),
      isPublic: a.boolean().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      // Private alliance data - members only
      treasury: a.json()
        .authorization((allow) => [allow.authenticated().to(['read'])]),
      // Alliance-wide computed stats: compositionBonus, activeUpgrades, relationships
      stats: a.json()
        .authorization((allow) => [allow.authenticated().to(['read'])])
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  BattleReport: a
    .model({
      attackerId: a.id().required(),
      defenderId: a.id().required(),
      seasonId: a.id().required(),
      attackType: a.ref('AttackType').required(),
      result: a.json().required(),
      casualties: a.json().required(),
      landGained: a.integer(),
      timestamp: a.datetime().required(),
      // Sensitive battle data - participants only
      detailedReport: a.json()
        .authorization((allow) => [allow.owner().to(['read'])])
    })
    .secondaryIndexes((index) => [
      index('defenderId').sortKeys(['timestamp']),
      index('attackerId').sortKeys(['defenderId']),
      // World feed: newest reports for the active season, server-sorted by time.
      // Avoids an unordered full-table scan (500 AI kingdoms × a battle every
      // 20 min would make a plain list() both wrong and expensive).
      index('seasonId').sortKeys(['timestamp']).queryField('listBattleReportsBySeasonAndTime'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
    ]),

  // Generic world-activity events for the live feed — notably non-combat AI
  // milestones (e.g. crossing a power tier) so the feed isn't dead air in the
  // early age before combat begins. Combat/war still come from BattleReport /
  // WarDeclaration / GuildWar; this captures everything else worth surfacing.
  // Writers (turn-ticker) emit sparingly (threshold crossings, not every tick).
  WorldEventLog: a
    .model({
      seasonId: a.id().required(),
      category: a.string().required(),   // 'milestone' | 'economy' | 'construction' | ...
      kingdomId: a.id(),                  // subject kingdom, if any
      message: a.string().required(),     // human-readable, pre-rendered
      timestamp: a.datetime().required(),
      ttl: a.integer(),                   // epoch seconds for DynamoDB TTL auto-expiry
    })
    .secondaryIndexes((index) => [
      index('seasonId').sortKeys(['timestamp']).queryField('listWorldEventsBySeasonAndTime'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner(),
    ]),

  DefenseSettings: a
    .model({
      kingdomId: a.id().required(),
      autoDefend: a.boolean().required(),
      defenseFormation: a.json().required(),
      alertSettings: a.json().required(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  CombatNotification: a
    .model({
      recipientId: a.id().required(),
      type: a.ref('NotificationType').required(),
      message: a.string().required(),
      data: a.json(),
      isRead: a.boolean().default(false),
      createdAt: a.datetime().required()
    })
    .secondaryIndexes((index) => [
      index('recipientId'),
    ])
    .authorization((allow) => [allow.owner()]),

  AllianceInvitation: a
    .model({
      guildId: a.id().required(),
      inviterId: a.id().required(),
      inviteeId: a.id().required(),
      status: a.ref('InvitationStatus').required(),
      message: a.string(),
      createdAt: a.datetime().required(),
      respondedAt: a.datetime()
    })
    .secondaryIndexes((index) => [
      index('inviteeId'),
      index('inviterId'),
    ])
    .authorization((allow) => [allow.owner()]),

  AllianceMessage: a
    .model({
      guildId: a.id().required(),
      senderId: a.id().required(),
      content: a.string().required(),
      type: a.ref('MessageType').required(),
      createdAt: a.datetime().required()
    })
    .authorization((allow) => [allow.authenticated().to(['read'])]),

  GameSeason: a
    .model({
      seasonNumber: a.integer().required(),
      status: a.ref('SeasonStatus').required(),
      startDate: a.datetime().required(),
      endDate: a.datetime(),
      currentAge: a.ref('GameAge').required(),
      ageTransitions: a.json(),
      participantCount: a.integer().default(0),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  WarDeclaration: a
    .model({
      attackerId: a.id().required(),
      defenderId: a.id().required(),
      seasonId: a.id().required(),
      status: a.ref('WarStatus').required(),
      attackCount: a.integer().default(0),
      declaredAt: a.datetime().required(),
      resolvedAt: a.datetime(),
      reason: a.string(),
    })
    .secondaryIndexes((index) => [
      index('attackerId').sortKeys(['status']),
      index('defenderId').sortKeys(['status']),
      // World feed: newest war declarations for the active season, server-sorted.
      index('seasonId').sortKeys(['declaredAt']).queryField('listWarDeclarationsBySeasonAndTime'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  TradeOffer: a
    .model({
      sellerId: a.id().required(),
      buyerId: a.id(),
      seasonId: a.id().required(),
      resourceType: a.string().required(),
      quantity: a.integer().required(),
      pricePerUnit: a.float().required(),
      totalPrice: a.float().required(),
      status: a.ref('TradeOfferStatus').required(),
      escrowedResources: a.json(),
      expiresAt: a.datetime().required(),
      acceptedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('sellerId'),
      index('buyerId'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  DiplomaticRelation: a
    .model({
      kingdomId: a.id().required(),
      targetKingdomId: a.id().required(),
      status: a.ref('DiplomaticStatus').required(),
      reputation: a.integer().default(0),
      lastActionAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('kingdomId'),
      index('targetKingdomId'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  Treaty: a
    .model({
      proposerId: a.id().required(),
      recipientId: a.id().required(),
      seasonId: a.id().required(),
      type: a.ref('TreatyType').required(),
      status: a.ref('TreatyStatus').required(),
      terms: a.json(),
      proposedAt: a.datetime().required(),
      respondedAt: a.datetime(),
      expiresAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('proposerId'),
      index('recipientId'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  RestorationStatus: a
    .model({
      kingdomId: a.id().required(),
      type: a.ref('RestorationType').required(),
      startTime: a.datetime().required(),
      endTime: a.datetime().required(),
      allowedActions: a.json(),
      prohibitedActions: a.json(),
    })
    .secondaryIndexes((index) => [
      index('kingdomId').sortKeys(['endTime']),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  // Espionage intel: written by thievery-processor on a successful scout. Gates
  // the server-side battle preview — you only get an exact prediction on kingdoms
  // you've scouted recently. Owner-readable so a player sees their own intel.
  ScoutIntel: a
    .model({
      scouterId: a.id().required(),   // kingdom that performed the scout
      targetId: a.id().required(),    // kingdom that was scouted
      seasonId: a.id(),
      expiresAt: a.datetime().required(),
      scoutedAt: a.datetime().required(),
      // Guild intel-sharing: null = private (scouter only); set = the intel is
      // visible to that guild so members get the same defender numbers. The
      // battle PREDICTION stays per-attacker — only the defender snapshot is shared.
      sharedWithGuildId: a.id(),
      // Revealed defender numbers captured at scout time (a snapshot, not live):
      // { totalDefense, armyByTier, fortLevel, land, goldEstimate, defenderName }.
      // Lets a guildmate's preview run their army vs this defense without re-scouting.
      defenderSnapshot: a.json(),
    })
    .secondaryIndexes((index) => [
      index('scouterId').sortKeys(['expiresAt']),
      // Guild listing of active shared intel: rows shared with a guild, newest-
      // expiring last. Members read this then filter expiresAt > now.
      index('sharedWithGuildId').sortKeys(['expiresAt']).name('scoutIntelsBySharedWithGuildIdAndExpiresAt'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner(),
    ]),

  // A guild-scoped marker that flags one target kingdom as a coordinated "planned
  // strike" within a time window. Unlike ScoutIntel (which is per-scouter), a
  // planned strike belongs to the GUILD — any member can read the active marker,
  // and combat-processor grants the coordination bonus to the first attacker in
  // the window. Stored as its own model (not an overloaded ScoutIntel field) so
  // the guildId+targetId lookup is a single clean GSI query and the personal-scout
  // gate on ScoutIntel stays untouched. Members read via the guildId GSI then
  // filter `until > now`.
  PlannedStrike: a
    .model({
      guildId: a.id().required(),     // guild that planned the strike
      targetId: a.id().required(),    // kingdom to be struck
      createdBy: a.id().required(),   // kingdom that flagged it
      until: a.datetime().required(), // strike window expiry
      seasonId: a.id(),
    })
    .secondaryIndexes((index) => [
      // Guild listing of planned strikes: rows for a guild, soonest-expiring last.
      // Readers (members + combat-processor) then filter until > now.
      index('guildId').sortKeys(['until']).name('plannedStrikesByGuildIdAndUntil'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner(),
    ]),

  WorldState: a
    .model({
      seasonId: a.id().required(),
      kingdomId: a.id().required(),
      visibleKingdoms: a.json(),
      fogOfWar: a.json(),
      lastUpdated: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('kingdomId').sortKeys(['seasonId']).name('worldStatesByKingdomIdAndSeasonId')
    ])
    .authorization((allow) => [
      allow.owner()
    ]),

  RateLimit: a
    .model({
      count: a.integer().required(),
      windowStart: a.integer().required(),
      ttl: a.integer(),
    })
    .authorization((allow) => [allow.authenticated()]),

  GuildWar: a
    .model({
      attackingGuildId: a.string().required(),
      defendingGuildId: a.string().required(),
      attackingGuildName: a.string().required(),
      defendingGuildName: a.string().required(),
      seasonId: a.id().required(),
      status: a.ref('GuildWarStatus').required(),
      declaredAt: a.datetime().required(),
      endsAt: a.datetime().required(),
      attackingScore: a.integer().default(0),
      defendingScore: a.integer().default(0),
      contributions: a.json(),
      winnerId: a.string(),
    })
    .secondaryIndexes((index) => [
      // World feed: newest guild wars for the active season, server-sorted.
      index('seasonId').sortKeys(['declaredAt']).queryField('listGuildWarsBySeasonAndTime'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  processCombat: a
    .mutation()
    .arguments({
      attackerId: a.string().required(),
      defenderId: a.string().required(),
      attackType: a.ref('AttackType').required(),
      units: a.json().required(),
      formationId: a.string(),
      terrainId: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(combatProcessor)),

  // Read-only battle prediction: runs the real combat power calc server-side
  // (reading the defender's owner-private army) and returns the expected ratio,
  // tier, and casualty rates WITHOUT mutating anything. The client can't compute
  // this itself because enemy totalUnits is owner-only.
  getBattlePreview: a
    .query()
    .arguments({
      attackerId: a.string().required(),
      defenderId: a.string().required(),
      preview: a.boolean().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(combatProcessor)),

  updateResources: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      turns: a.integer()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resourceManager)),

  encampKingdom: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      duration: a.integer().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resourceManager)),

  constructBuildings: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      buildingType: a.string().required(),
      quantity: a.integer().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(buildingConstructor)),

  trainUnits: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      unitType: a.string().required(),
      quantity: a.integer().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(unitTrainer)),

  castSpell: a
    .mutation()
    .arguments({
      casterId: a.string().required(),
      spellId: a.string().required(),
      targetId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(spellCaster)),

  // Live spell status: real temples/land/race/elan for the caster's kingdom,
  // so the client computes maxElan and temple gates from authoritative data.
  getSpellStatus: a
    .query()
    .arguments({
      kingdomId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(spellCaster)),

  claimTerritory: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      territoryName: a.string().required(),
      territoryType: a.ref('TerritoryType').required(),
      terrainType: a.ref('TerrainType').required(),
      coordinates: a.json().required(),
      regionId: a.string(),
      category: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(territoryClaimer)),

  upgradeTerritory: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      territoryId: a.string().required(),
      newDefenseLevel: a.integer().required(),
      goldCost: a.integer().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(territoryClaimer)),

  // Season Manager
  getActiveSeason: a
    .query()
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(seasonManager)),

  // Prefixed "fetch" to avoid clash with WorldState model auto-generating getWorldState
  fetchWorldState: a
    .query()
    .arguments({
      kingdomId: a.string().required(),
      seasonId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(seasonManager)),

  // War Manager
  declareWar: a
    .mutation()
    .arguments({
      attackerId: a.string().required(),
      defenderId: a.string().required(),
      seasonId: a.string().required(),
      reason: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(warManager)),

  resolveWar: a
    .mutation()
    .arguments({
      warId: a.string().required(),
      resolution: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(warManager)),

  // Trade Processor — prefixed with "post/buy/revoke" to avoid clash with
  // auto-generated TradeOffer model CRUD (createTradeOffer etc.)
  postTradeOffer: a
    .mutation()
    .arguments({
      sellerId: a.string().required(),
      seasonId: a.string().required(),
      resourceType: a.string().required(),
      quantity: a.integer().required(),
      pricePerUnit: a.float().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(tradeProcessor)),

  buyTradeOffer: a
    .mutation()
    .arguments({
      offerId: a.string().required(),
      buyerId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(tradeProcessor)),

  revokeTradeOffer: a
    .mutation()
    .arguments({
      offerId: a.string().required(),
      sellerId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(tradeProcessor)),

  // Diplomacy Processor
  sendTreatyProposal: a
    .mutation()
    .arguments({
      proposerId: a.string().required(),
      recipientId: a.string().required(),
      seasonId: a.string().required(),
      treatyType: a.string().required(),
      terms: a.json()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(diplomacyProcessor)),

  respondToTreaty: a
    .mutation()
    .arguments({
      treatyId: a.string().required(),
      accepted: a.boolean().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(diplomacyProcessor)),

  declareDiplomaticWar: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      targetKingdomId: a.string().required(),
      seasonId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(diplomacyProcessor)),

  makeDiplomaticPeace: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      targetKingdomId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(diplomacyProcessor)),

  // Season Lifecycle
  manageSeason: a
    .mutation()
    .arguments({
      action: a.string().required(),
      seasonId: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(seasonLifecycle)),

  // Thievery Processor
  executeThievery: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      operation: a.string().required(),
      targetKingdomId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(thieveryProcessor)),

  // Share a player's existing ScoutIntel row with their guild: stamps
  // sharedWithGuildId on the row and drops an intel AllianceMessage into guild
  // chat. Routed to the espionage Lambda (thievery-processor) which already owns
  // ScoutIntel writes and has the data-access grant.
  shareScoutIntel: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      targetKingdomId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(thieveryProcessor)),

  // Flag a shared-intel target as a guild "planned strike" with a time window
  // (defaults to 2h). Creates a PlannedStrike row and drops a 'strike' rally
  // message into guild chat. Routed to the espionage Lambda (thievery-processor)
  // which already owns intel writes and the data-access grant.
  planScoutStrike: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      targetKingdomId: a.string().required(),
      durationMinutes: a.integer()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(thieveryProcessor)),

  // Read the guild's active planned strikes (rows where until > now). Routed to
  // thievery-processor so the read uses the Lambda data-access grant rather than
  // exposing every member's guildId via a client-side model query.
  getActivePlannedStrikes: a
    .query()
    .arguments({
      kingdomId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(thieveryProcessor)),

  // Faith Processor
  updateFaith: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      action: a.string().required(),
      alignment: a.string(),
      abilityType: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(faithProcessor)),

  // Bounty Processor
  claimBounty: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      targetId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bountyProcessor)),

  completeBounty: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      targetId: a.string().required(),
      landGained: a.integer().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(bountyProcessor)),

  // Alliance Treasury
  manageAllianceTreasury: a
    .mutation()
    .arguments({
      allianceId: a.string().required(),
      kingdomId: a.string().required(),
      action: a.string().required(),
      amount: a.integer(),
      upgradeType: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(allianceTreasury)),

  // Alliance Manager
  manageAlliance: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      action: a.string().required(),
      allianceId: a.string(),
      name: a.string(),
      description: a.string(),
      isPublic: a.boolean(),
      targetKingdomId: a.string(),
      targetAllianceId: a.string(),
      relationship: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(allianceManager)),

  // Save defensive formation — routes through resourceManager so the write
  // goes through a Lambda rather than a direct client Kingdom.update({ stats })
  saveDefensiveFormation: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      formationId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resourceManager)),

  // Save unlocked achievements — routes through resourceManager so the stats
  // write goes through a Lambda rather than a direct client Kingdom.update({ stats })
  saveAchievements: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      achievementIds: a.string().required(),
      rewardGold: a.integer(),
      rewardTurns: a.integer(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resourceManager)),

  cleanupKingdom: a
    .mutation()
    .arguments({ kingdomId: a.string().required(), confirmation: a.string().required() })
    .returns(a.json())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(kingdomCleanup)),
})
// Schema-level resource grants — allow.resource() requires AllowModifier (available
// here) not BaseAllowModifier (available on model-level .authorization() callbacks).
// All Lambda functions that need to read/write Kingdom or other model records are
// listed here so they bypass the owner/authenticated model-level rules.
.authorization((allow) => [
  allow.resource(resourceManager),
  allow.resource(combatProcessor),
  allow.resource(buildingConstructor),
  allow.resource(unitTrainer),
  allow.resource(spellCaster),
  allow.resource(territoryClaimer),
  allow.resource(seasonManager),
  allow.resource(seasonLifecycle),
  allow.resource(warManager),
  allow.resource(tradeProcessor),
  allow.resource(diplomacyProcessor),
  allow.resource(thieveryProcessor),
  allow.resource(faithProcessor),
  allow.resource(bountyProcessor),
  allow.resource(allianceTreasury),
  allow.resource(allianceManager),
  allow.resource(turnTicker),
  allow.resource(kingdomCleanup),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
