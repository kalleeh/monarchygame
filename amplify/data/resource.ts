import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Monarchy Game Data Schema - Simple Working Version
 * IQC Compliant: Integrity (proper types), Quality (clean structure), Consistency (naming)
 */
const schema = a.schema({
  Kingdom: a
    .model({
      name: a.string().required(),
      race: a.enum(['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae']),
      resources: a.json().required(),
      stats: a.json().required(),
      buildings: a.json().required(),
      guildId: a.id(),
      isActive: a.boolean(),
      createdAt: a.datetime(),
      lastActive: a.datetime(),
      totalUnits: a.json().required(),
      isOnline: a.boolean(),
      currentAge: a.enum(['early', 'middle', 'late']),
      ageStartTime: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  Territory: a
    .model({
      name: a.string().required(),
      type: a.enum(['capital', 'settlement', 'outpost', 'fortress']),
      coordinates: a.json().required(),
      terrainType: a.enum(['plains', 'forest', 'mountains', 'desert', 'swamp', 'coastal']),
      resources: a.json().required(),
      buildings: a.json().required(),
      defenseLevel: a.integer().required(),
      kingdomId: a.id().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.owner()]),

  Alliance: a
    .model({
      name: a.string().required(),
      description: a.string(),
      leaderId: a.id().required(),
      memberIds: a.json().required(),
      maxMembers: a.integer().required(),
      isPublic: a.boolean().required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime()
    })
    .authorization((allow) => [allow.authenticated().to(['read']), allow.owner()]),

  BattleReport: a
    .model({
      attackerId: a.id().required(),
      defenderId: a.id().required(),
      attackType: a.string().required(),
      result: a.json().required(),
      casualties: a.json().required(),
      landGained: a.integer(),
      timestamp: a.datetime().required()
    })
    .authorization((allow) => [allow.owner()]),

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
      type: a.enum(['attack', 'defense', 'victory', 'defeat']),
      message: a.string().required(),
      data: a.json(),
      isRead: a.boolean().required(),
      createdAt: a.datetime().required()
    })
    .authorization((allow) => [allow.owner()]),

  AllianceInvitation: a
    .model({
      guildId: a.id().required(),
      inviterId: a.id().required(),
      inviteeId: a.id().required(),
      status: a.enum(['pending', 'accepted', 'declined']),
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
      type: a.enum(['general', 'announcement', 'war', 'diplomacy']),
      createdAt: a.datetime().required()
    })
    .authorization((allow) => [allow.authenticated().to(['read'])]),

  // Add missing GraphQL operations that services expect
  processCombat: a
    .mutation()
    .arguments({
      attackerId: a.string().required(),
      defenderId: a.string().required(),
      attackType: a.string().required(),
      units: a.json().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()]),

  updateResources: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      resources: a.json().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()]),

  constructBuildings: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      buildingType: a.string().required(),
      quantity: a.integer().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()]),

  trainUnits: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      unitType: a.string().required(),
      quantity: a.integer().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()]),

  castSpell: a
    .mutation()
    .arguments({
      casterId: a.string().required(),
      spellId: a.string().required(),
      targetId: a.string().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()]),

  claimTerritory: a
    .mutation()
    .arguments({
      kingdomId: a.string().required(),
      territoryName: a.string().required(),
      coordinates: a.json().required()
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
