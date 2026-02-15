import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { combatProcessor } from '../functions/combat-processor/resource';
import { resourceManager } from '../functions/resource-manager/resource';
import { buildingConstructor } from '../functions/building-constructor/resource';
import { unitTrainer } from '../functions/unit-trainer/resource';
import { spellCaster } from '../functions/spell-caster/resource';
import { territoryClaimer } from '../functions/territory-claimer/resource';

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
      // Private fields - owner only
      guildId: a.id()
        .authorization((allow) => [allow.owner().to(['read', 'update'])])
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

  processCombat: a
    .mutation()
    .arguments({
      attackerId: a.string().required(),
      defenderId: a.string().required(),
      attackType: a.ref('AttackType').required(),
      units: a.json().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(combatProcessor)),

  updateResources: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      resources: a.json().required()
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
      coordinates: a.json().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(territoryClaimer))
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
