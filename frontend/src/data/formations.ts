import { FormationType, type FormationTemplate } from '../types/combat';

export const FORMATIONS: FormationTemplate[] = [
  {
    type: FormationType.DEFENSIVE_WALL,
    name: 'Defensive Wall',
    description: 'Units form a defensive line, prioritizing protection over aggression',
    icon: '🛡️',
    modifiers: {
      defense: 0.25, // +25% defense
      offense: -0.1, // -10% offense
    },
  },
  {
    type: FormationType.CAVALRY_CHARGE,
    name: 'Cavalry Charge',
    description: 'Aggressive formation focused on overwhelming offense',
    icon: '⚔️',
    modifiers: {
      defense: -0.15, // -15% defense
      offense: 0.3, // +30% offense
    },
  },
  {
    type: FormationType.BALANCED,
    name: 'Balanced Formation',
    description: 'Standard military formation with modest bonuses to both offense and defense',
    icon: '⚖️',
    modifiers: {
      defense: 0.1, // +10% defense
      offense: 0.1, // +10% offense
    },
  },
];
