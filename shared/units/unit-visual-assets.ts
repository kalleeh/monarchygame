/**
 * Race-specific unit visual asset specifications
 * Contains SD3.5 prompts for generating unit artwork
 */

export interface UnitVisualAsset {
  name: string;
  description: string;
  thematic: string;
  sd35Prompt: string;
  negativePrompt: string;
  artStyle: string;
  outputFilename: string;
}

export interface RaceUnitAssets {
  peasant: UnitVisualAsset;
  greenScum: UnitVisualAsset;
  eliteScum: UnitVisualAsset;
}

/**
 * Base art style parameters for all units - CONSISTENT ACROSS ALL GENERATIONS
 * Following SD3.5 prompt guide best practices
 */
const BASE_STYLE = `
STYLE: Digital illustration, fantasy game art, Heroes of Might and Magic III style, classic 90s fantasy RPG aesthetic, hand-painted digital art, bold outlines, vibrant saturated colors, painterly technique, fantasy strategy game character portrait

SUBJECT FRAMING: Full body character portrait, dynamic action pose, character centered and filling 75% of frame, 3/4 angle view

COMPOSITION: Clean character silhouette against dark fantasy background, dramatic vignette framing, action-ready stance, iconic game character design

LIGHTING: Dramatic rim lighting with purple and blue magical glow, high contrast shadows, fantasy game lighting, backlight creating strong edge definition, dynamic shadows

COLOR: Rich saturated fantasy colors, dominant purple (#8b5cf6) and blue (#6366f1) magical ambient tones, dark background, bold color blocking, vibrant game art palette

TECHNICAL: Sharp painted edges, clean silhouette, 1024x1024 game asset, thick painted outlines, simplified but detailed forms
`.trim();

const BASE_NEGATIVE = `
photorealistic, photograph, photo, realistic, hyperrealistic, 3D render, CGI, real person, camera, lens, DSLR, bokeh, photo filter, watercolor filter, filtered photo, realistic skin texture, realistic lighting, film grain,
blurry, low quality, bad anatomy, deformed, extra limbs, text, watermark, multiple characters, cropped, modern, sci-fi, flat lighting
`.trim();

/**
 * Race-specific unit visual asset specifications with SD3.5 generation prompts
 */
