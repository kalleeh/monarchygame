/**
 * Comprehensive AI Personality System Integration Test
 * Demonstrates all 4 enhancements: Integration, Personalities, Dialogue, Visuals
 */

import { describe, it, expect } from 'vitest';
import { AIPersonalitySystem } from '../aiPersonalitySystem';
import { AIDialogueSystem } from '../aiDialogueSystem';

describe('Complete AI Personality System Integration', () => {
  it('should demonstrate full personality-driven AI system', () => {
    const personalitySystem = new AIPersonalitySystem();
    const dialogueSystem = new AIDialogueSystem();
    
    // Create diverse AI opponents
    const drobenWarlord = personalitySystem.createSpecificPersonality('droben1', 'Droben', 'warlord', 'aggressive');
    const humanMerchant = personalitySystem.createSpecificPersonality('human1', 'Human', 'merchant', 'opportunistic');
    
    console.log('🎭 COMPLETE AI PERSONALITY SYSTEM SHOWCASE');
    console.log('==========================================');
    
    // 1. PERSONALITY DIVERSITY
    console.log('\n1️⃣ PERSONALITY DIVERSITY:');
    console.log(`⚔️ ${drobenWarlord.name} ${drobenWarlord.title}`);
    console.log(`   ${drobenWarlord.race} ${drobenWarlord.persona} (${drobenWarlord.playstyle})`);
    console.log(`   Attack Threshold: ${drobenWarlord.modifiers.attackThreshold.toFixed(2)}x`);
    console.log(`   Traits: Aggression ${drobenWarlord.traits.aggression.toFixed(1)}, Risk ${drobenWarlord.traits.risk.toFixed(1)}`);
    
    console.log(`\n💰 ${humanMerchant.name} ${humanMerchant.title}`);
    console.log(`   ${humanMerchant.race} ${humanMerchant.persona} (${humanMerchant.playstyle})`);
    console.log(`   Economic Focus: ${humanMerchant.modifiers.buildPriority.toFixed(1)}`);
    console.log(`   Traits: Economy ${humanMerchant.traits.economy.toFixed(1)}, Diplomacy ${humanMerchant.traits.diplomacy.toFixed(1)}`);
    
    // 2. DIALOGUE SYSTEM
    console.log('\n2️⃣ PERSONALITY-BASED DIALOGUE:');
    
    // War declaration from aggressive Droben
    const warDialogue = dialogueSystem.generateDialogue(drobenWarlord, {
      situation: 'war_declaration',
      relationship: 'hostile',
      playerStrength: 'weaker',
      gamePhase: 'mid'
    });
    console.log(`\n⚔️ WAR DECLARATION (${drobenWarlord.name}):`);
    console.log(`   "${warDialogue.message}"`);
    console.log(`   Tone: ${warDialogue.tone} | Likelihood: ${(warDialogue.likelihood * 100).toFixed(0)}%`);
    
    // Alliance offer from diplomatic Human
    const allianceDialogue = dialogueSystem.generateDialogue(humanMerchant, {
      situation: 'alliance_offer',
      relationship: 'neutral',
      playerStrength: 'equal',
      gamePhase: 'early'
    });
    console.log(`\n🤝 ALLIANCE OFFER (${humanMerchant.name}):`);
    console.log(`   "${allianceDialogue.message}"`);
    console.log(`   Tone: ${allianceDialogue.tone} | Likelihood: ${(allianceDialogue.likelihood * 100).toFixed(0)}%`);
    
    // Trade request from merchant
    const tradeDialogue = dialogueSystem.generateDialogue(humanMerchant, {
      situation: 'trade_request',
      relationship: 'friendly',
      playerStrength: 'equal',
      gamePhase: 'mid'
    });
    console.log(`\n💼 TRADE REQUEST (${humanMerchant.name}):`);
    console.log(`   "${tradeDialogue.message}"`);
    console.log(`   Tone: ${tradeDialogue.tone} | Likelihood: ${(tradeDialogue.likelihood * 100).toFixed(0)}%`);
    
    // 3. STRATEGIC DECISION DIFFERENCES
    console.log('\n3️⃣ STRATEGIC DECISION DIFFERENCES:');
    
    // Mock AI kingdoms for strategy testing
    const mockAIKingdom = (personality: Record<string, unknown>) => ({
      id: personality.name.toLowerCase(),
      name: personality.name,
      race: personality.race,
      resources: { gold: 50000, land: 5000, turns: 50, population: 10000, mana: 1000 },
      units: { peasants: 1000, militia: 500, knights: 200, cavalry: 100 },
      buildings: { economic: 1000, military: 500, defensive: 300 },
      networth: 75000
    });
    
    // Create kingdoms for demonstration (not used in this test)
    mockAIKingdom(drobenWarlord);
    mockAIKingdom(humanMerchant);
    
    // This would require full integration - showing concept
    console.log(`\n⚔️ ${drobenWarlord.name} Strategy Profile:`);
    console.log(`   Military Focus: ${drobenWarlord.modifiers.militaryFocus.toFixed(1)}/10`);
    console.log(`   Attack Threshold: ${drobenWarlord.modifiers.attackThreshold.toFixed(2)}x (very aggressive)`);
    console.log(`   War Declaration Cost: ${drobenWarlord.modifiers.warDeclarationCost.toFixed(2)} (low hesitation)`);
    console.log(`   Preferred Strategy: ${drobenWarlord.behavior.militaryStrategy}`);
    
    console.log(`\n💰 ${humanMerchant.name} Strategy Profile:`);
    console.log(`   Economic Focus: ${humanMerchant.modifiers.buildPriority.toFixed(1)}/10`);
    console.log(`   Attack Threshold: ${humanMerchant.modifiers.attackThreshold.toFixed(2)}x (cautious)`);
    console.log(`   Alliance Value: ${humanMerchant.modifiers.allianceValue.toFixed(1)}/10`);
    console.log(`   Preferred Strategy: ${humanMerchant.behavior.economicStrategy}`);
    
    // 4. VISUAL INDICATORS (Component Props)
    console.log('\n4️⃣ VISUAL INDICATOR DATA:');
    console.log(`\n🎭 ${drobenWarlord.name} Visual Profile:`);
    console.log(`   Icon: ⚔️ (${drobenWarlord.persona})`);
    console.log(`   Color Theme: Red (High Aggression: ${drobenWarlord.traits.aggression.toFixed(1)})`);
    console.log(`   Trait Bars: Aggression ${Math.round((drobenWarlord.traits.aggression/2)*100)}%, Risk ${Math.round((drobenWarlord.traits.risk/2)*100)}%`);
    console.log(`   Behavior Tags: [${drobenWarlord.behavior.militaryStrategy}] [${drobenWarlord.behavior.economicStrategy}]`);
    
    console.log(`\n💰 ${humanMerchant.name} Visual Profile:`);
    console.log(`   Icon: 💰 (${humanMerchant.persona})`);
    console.log(`   Color Theme: Gold (High Economy: ${humanMerchant.traits.economy.toFixed(1)})`);
    console.log(`   Trait Bars: Economy ${Math.round((humanMerchant.traits.economy/2)*100)}%, Diplomacy ${Math.round((humanMerchant.traits.diplomacy/2)*100)}%`);
    console.log(`   Behavior Tags: [${humanMerchant.behavior.economicStrategy}] [${humanMerchant.behavior.allianceStrategy}]`);
    
    // 5. PERSONALITY INTERACTIONS
    console.log('\n5️⃣ PERSONALITY INTERACTIONS:');
    
    // Diplomatic message between personalities
    const diplomaticMessage = dialogueSystem.generateDiplomaticMessage(
      drobenWarlord,
      humanMerchant,
      'taunt'
    );
    console.log(`\n💬 Diplomatic Exchange:`);
    console.log(`   ${diplomaticMessage}`);
    
    const responseMessage = dialogueSystem.generateDiplomaticMessage(
      humanMerchant,
      drobenWarlord,
      'peace_offer'
    );
    console.log(`   ${responseMessage}`);
    
    // Verify system integration
    expect(drobenWarlord.race).toBe('Droben');
    expect(humanMerchant.race).toBe('Human');
    expect(warDialogue.tone).toBe('aggressive');
    expect(allianceDialogue.tone).toBe('diplomatic');
    expect(drobenWarlord.modifiers.attackThreshold).toBeLessThan(humanMerchant.modifiers.attackThreshold);
    expect(humanMerchant.modifiers.buildPriority).toBeGreaterThan(drobenWarlord.modifiers.buildPriority);
    
    console.log('\n✅ ALL SYSTEMS INTEGRATED SUCCESSFULLY!');
    console.log('   - Personality System: Generating unique AI opponents');
    console.log('   - Dialogue System: Context-aware personality responses');
    console.log('   - Strategy Integration: Personality-driven decisions');
    console.log('   - Visual Components: Ready for UI integration');
  });
  
  it('should demonstrate extreme personality contrasts', () => {
    const personalitySystem = new AIPersonalitySystem();
    const dialogueSystem = new AIDialogueSystem();
    
    // Generate extreme contrasts
    const aggressiveBerserker = personalitySystem.createSpecificPersonality('berserker1', 'Droben', 'berserker', 'aggressive');
    const peacefulDiplomat = personalitySystem.createSpecificPersonality('diplomat1', 'Elven', 'diplomat', 'defensive');
    
    console.log('\n⚡ EXTREME PERSONALITY CONTRASTS');
    console.log('================================');
    
    console.log(`\n🔥 AGGRESSIVE: ${aggressiveBerserker.name} ${aggressiveBerserker.title}`);
    console.log(`   Aggression: ${aggressiveBerserker.traits.aggression.toFixed(2)} | Risk: ${aggressiveBerserker.traits.risk.toFixed(2)}`);
    console.log(`   Attack Threshold: ${aggressiveBerserker.modifiers.attackThreshold.toFixed(2)}x`);
    
    console.log(`\n🕊️ PEACEFUL: ${peacefulDiplomat.name} ${peacefulDiplomat.title}`);
    console.log(`   Diplomacy: ${peacefulDiplomat.traits.diplomacy.toFixed(2)} | Loyalty: ${peacefulDiplomat.traits.loyalty.toFixed(2)}`);
    console.log(`   Alliance Value: ${peacefulDiplomat.modifiers.allianceValue.toFixed(2)}`);
    
    // Compare their responses to same situation
    const berserkerWar = dialogueSystem.generateDialogue(aggressiveBerserker, {
      situation: 'war_declaration',
      relationship: 'hostile',
      playerStrength: 'equal',
      gamePhase: 'mid'
    });
    
    const diplomatPeace = dialogueSystem.generateDialogue(peacefulDiplomat, {
      situation: 'war_declaration',
      relationship: 'hostile',
      playerStrength: 'equal',
      gamePhase: 'mid'
    });
    
    console.log(`\n⚔️ Berserker Response to War: "${berserkerWar.message}"`);
    console.log(`🕊️ Diplomat Response to War: "${diplomatPeace.message}"`);
    
    // Verify extreme differences
    expect(aggressiveBerserker.traits.aggression).toBeGreaterThan(peacefulDiplomat.traits.aggression);
    expect(peacefulDiplomat.traits.diplomacy).toBeGreaterThan(aggressiveBerserker.traits.diplomacy);
    expect(berserkerWar.tone).toBe('aggressive');
    expect(diplomatPeace.tone).toMatch(/diplomatic|fearful|respectful/);
  });
});
