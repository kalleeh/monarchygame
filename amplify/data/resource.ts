import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Monarchy Game Data Schema - Amplify Gen 2
 * Defines Kingdom, Territory, and BattleReport models for the game
 */
const schema = a.schema({
  Kingdom: a
    .model({
      name: a.string().required(),
      race: a.enum(['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae']),
      // Resources stored as JSON for flexibility
      resources: a.json().required(), // { gold, population, land, turns }
      // Race stats and bonuses
      stats: a.json().required(), // Racial bonuses and modifiers
      // Game state
      isActive: a.boolean().default(true),
      createdAt: a.datetime(),
      lastActive: a.datetime(),
      // Relationships
      territories: a.hasMany('Territory', 'kingdomId'),
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
      // Relationships
      kingdomId: a.id().required(),
      kingdom: a.belongsTo('Kingdom', 'kingdomId'),
    })
    .authorization((allow) => [allow.owner()]),

  // Battle reports for combat history
  BattleReport: a
    .model({
      attackerKingdomId: a.id().required(),
      defenderKingdomId: a.id().required(),
      attackerName: a.string().required(),
      defenderName: a.string().required(),
      battleType: a.enum(['raid', 'siege', 'controlled_strike']),
      // Battle details stored as JSON
      battleDetails: a.json().required(), // Army compositions, casualties, etc.
      result: a.enum(['attacker_victory', 'defender_victory', 'draw']),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [allow.owner()]),
})
.authorization((allow) => [allow.owner()]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
