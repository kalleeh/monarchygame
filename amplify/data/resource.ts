import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Monarchy Game Data Schema - Amplify Gen 2
 * Enhanced to support comprehensive game-data systems
 */
const schema = a.schema({
  Kingdom: a
    .model({
      name: a.string().required(),
      race: a.enum(['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae']),
      // Enhanced resources to match game-data
      resources: a.json().required(), // { gold, population, land, turns, elan }
      // Detailed race stats from game-data
      stats: a.json().required(), // Full 10-stat system from game-data
      // Buildings using authentic names from game-data
      buildings: a.json().required(), // { quarries, waterfalls, timoton, etc. }
      // Game state
      isActive: a.boolean().default(true),
      createdAt: a.datetime(),
      lastActive: a.datetime(),
      // Combat-specific fields
      totalUnits: a.json().required(), // Total army composition
      isOnline: a.boolean().default(false),
      // Age system support
      currentAge: a.enum(['early', 'middle', 'late']).default('early'),
      ageStartTime: a.datetime(),
      // Alliance relationship
      allianceId: a.id(),
      alliance: a.belongsTo('Alliance', 'allianceId'),
      // Relationships
      territories: a.hasMany('Territory', 'kingdomId'),
      attacksLaunched: a.hasMany('BattleReport', 'attackerKingdomId'),
      attacksReceived: a.hasMany('BattleReport', 'defenderKingdomId'),
      notifications: a.hasMany('CombatNotification', 'kingdomId'),
      defenseSettings: a.hasOne('DefenseSettings', 'kingdomId'),
      spellsKnown: a.hasMany('KingdomSpell', 'kingdomId'),
      activeBounties: a.hasMany('Bounty', 'kingdomId'),
      restorationStatus: a.hasOne('RestorationStatus', 'kingdomId')
    })
    .authorization((allow) => [allow.owner()]),

  // Spell system support
  KingdomSpell: a
    .model({
      kingdomId: a.id().required(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId'),
      spellId: a.string().required(), // References game-data spell IDs
      spellName: a.string().required(),
      tier: a.integer().required(),
      elanCost: a.integer().required(),
      turnCost: a.integer().required(),
      templeThreshold: a.float().required(),
      lastCast: a.datetime(),
      timesUsed: a.integer().default(0)
    })
    .authorization((allow) => [allow.owner()]),

  // Bounty system support
  Bounty: a
    .model({
      kingdomId: a.id().required(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId'),
      targetKingdomId: a.string().required(),
      targetKingdomName: a.string().required(),
      bountyType: a.enum(['sorcery_kill', 'combat_kill']),
      landReward: a.integer().required(),
      structureBonus: a.integer().required(),
      turnSavings: a.integer().required(),
      isClaimed: a.boolean().default(false),
      claimedAt: a.datetime(),
      createdAt: a.datetime().required()
    })
    .authorization((allow) => [allow.owner()]),

  // Restoration system support
  RestorationStatus: a
    .model({
      kingdomId: a.id().required(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId'),
      isActive: a.boolean().default(false),
      restorationType: a.enum(['damage_based', 'death_based']),
      startTime: a.datetime(),
      endTime: a.datetime(),
      damageLevel: a.float(), // Percentage of damage taken
      actionsBlocked: a.json() // List of blocked actions during restoration
    })
    .authorization((allow) => [allow.owner()]),

  Territory: a
    .model({
      name: a.string().required(),
      // Coordinates on the game map
      coordinates: a.json().required(), // { x, y }
      // Buildings and their levels
      buildings: a.json().required(), // Building counts and levels
      // Military units stationed
      units: a.json().required(), // Unit counts by type
      // Defensive structures
      fortifications: a.integer().default(0),
      // Territory type and resources
      terrainType: a.string().default('plains'),
      // Combat-specific fields
      isCapital: a.boolean().default(false),
      // Relationships
      kingdomId: a.id().required(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId'),
    })
    .authorization((allow) => [allow.owner()]),

  // Enhanced battle reports for combat history
  BattleReport: a
    .model({
      attackerKingdomId: a.id().required(),
      defenderKingdomId: a.id().required(),
      attackerName: a.string().required(),
      defenderName: a.string().required(),
      battleType: a.enum(['raid', 'siege', 'controlled_strike']),
      // Enhanced battle details
      battleDetails: a.json().required(), // Army compositions, casualties, etc.
      attackerArmy: a.json().required(),
      defenderArmy: a.json().required(),
      attackerCasualties: a.json().required(),
      defenderCasualties: a.json().required(),
      spoils: a.json().required(),
      battleDuration: a.integer().required(),
      terrain: a.string(),
      result: a.enum(['attacker_victory', 'defender_victory', 'draw']),
      success: a.boolean().required(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [allow.owner()]),

  // Combat notifications for real-time alerts
  CombatNotification: a
    .model({
      type: a.enum(['incoming_attack', 'attack_result', 'defense_result']),
      message: a.string().required(),
      kingdomName: a.string().required(),
      attackType: a.enum(['raid', 'siege', 'controlled_strike']),
      estimatedArrival: a.datetime(),
      battleResult: a.json(),
      isRead: a.boolean().default(false),
      kingdomId: a.id(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId'),
      timestamp: a.datetime().required()
    })
    .authorization((allow) => [allow.owner()]),

  // Defense settings for combat preferences
  DefenseSettings: a
    .model({
      stance: a.enum(['aggressive', 'balanced', 'defensive']).default('balanced'),
      unitDistribution: a.json().required(),
      autoRetaliate: a.boolean().default(false),
      alertAlliance: a.boolean().default(true),
      kingdomId: a.id(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId')
    })
    .authorization((allow) => [allow.owner()]),

  // Alliance System Models
  Alliance: a
    .model({
      name: a.string().required(),
      description: a.string(),
      tag: a.string().required(), // Short alliance tag (3-5 chars)
      leaderId: a.string().required(),
      leaderName: a.string().required(),
      isPublic: a.boolean().default(true),
      maxMembers: a.integer().default(20),
      memberCount: a.integer().default(1),
      totalPower: a.integer().default(0),
      createdAt: a.datetime(),
      // Relationships
      kingdoms: a.hasMany('Kingdom', 'allianceId'),
      invitations: a.hasMany('AllianceInvitation', 'allianceId'),
      messages: a.hasMany('AllianceMessage', 'allianceId'),
    })
    .authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),

  AllianceInvitation: a
    .model({
      allianceId: a.id().required(),
      alliance: a.belongsTo('Alliance', 'allianceId'),
      targetKingdomId: a.string().required(),
      targetKingdomName: a.string().required(),
      invitedBy: a.string().required(),
      inviterName: a.string().required(),
      status: a.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']).default('PENDING'),
      message: a.string(),
      expiresAt: a.datetime(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),

  AllianceMessage: a
    .model({
      allianceId: a.id().required(),
      alliance: a.belongsTo('Alliance', 'allianceId'),
      senderId: a.string().required(),
      senderName: a.string().required(),
      content: a.string().required(),
      messageType: a.enum(['CHAT', 'ANNOUNCEMENT', 'SYSTEM']).default('CHAT'),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),
})
.authorization((allow) => [allow.owner()])
.addToSchema({
  // GraphQL mutations that trigger Lambda functions
  processCombat: a
    .mutation()
    .arguments({
      input: a.json().required()
    })
    .returns(a.json())
    .handler(a.handler.function('combatProcessor'))
    .authorization((allow) => [allow.authenticated()]),
    
  claimTerritory: a
    .mutation()
    .arguments({
      input: a.json().required()
    })
    .returns(a.json())
    .handler(a.handler.function('territoryManager'))
    .authorization((allow) => [allow.authenticated()]),
    
  constructBuildings: a
    .mutation()
    .arguments({
      input: a.json().required()
    })
    .returns(a.json())
    .handler(a.handler.function('buildingConstructor'))
    .authorization((allow) => [allow.authenticated()]),
    
  trainUnits: a
    .mutation()
    .arguments({
      input: a.json().required()
    })
    .returns(a.json())
    .handler(a.handler.function('unitTrainer'))
    .authorization((allow) => [allow.authenticated()]),
    
  castSpell: a
    .mutation()
    .arguments({
      input: a.json().required()
    })
    .returns(a.json())
    .handler(a.handler.function('spellCaster'))
    .authorization((allow) => [allow.authenticated()]),
    
  updateResources: a
    .mutation()
    .arguments({
      input: a.json().required()
    })
    .returns(a.json())
    .handler(a.handler.function('resourceManager'))
    .authorization((allow) => [allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
