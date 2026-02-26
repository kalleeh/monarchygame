import { test } from '@playwright/test';

test('Check special ability display', async ({ page }) => {
  // Clear and go to demo mode with tutorial skipped
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('tutorial-progress', JSON.stringify({ currentStep: 0, completed: true, skipped: true, totalSteps: 5 }));
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  await page.locator('text=🎮 Demo Mode').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Dismiss tutorial if it appears
  const skipBtn = page.locator('button:has-text("Skip Tutorial")');
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }

  // Click on Human race card
  const humanCard = page.locator('.race-card').filter({ hasText: 'Human' }).first();
  await humanCard.click();
  await page.waitForTimeout(500);

  // Get race details
  const raceDetails = page.locator('.race-details');
  const isVisible = await raceDetails.isVisible();
  
  if (isVisible) {
    const text = await raceDetails.textContent();
    console.log('\n=== Race Details Content ===');
    console.log(text);
    console.log('===========================\n');
  } else {
    console.log('❌ Race details not visible');
  }

  // Take screenshot
  await page.screenshot({ path: 'test-results/special-ability-check.png', fullPage: true });
  console.log('Screenshot saved to: test-results/special-ability-check.png');
});
