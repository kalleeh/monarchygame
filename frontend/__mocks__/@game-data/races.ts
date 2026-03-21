export const RACES = {
  Human: {
    name: 'Human',
    specialAbility: {
      name: 'Caravan Frequency',
      description: 'Can send caravans twice as often',
      mechanics: { type: 'caravan_frequency' as const }
    },
    stats: { 
      warOffense: 3, 
      warDefense: 3, 
      sorcery: 3, 
      scum: 3, 
      forts: 3, 
      tithe: 5, 
      training: 3, 
      siege: 3, 
      economy: 5, 
      building: 3 
    }
  },
  Elven: {
    name: 'Elven',
    specialAbility: {
      name: 'Remote Fog',
      description: 'Can cast fog remotely',
      mechanics: { type: 'remote_fog' as const }
    },
    stats: { warOffense: 3, warDefense: 4, sorcery: 4, scum: 3, forts: 3, tithe: 3, training: 3, siege: 3, economy: 3, building: 3 }
  },
  Goblin: {
    name: 'Goblin',
    specialAbility: {
      name: 'Kobold Rage',
      description: 'T2 units get 1.5x bonus during middle age',
      mechanics: { type: 'kobold_rage' as const }
    },
    stats: { warOffense: 5, warDefense: 2, sorcery: 1, scum: 3, forts: 2, tithe: 2, training: 4, siege: 3, economy: 2, building: 2 }
  },
  Droben: {
    name: 'Droben',
    specialAbility: {
      name: 'Combat Summon',
      description: 'Summon bonus troops after a successful attack',
      mechanics: { type: 'combat_summon' as const }
    },
    stats: { warOffense: 5, warDefense: 4, sorcery: 1, scum: 2, forts: 4, tithe: 2, training: 5, siege: 4, economy: 2, building: 3 }
  },
  Vampire: {
    name: 'Vampire',
    specialAbility: {
      name: 'Elan Drain',
      description: 'Drain elan from enemy kingdoms via sorcery',
      mechanics: { type: 'elan_drain' as const }
    },
    stats: { warOffense: 4, warDefense: 3, sorcery: 5, scum: 4, forts: 2, tithe: 4, training: 3, siege: 2, economy: 3, building: 2 }
  },
  Elemental: {
    name: 'Elemental',
    specialAbility: {
      name: 'Fort Destruction',
      description: '+25% bonus to structures destroyed on successful attacks',
      mechanics: { type: 'fort_destruction' as const }
    },
    stats: { warOffense: 4, warDefense: 3, sorcery: 4, scum: 2, forts: 3, tithe: 3, training: 3, siege: 5, economy: 2, building: 3 }
  },
  Centaur: {
    name: 'Centaur',
    specialAbility: {
      name: 'Scout Execution',
      description: 'Can execute enemy scouts with lethal efficiency',
      mechanics: { type: 'scout_execution' as const }
    },
    stats: { warOffense: 3, warDefense: 3, sorcery: 2, scum: 5, forts: 2, tithe: 2, training: 3, siege: 2, economy: 3, building: 3 }
  },
  Sidhe: {
    name: 'Sidhe',
    specialAbility: {
      name: 'Circle Summoning',
      description: 'Emergency temple creation on successful attacks',
      mechanics: { type: 'circle_summoning' as const }
    },
    stats: { warOffense: 2, warDefense: 3, sorcery: 5, scum: 2, forts: 2, tithe: 5, training: 2, siege: 2, economy: 3, building: 4 }
  },
  Dwarven: {
    name: 'Dwarven',
    specialAbility: {
      name: 'Stone Mastery',
      description: 'Fortresses provide double defensive bonus',
      mechanics: { type: 'stone_mastery' as const }
    },
    stats: { warOffense: 2, warDefense: 5, sorcery: 1, scum: 2, forts: 5, tithe: 3, training: 3, siege: 4, economy: 3, building: 5 }
  },
  Fae: {
    name: 'Fae',
    specialAbility: {
      name: 'Glamour',
      description: 'Reduced detection rate on all espionage operations',
      mechanics: { type: 'glamour' as const }
    },
    stats: { warOffense: 3, warDefense: 3, sorcery: 4, scum: 4, forts: 2, tithe: 4, training: 2, siege: 2, economy: 4, building: 3 }
  },
};
