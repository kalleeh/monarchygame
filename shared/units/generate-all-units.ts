/**
 * Script to generate all unit visual assets using proper prompts from unit-visual-assets.ts
 */

import { RACE_UNIT_VISUAL_ASSETS } from './unit-visual-assets';

// Export generation data for each unit
export const GENERATION_QUEUE = Object.entries(RACE_UNIT_VISUAL_ASSETS).flatMap(([raceName, units]) => [
  {
    race: raceName,
    unitType: 'peasant',
    filename: `${raceName}_peasant_v2`,
    prompt: units.peasant.sd35Prompt,
    negativePrompt: units.peasant.negativePrompt,
    name: units.peasant.name,
    description: units.peasant.description
  },
  {
    race: raceName,
    unitType: 'greenScum',
    filename: `${raceName}_green_scum_v2`,
    prompt: units.greenScum.sd35Prompt,
    negativePrompt: units.greenScum.negativePrompt,
    name: units.greenScum.name,
    description: units.greenScum.description
  },
  {
    race: raceName,
    unitType: 'eliteScum',
    filename: `${raceName}_elite_scum_v2`,
    prompt: units.eliteScum.sd35Prompt,
    negativePrompt: units.eliteScum.negativePrompt,
    name: units.eliteScum.name,
    description: units.eliteScum.description
  }
]);

// Print generation queue for verification
console.log('Total units to generate:', GENERATION_QUEUE.length);
console.log('\nFirst unit example:');
console.log(JSON.stringify(GENERATION_QUEUE[0], null, 2));