export const RACE_UNIT_VISUAL_ASSETS: Record<string, RaceUnitAssets> = {
  human: {
    peasant: {
      name: 'Human Peasant',
      description: 'Traditional farmer with pitchfork',
      thematic: 'Balanced, hardworking commoner',
      sd35Prompt: `
Medieval human peasant farmer in action, full body shot of male adult working the land, weathered sun-tanned skin showing years of outdoor labor, short brown hair, strong build, wearing simple brown wool tunic and pants, leather boots, holding wooden pitchfork in working stance as if tilling soil, determined expression, dirt on clothes and hands, represents honest labor and backbone of society, warm earthy browns and tans, dynamic working pose, ${BASE_STYLE}
      `.trim(),
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'realistic medieval fantasy',
      outputFilename: 'human_peasant.png'
    },
    greenScum: {
      name: 'Human Spy',
      description: 'Cloaked intelligence operative',
      thematic: 'Subtle espionage agent',
      sd35Prompt: `
Human spy in stealth action, full body shot of figure in dark hooded cloak moving through shadows, face partially hidden, leather armor visible underneath, throwing knives at belt, one hand on dagger hilt in ready stance, athletic build, alert posture suggesting constant vigilance, dark muted blacks greys and browns, subtle purple rim lighting, represents covert intelligence operative, dynamic sneaking pose, ${BASE_STYLE}
      `.trim(),
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'noir fantasy espionage',
      outputFilename: 'human_green_scum.png'
    },
    eliteScum: {
      name: 'Human Assassin',
      description: 'Elite covert operative',
      thematic: 'Master of stealth and death',
      sd35Prompt: `
Elite human assassin in combat stance, full body shot of deadly professional in black tactical leather armor, masked face with intense eyes, dual curved daggers drawn and ready, muscular athletic build in aggressive fighting pose, scars on exposed arms, black and dark grey with crimson blade accents, dramatic shadows emphasizing danger, represents master assassin, dynamic attack pose ready to strike, ${BASE_STYLE}
      `.trim(),
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'dark fantasy assassin',
      outputFilename: 'human_elite_scum.png'
    }
  },

  elven: {
    peasant: {
      name: 'Elven Commoner',
      description: 'Graceful forest dweller',
      thematic: 'Elegant woodland worker',
      sd35Prompt: `
Elven commoner character portrait, elegant figure with distinctive pointed ears, flowing light green silk robes with nature-inspired embroidery, delicate angular facial features showing timeless beauty, long flowing blonde hair with subtle braids, gentle serene expression with slight knowing smile, pale luminous skin, graceful posture suggesting natural nobility, holding simple wooden staff with living vines wrapped around it, emerald green and gold color palette, represents forest-dwelling civilization, refined but not ostentatious, connection to nature evident in clothing and demeanor, ${BASE_STYLE}
      `.trim(),
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'elegant high fantasy',
      outputFilename: 'elven_peasant.png'
    },
    greenScum: {
      name: 'Elven Scout',
      description: 'Swift woodland tracker',
      thematic: 'Silent forest ranger',
      sd35Prompt: `Male elven scout with pointed ears, forest green leather armor, longbow on back, keen observant eyes, camouflage cloak, portrait view, ${BASE_STYLE}, dappled forest lighting, green and brown tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'ranger fantasy',
      outputFilename: 'elven_green_scum.png'
    },
    eliteScum: {
      name: 'Elven Shadow',
      description: 'Master of stealth and archery',
      thematic: 'Legendary silent hunter',
      sd35Prompt: `Female elven shadow assassin with pointed ears, dark green and black leather armor, elegant bow, mysterious hooded face, silver hair, portrait view, ${BASE_STYLE}, moonlit shadows, silver and dark green`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'dark elf fantasy',
      outputFilename: 'elven_elite_scum.png'
    }
  },

  goblin: {
    peasant: {
      name: 'Goblin Worker',
      description: 'Cunning cave laborer',
      thematic: 'Mischievous underground worker',
      sd35Prompt: `Goblin worker with green skin, large pointed ears, yellow eyes, ragged brown clothes, mining pickaxe, crooked grin, portrait view, ${BASE_STYLE}, dim cave lighting, green and brown tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'gritty goblin fantasy',
      outputFilename: 'goblin_peasant.png'
    },
    greenScum: {
      name: 'Goblin Sneak',
      description: 'Mischievous saboteur',
      thematic: 'Cunning tunnel infiltrator',
      sd35Prompt: `Goblin sneak thief with green skin, large ears, dark leather outfit, multiple pouches, sly grin, holding lockpicks, portrait view, ${BASE_STYLE}, shadowy underground, green and black tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'rogue goblin fantasy',
      outputFilename: 'goblin_green_scum.png'
    },
    eliteScum: {
      name: 'Goblin Infiltrator',
      description: 'Expert tunnel raider',
      thematic: 'Master saboteur',
      sd35Prompt: `Elite goblin infiltrator with dark green skin, scarred face, black tactical gear, explosives and tools, menacing expression, portrait view, ${BASE_STYLE}, dramatic shadows, dark green and red accents`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'dark goblin commando',
      outputFilename: 'goblin_elite_scum.png'
    }
  },

  droben: {
    peasant: {
      name: 'Droben Laborer',
      description: 'Warrior-worker with axe',
      thematic: 'Militaristic worker culture',
      sd35Prompt: `Droben laborer, muscular humanoid with grey skin, battle scars, simple armor plates, large woodcutting axe, stern warrior face, portrait view, ${BASE_STYLE}, harsh lighting, grey and steel tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'militaristic fantasy',
      outputFilename: 'droben_peasant.png'
    },
    greenScum: {
      name: 'Droben Raider',
      description: 'Aggressive scout',
      thematic: 'Combat-focused reconnaissance',
      sd35Prompt: `Droben raider scout with grey skin, light armor, dual hand axes, aggressive stance, war paint, fierce eyes, portrait view, ${BASE_STYLE}, battle-ready lighting, grey and red tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'warrior scout fantasy',
      outputFilename: 'droben_green_scum.png'
    },
    eliteScum: {
      name: 'Droben Slayer',
      description: 'Elite combat infiltrator',
      thematic: 'Deadly warrior assassin',
      sd35Prompt: `Elite Droben slayer with grey skin, heavy battle scars, black tactical armor, massive combat knife, intimidating presence, portrait view, ${BASE_STYLE}, dramatic war lighting, dark grey and blood red`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'brutal warrior fantasy',
      outputFilename: 'droben_elite_scum.png'
    }
  },

  vampire: {
    peasant: {
      name: 'Vampire Thrall',
      description: 'Enthralled servant',
      thematic: 'Mind-controlled servant',
      sd35Prompt: `Vampire thrall with pale skin, hollow eyes with red glow, tattered servant clothes, submissive posture, bite marks on neck, portrait view, ${BASE_STYLE}, cold moonlight, pale and crimson tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'gothic horror fantasy',
      outputFilename: 'vampire_peasant.png'
    },
    greenScum: {
      name: 'Vampire Bat',
      description: 'Shapeshifted spy',
      thematic: 'Supernatural reconnaissance',
      sd35Prompt: `Vampire bat creature, large intelligent eyes, dark fur, sharp fangs, wings partially visible, sinister intelligence, portrait view, ${BASE_STYLE}, night shadows, black and deep red tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'dark creature fantasy',
      outputFilename: 'vampire_green_scum.png'
    },
    eliteScum: {
      name: 'Vampire Shadow',
      description: 'Night stalker',
      thematic: 'Undead master assassin',
      sd35Prompt: `Male vampire shadow assassin, pale aristocratic face, red glowing eyes, elegant black coat, fangs visible, commanding presence, portrait view, ${BASE_STYLE}, dramatic night lighting, black and crimson`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'vampire lord fantasy',
      outputFilename: 'vampire_elite_scum.png'
    }
  },

  elemental: {
    peasant: {
      name: 'Lesser Elemental',
      description: 'Minor elemental force',
      thematic: 'Basic nature spirit',
      sd35Prompt: `Lesser water elemental, humanoid form made of flowing water, translucent blue body, gentle ripples, peaceful expression, portrait view, ${BASE_STYLE}, soft aquatic lighting, blue and cyan tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'elemental spirit fantasy',
      outputFilename: 'elemental_peasant.png'
    },
    greenScum: {
      name: 'Air Wisp',
      description: 'Invisible air scout',
      thematic: 'Ethereal wind spirit',
      sd35Prompt: `Air wisp elemental, semi-transparent humanoid form made of swirling wind, barely visible, white and grey wisps, mysterious presence, portrait view, ${BASE_STYLE}, ethereal lighting, white and silver tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'ethereal elemental fantasy',
      outputFilename: 'elemental_green_scum.png'
    },
    eliteScum: {
      name: 'Storm Spirit',
      description: 'Elite elemental spy',
      thematic: 'Powerful weather entity',
      sd35Prompt: `Storm spirit elemental, humanoid form crackling with lightning, dark storm clouds forming body, electric blue eyes, powerful presence, portrait view, ${BASE_STYLE}, dramatic storm lighting, dark blue and electric white`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'storm elemental fantasy',
      outputFilename: 'elemental_elite_scum.png'
    }
  },

  centaur: {
    peasant: {
      name: 'Centaur Herder',
      description: 'Swift plains worker',
      thematic: 'Noble horse-human hybrid',
      sd35Prompt: `Centaur herder, human torso with horse lower body, simple leather vest, holding shepherd staff, kind face, flowing mane, portrait view showing upper body, ${BASE_STYLE}, open plains lighting, brown and tan tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'noble centaur fantasy',
      outputFilename: 'centaur_peasant.png'
    },
    greenScum: {
      name: 'Centaur Tracker',
      description: 'Expert hunter-scout',
      thematic: 'Swift reconnaissance specialist',
      sd35Prompt: `Centaur tracker, human torso with horse body, leather armor, longbow ready, alert expression, braided mane, portrait view showing upper body, ${BASE_STYLE}, grassland lighting, brown and green tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'ranger centaur fantasy',
      outputFilename: 'centaur_green_scum.png'
    },
    eliteScum: {
      name: 'Centaur Ranger',
      description: 'Master espionage specialist',
      thematic: 'Legendary scout and hunter',
      sd35Prompt: `Elite centaur ranger, muscular human torso with powerful horse body, masterwork bow, tactical leather armor, scarred veteran face, war braids, portrait view showing upper body, ${BASE_STYLE}, dramatic lighting, dark brown and forest green`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'elite centaur warrior',
      outputFilename: 'centaur_elite_scum.png'
    }
  },

  sidhe: {
    peasant: {
      name: 'Sidhe Attendant',
      description: 'Magical servant',
      thematic: 'Fey court servant',
      sd35Prompt: `Sidhe attendant, ethereal fey creature, delicate features, glowing skin, flowing silk robes, gentle magical aura, serene expression, portrait view, ${BASE_STYLE}, soft magical lighting, purple and silver tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'fey court fantasy',
      outputFilename: 'sidhe_peasant.png'
    },
    greenScum: {
      name: 'Sidhe Seer',
      description: 'Mystical observer',
      thematic: 'Magical divination specialist',
      sd35Prompt: `Sidhe seer, ethereal fey with glowing eyes, mystical robes, crystal orb floating nearby, knowing expression, magical runes, portrait view, ${BASE_STYLE}, mystical lighting, purple and blue tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'mystical fey fantasy',
      outputFilename: 'sidhe_green_scum.png'
    },
    eliteScum: {
      name: 'Sidhe Phantom',
      description: 'Ethereal infiltrator',
      thematic: 'Master of illusion and shadows',
      sd35Prompt: `Sidhe phantom assassin, semi-transparent fey form, elegant dark robes, glowing purple eyes, reality-bending aura, mysterious presence, portrait view, ${BASE_STYLE}, otherworldly lighting, deep purple and black`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'shadow fey fantasy',
      outputFilename: 'sidhe_elite_scum.png'
    }
  },

  dwarven: {
    peasant: {
      name: 'Dwarven Miner',
      description: 'Mountain laborer',
      thematic: 'Sturdy underground worker',
      sd35Prompt: `Dwarven miner, short stocky build, thick beard, mining helmet with lamp, sturdy work clothes, pickaxe over shoulder, determined face, portrait view, ${BASE_STYLE}, underground lighting, brown and grey tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'classic dwarf fantasy',
      outputFilename: 'dwarven_peasant.png'
    },
    greenScum: {
      name: 'Dwarven Scout',
      description: 'Tunnel explorer',
      thematic: 'Underground reconnaissance',
      sd35Prompt: `Dwarven scout, short stocky build, braided beard, light armor, tunnel mapping tools, cautious expression, lantern, portrait view, ${BASE_STYLE}, cave lighting, grey and bronze tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'dwarf ranger fantasy',
      outputFilename: 'dwarven_green_scum.png'
    },
    eliteScum: {
      name: 'Dwarven Sentinel',
      description: 'Elite underground operative',
      thematic: 'Master of tunnel warfare',
      sd35Prompt: `Elite dwarven sentinel, heavily armored short warrior, elaborate beard braids, shield and axe, battle-hardened face, underground fortress guard, portrait view, ${BASE_STYLE}, dramatic forge lighting, steel and gold`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'elite dwarf warrior',
      outputFilename: 'dwarven_elite_scum.png'
    }
  },

  fae: {
    peasant: {
      name: 'Fae Sprite',
      description: 'Tiny magical helper',
      thematic: 'Playful nature spirit',
      sd35Prompt: `Fae sprite, tiny humanoid with delicate wings, colorful flowing dress, cheerful expression, magical sparkles, innocent charm, portrait view, ${BASE_STYLE}, soft magical lighting, pastel rainbow tones`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'whimsical fae fantasy',
      outputFilename: 'fae_peasant.png'
    },
    greenScum: {
      name: 'Fae Trickster',
      description: 'Mischievous spy',
      thematic: 'Cunning magical prankster',
      sd35Prompt: `Male fae trickster, small humanoid with translucent wings, mischievous grin, colorful jester-like outfit, magical dust, playful but cunning eyes, portrait view, ${BASE_STYLE}, whimsical lighting, bright colors`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'trickster fae fantasy',
      outputFilename: 'fae_green_scum.png'
    },
    eliteScum: {
      name: 'Fae Enchanter',
      description: 'Master of illusion',
      thematic: 'Powerful magical deceiver',
      sd35Prompt: `Female fae enchanter, elegant humanoid with shimmering wings, elaborate magical robes, commanding presence, illusion magic swirling, mysterious smile, portrait view, ${BASE_STYLE}, enchanting lighting, purple and gold`,
      negativePrompt: BASE_NEGATIVE,
      artStyle: 'enchanter fae fantasy',
      outputFilename: 'fae_elite_scum.png'
    }
  }
};

/**
 * Get visual asset specification for a specific race's unit type
 */
export function getRaceUnitAsset(
  race: string,
  unitType: 'peasant' | 'greenScum' | 'eliteScum'
): UnitVisualAsset | null {
  const raceAssets = RACE_UNIT_VISUAL_ASSETS[race.toLowerCase()];
  return raceAssets ? raceAssets[unitType] : null;
}

/**
 * Get all visual assets for a specific race
 */
export function getAllRaceAssets(race: string): RaceUnitAssets | null {
  return RACE_UNIT_VISUAL_ASSETS[race.toLowerCase()] || null;
}

/**
 * Get all asset specifications as flat array for batch generation
 */
export function getAllAssetSpecs(): Array<UnitVisualAsset & { race: string; unitType: string }> {
  const specs: Array<UnitVisualAsset & { race: string; unitType: string }> = [];
  
  Object.entries(RACE_UNIT_VISUAL_ASSETS).forEach(([race, assets]) => {
    Object.entries(assets).forEach(([unitType, asset]) => {
      specs.push({ ...asset, race, unitType });
    });
  });
  
  return specs;
}
