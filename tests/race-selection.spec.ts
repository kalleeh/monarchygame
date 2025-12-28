import { test, expect } from '@playwright/test';

test.describe('Race Selection - Bug Fix Verification', () => {
  
  test('Creates Elven kingdom with correct race and special ability', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Skip tutorial
    await page.locator('button:has-text("Skip Tutorial")').click();
    await page.waitForTimeout(500);

    // Select Elven race
    const elvenCard = page.locator('.race-card').filter({ hasText: 'Elven' });
    await elvenCard.click();
    await page.waitForTimeout(500);

    // Enter kingdom name
    await page.locator('input[type="text"]').first().fill('Elven Test Kingdom');
    await page.waitForTimeout(300);

    // Create kingdom
    await page.locator('button:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the dashboard
    const url = page.url();
    console.log('Current URL:', url);
    expect(url).toContain('/kingdom/');

    // Check kingdom name
    const kingdomName = await page.locator('h1').first().textContent();
    console.log('Kingdom name:', kingdomName);
    expect(kingdomName).toContain('Elven Test Kingdom');

    // Check special ability text
    const specialAbility = page.locator('.special-ability');
    const abilityText = await specialAbility.textContent();
    console.log('Special ability:', abilityText);

    // Should contain Elven special ability
    expect(abilityText).toContain('Special:');
    expect(abilityText).toContain('fog'); // Elven ability mentions fog

    // Take screenshot
    await page.screenshot({ path: 'test-results/elven-kingdom-created.png', fullPage: true });
    console.log('✅ Elven kingdom created successfully with correct special ability');
  });

  test('Creates Human kingdom with correct special ability', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Skip tutorial
    await page.locator('button:has-text("Skip Tutorial")').click();
    await page.waitForTimeout(500);

    // Select Human race (already selected by default)
    const humanCard = page.locator('.race-card').filter({ hasText: 'Human' });
    await humanCard.click();
    await page.waitForTimeout(500);

    // Enter kingdom name
    await page.locator('input[type="text"]').first().fill('Human Test Kingdom');
    await page.waitForTimeout(300);

    // Create kingdom
    await page.locator('button:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check special ability
    const specialAbility = page.locator('.special-ability');
    const abilityText = await specialAbility.textContent();
    console.log('Special ability:', abilityText);

    // Should contain Human special ability
    expect(abilityText).toContain('Special:');
    expect(abilityText).toContain('caravan'); // Human ability mentions caravans

    console.log('✅ Human kingdom created successfully with correct special ability');
  });
});
