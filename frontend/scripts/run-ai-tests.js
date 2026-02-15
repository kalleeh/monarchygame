#!/usr/bin/env node

import { runAITests } from '../src/ai/index.js';

async function main() {
  const testType = (process.argv[2] || 'quick');
  
  console.log('🎮 Monarchy Game AI Balance Testing System');
  console.log('==========================================\n');
  
  try {
    await runAITests(testType);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();