/**
 * AI Personality System Demo
 * Demonstrates unique AI opponents with Race + Persona + Playstyle combinations
 */

import { describe, it, expect } from 'vitest';
import { AIPersonalitySystem } from '../aiPersonalitySystem';

describe('AI Personality System', () => {
  it('should generate unique personalities for different races', () => {
    const personalitySystem = new AIPersonalitySystem();
    
    // Generate personalities for different races
    const humanMerchant = personalitySystem.generatePersonality('human1', 'Human');
    const drobenWarlord = personalitySystem.generatePersonality('droben1', 'Droben');
    const sidheArchmage = personalitySystem.generatePersonality('sidhe1', 'Sidhe');
    const elvenGuardian = personalitySystem.generatePersonality('elven1', 'Elven');
    
    console.log('🎭 AI PERSONALITY SHOWCASE');
    console.log('========================================');
    
    console.log(`\n👤 ${humanMerchant.name} ${humanMerchant.title}`);
    console.log(`   Race: ${humanMerchant.race} | Persona: ${humanMerchant.persona} | Style: ${humanMerchant.playstyle}`);
    console.log(`   Description: ${humanMerchant.description}`);
    console.log(`   Traits: Aggression ${humanMerchant.traits.aggression.toFixed(1)}, Economy ${humanMerchant.traits.economy.toFixed(1)}, Magic ${humanMerchant.traits.magic.toFixed(1)}`);
    console.log(`   Strategy: ${humanMerchant.behavior.economicStrategy} | ${humanMerchant.behavior.militaryStrategy}`);
    
    console.log(`\n⚔️ ${drobenWarlord.name} ${drobenWarlord.title}`);
    console.log(`   Race: ${drobenWarlord.race} | Persona: ${drobenWarlord.persona} | Style: ${drobenWarlord.playstyle}`);
    console.log(`   Description: ${drobenWarlord.description}`);
    console.log(`   Traits: Aggression ${drobenWarlord.traits.aggression.toFixed(1)}, Economy ${drobenWarlord.traits.economy.toFixed(1)}, Magic ${drobenWarlord.traits.magic.toFixed(1)}`);
    console.log(`   Strategy: ${drobenWarlord.behavior.economicStrategy} | ${drobenWarlord.behavior.militaryStrategy}`);
    
    console.log(`\n🔮 ${sidheArchmage.name} ${sidheArchmage.title}`);
    console.log(`   Race: ${sidheArchmage.race} | Persona: ${sidheArchmage.persona} | Style: ${sidheArchmage.playstyle}`);
    console.log(`   Description: ${sidheArchmage.description}`);
    console.log(`   Traits: Aggression ${sidheArchmage.traits.aggression.toFixed(1)}, Economy ${sidheArchmage.traits.economy.toFixed(1)}, Magic ${sidheArchmage.traits.magic.toFixed(1)}`);
    console.log(`   Strategy: ${sidheArchmage.behavior.economicStrategy} | ${sidheArchmage.behavior.militaryStrategy}`);
    
    console.log(`\n🛡️ ${elvenGuardian.name} ${elvenGuardian.title}`);
    console.log(`   Race: ${elvenGuardian.race} | Persona: ${elvenGuardian.persona} | Style: ${elvenGuardian.playstyle}`);
    console.log(`   Description: ${elvenGuardian.description}`);
    console.log(`   Traits: Aggression ${elvenGuardian.traits.aggression.toFixed(1)}, Economy ${elvenGuardian.traits.economy.toFixed(1)}, Magic ${elvenGuardian.traits.magic.toFixed(1)}`);
    console.log(`   Strategy: ${elvenGuardian.behavior.economicStrategy} | ${elvenGuardian.behavior.militaryStrategy}`);
    
    // Verify personalities are different
    expect(humanMerchant.race).toBe('Human');
    expect(drobenWarlord.race).toBe('Droben');
    expect(sidheArchmage.race).toBe('Sidhe');
    expect(elvenGuardian.race).toBe('Elven');
    
    // Verify trait differences
    expect(drobenWarlord.traits.aggression).toBeGreaterThan(humanMerchant.traits.aggression);
    expect(sidheArchmage.traits.magic).toBeGreaterThan(drobenWarlord.traits.magic);
    expect(humanMerchant.traits.economy).toBeGreaterThan(drobenWarlord.traits.economy);
  });
  
  it('should generate different personalities for same race', () => {
    const personalitySystem = new AIPersonalitySystem();
    
    // Generate multiple Human personalities
    const human1 = personalitySystem.generatePersonality('human1', 'Human');
    const human2 = personalitySystem.generatePersonality('human2', 'Human');
    const human3 = personalitySystem.generatePersonality('human3', 'Human');
    
    console.log('\n🎭 SAME RACE, DIFFERENT PERSONALITIES');
    console.log('========================================');
    
    console.log(`\n${human1.name} ${human1.title} (${human1.persona} ${human1.playstyle})`);
    console.log(`   Attack Threshold: ${human1.modifiers.attackThreshold.toFixed(2)}x`);
    console.log(`   Economic Focus: ${human1.modifiers.buildPriority.toFixed(1)}`);
    console.log(`   Military Focus: ${human1.modifiers.militaryFocus.toFixed(1)}`);
    
    console.log(`\n${human2.name} ${human2.title} (${human2.persona} ${human2.playstyle})`);
    console.log(`   Attack Threshold: ${human2.modifiers.attackThreshold.toFixed(2)}x`);
    console.log(`   Economic Focus: ${human2.modifiers.buildPriority.toFixed(1)}`);
    console.log(`   Military Focus: ${human2.modifiers.militaryFocus.toFixed(1)}`);
    
    console.log(`\n${human3.name} ${human3.title} (${human3.persona} ${human3.playstyle})`);
    console.log(`   Attack Threshold: ${human3.modifiers.attackThreshold.toFixed(2)}x`);
    console.log(`   Economic Focus: ${human3.modifiers.buildPriority.toFixed(1)}`);
    console.log(`   Military Focus: ${human3.modifiers.militaryFocus.toFixed(1)}`);
    
    // Verify they have different personas or playstyles
    const personalities = [human1, human2, human3];
    const uniquePersonas = new Set(personalities.map(p => p.persona));
    const uniquePlaystyles = new Set(personalities.map(p => p.playstyle));
    
    // Should have some variety in personas or playstyles
    expect(uniquePersonas.size + uniquePlaystyles.size).toBeGreaterThan(2);
  });
  
  it('should create consistent personalities for same kingdom ID', () => {
    const personalitySystem = new AIPersonalitySystem();
    
    // Generate personality for same kingdom ID multiple times
    const personality1 = personalitySystem.getPersonality('test_kingdom', 'Human');
    const personality2 = personalitySystem.getPersonality('test_kingdom', 'Human');
    
    // Should be identical
    expect(personality1.name).toBe(personality2.name);
    expect(personality1.persona).toBe(personality2.persona);
    expect(personality1.playstyle).toBe(personality2.playstyle);
    expect(personality1.traits.aggression).toBe(personality2.traits.aggression);
  });
  
  it('should demonstrate extreme personality differences', () => {
    const personalitySystem = new AIPersonalitySystem();
    
    // Force generate specific combinations for demonstration
    const aggressiveDroben = personalitySystem.generatePersonality('droben_berserker', 'Droben');
    const defensiveElven = personalitySystem.generatePersonality('elven_guardian', 'Elven');
    
    console.log('\n⚡ EXTREME PERSONALITY COMPARISON');
    console.log('========================================');
    
    console.log(`\n🔥 AGGRESSIVE: ${aggressiveDroben.name} ${aggressiveDroben.title}`);
    console.log(`   Aggression: ${aggressiveDroben.traits.aggression.toFixed(2)} | Risk: ${aggressiveDroben.traits.risk.toFixed(2)}`);
    console.log(`   Attack Threshold: ${aggressiveDroben.modifiers.attackThreshold.toFixed(2)}x (lower = more aggressive)`);
    console.log(`   War Declaration Cost: ${aggressiveDroben.modifiers.warDeclarationCost.toFixed(2)} (lower = less hesitation)`);
    
    console.log(`\n🛡️ DEFENSIVE: ${defensiveElven.name} ${defensiveElven.title}`);
    console.log(`   Aggression: ${defensiveElven.traits.aggression.toFixed(2)} | Risk: ${defensiveElven.traits.risk.toFixed(2)}`);
    console.log(`   Attack Threshold: ${defensiveElven.modifiers.attackThreshold.toFixed(2)}x (higher = more cautious)`);
    console.log(`   War Declaration Cost: ${defensiveElven.modifiers.warDeclarationCost.toFixed(2)} (higher = more hesitation)`);
    
    // Verify extreme differences
    expect(aggressiveDroben.traits.aggression).toBeGreaterThan(defensiveElven.traits.aggression);
    expect(aggressiveDroben.modifiers.attackThreshold).toBeLessThan(defensiveElven.modifiers.attackThreshold);
    expect(aggressiveDroben.modifiers.warDeclarationCost).toBeLessThan(defensiveElven.modifiers.warDeclarationCost);
  });
});
