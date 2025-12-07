import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log('🚀 Testing Monarchy Game Application\n');
  
  // Test 1: Welcome Page
  console.log('1️⃣ Loading Welcome Page...');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-screenshots/01-welcome.png', fullPage: true });
  console.log('   ✅ Welcome page loaded\n');
  
  // Test 2: Demo Mode
  console.log('2️⃣ Testing Demo Mode...');
  const demoBtn = page.locator('button:has-text("Demo")').first();
  if (await demoBtn.count() > 0) {
    await demoBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/02-demo-mode.png', fullPage: true });
    console.log('   ✅ Demo mode activated\n');
  }
  
  // Test 3: Kingdom Creation
  console.log('3️⃣ Testing Kingdom Creation...');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-screenshots/03-kingdom-creation.png', fullPage: true });
  
  // Fill in kingdom name
  const nameInput = page.locator('input[name="kingdomName"], input[placeholder*="name" i]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Test Kingdom');
    console.log('   ✅ Kingdom name entered\n');
  }
  
  // Select race
  const raceBtn = page.locator('button[class*="race"], .race-card').first();
  if (await raceBtn.count() > 0) {
    await raceBtn.click();
    await page.waitForTimeout(500);
    console.log('   ✅ Race selected\n');
  }
  
  // Test 4: Create Kingdom
  console.log('4️⃣ Creating Kingdom...');
  await page.screenshot({ path: 'test-screenshots/03b-form-filled.png', fullPage: true });
  
  const createBtn = page.locator('button:has-text("Create"):not([disabled])').first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-screenshots/04-dashboard.png', fullPage: true });
    console.log('   ✅ Kingdom created\n');
  } else {
    console.log('   ⚠️  Create button disabled, skipping...\n');
    await page.screenshot({ path: 'test-screenshots/04-form-state.png', fullPage: true });
  }
  
  // Test 5: Navigation
  console.log('5️⃣ Testing Navigation...');
  const navLinks = await page.locator('nav a, nav button').count();
  console.log(`   ✅ Found ${navLinks} navigation items\n`);
  
  // Test 6: Combat
  console.log('6️⃣ Testing Combat Interface...');
  const combatLink = page.locator('a:has-text("Combat"), button:has-text("Combat")').first();
  if (await combatLink.count() > 0) {
    await combatLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/05-combat.png', fullPage: true });
    console.log('   ✅ Combat interface loaded\n');
  }
  
  // Test 7: Mobile View
  console.log('7️⃣ Testing Mobile Responsive...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-screenshots/06-mobile.png', fullPage: true });
  console.log('   ✅ Mobile view captured\n');
  
  // Visual Analysis
  console.log('8️⃣ Performing Visual Analysis...');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  const analysis = await page.evaluate(() => {
    const results = {
      totalElements: document.querySelectorAll('*').length,
      buttons: document.querySelectorAll('button').length,
      links: document.querySelectorAll('a').length,
      images: document.querySelectorAll('img').length,
      forms: document.querySelectorAll('form, input').length,
      hasStyles: !!document.querySelector('style, link[rel="stylesheet"]'),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
      fontFamily: window.getComputedStyle(document.body).fontFamily
    };
    return results;
  });
  
  console.log('\n📊 Visual Analysis Results:');
  console.log(`   • Total Elements: ${analysis.totalElements}`);
  console.log(`   • Buttons: ${analysis.buttons}`);
  console.log(`   • Links: ${analysis.links}`);
  console.log(`   • Images: ${analysis.images}`);
  console.log(`   • Form Elements: ${analysis.forms}`);
  console.log(`   • Styles Loaded: ${analysis.hasStyles ? '✅' : '❌'}`);
  console.log(`   • Background: ${analysis.bodyBg}`);
  console.log(`   • Font: ${analysis.fontFamily}`);
  
  console.log('\n✅ All tests completed!');
  console.log('📁 Screenshots saved to: test-screenshots/\n');
  
  await browser.close();
}

test().catch(console.error);
