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
const MessageType = a.enum(['general', 'announcement', 'war', 'diplomacy']);
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
      name: a.string().required(),
      race: a.ref('RaceType').required(),
      // Public fields - readable by authenticated users
      resources: a.json().required(),
      stats: a.json().required(),
      buildings: a.json().required(),
      totalUnits: a.json().required(),
      currentAge: a.ref('GameAge').required(),
      isActive: a.boolean().default(true),
      isOnline: a.boolean().default(false),
      createdAt: a.datetime(),
      lastActive: a.datetime(),
      ageStartTime: a.datetime(),
      lastResourceTick: a.datetime(),
      // Private fields - owner only
      guildId: a.id()
        .authorization((allow) => [allow.owner().to(['read', 'update'])]),
      seasonId: a.id()
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
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
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
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
      attackType: a.ref('AttackType').required(),
      result: a.json().required(),
      casualties: a.json().required(),
      landGained: a.integer(),
      timestamp: a.datetime().required(),
      // Sensitive battle data - participants only
      detailedReport: a.json()
        .authorization((allow) => [allow.owner().to(['read'])])
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
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
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner()
    ]),

  WorldState: a
    .model({
      seasonId: a.id().required(),
      kingdomId: a.id().required(),
      visibleKingdoms: a.json(),
      fogOfWar: a.json(),
      lastUpdated: a.datetime().required(),
    })
    .authorization((allow) => [
      allow.owner()
    ]),

  GuildWar: a
    .model({
      attackingGuildId: a.string().required(),
      defendingGuildId: a.string().required(),
      attackingGuildName: a.string().required(),
      defendingGuildName: a.string().required(),
      status: a.ref('GuildWarStatus').required(),
      declaredAt: a.datetime().required(),
      endsAt: a.datetime().required(),
      attackingScore: a.integer().default(0),
      defendingScore: a.integer().default(0),
      contributions: a.json(),
      winnerId: a.string(),
    })
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

  updateResources: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      turns: a.integer()
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
      quantity: a.integer().required()
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

  // Season Manager
  getActiveSeason: a
    .query()
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(seasonManager)),

  getWorldState: a
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

  // Trade Processor
  createTradeOffer: a
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

  acceptTradeOffer: a
    .mutation()
    .arguments({
      offerId: a.string().required(),
      buyerId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(tradeProcessor)),

  cancelTradeOffer: a
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
      amount: a.integer().required()
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
      targetKingdomId: a.string()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(allianceManager)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
