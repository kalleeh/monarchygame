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
    stats: { 
      warOffense: 3, 
      warDefense: 4, 
      sorcery: 4, 
      scum: 3, 
      forts: 3, 
      tithe: 3, 
      training: 3, 
      siege: 3, 
      economy: 3, 
      building: 3 
    }
  }
};
