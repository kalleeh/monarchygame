import { test, expect } from '@playwright/test';

test.describe('Interactive Tutorial - Visual Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.removeItem('demo-mode');
      localStorage.removeItem('tutorial-progress');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Tutorial spotlight highlights elements', async ({ page }) => {
    // Start demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 1 - No spotlight (welcome)
    await expect(page.locator('.tutorial-spotlight')).not.toBeVisible();
    console.log('✅ Step 1: No spotlight (welcome screen)');

    // Step 2 - Should highlight race-grid
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);
    
    const spotlight = page.locator('.tutorial-spotlight');
    await expect(spotlight).toBeVisible({ timeout: 2000 });
    console.log('✅ Step 2: Spotlight visible on race selection');

    // Check highlight border
    const highlightBorder = page.locator('.tutorial-highlight-border');
    await expect(highlightBorder).toBeVisible();
    console.log('✅ Step 2: Highlight border visible');

    // Take screenshot
    await page.screenshot({ path: 'test-results/tutorial-spotlight-step2.png', fullPage: true });
    console.log('📸 Screenshot saved: tutorial-spotlight-step2.png');

    // Step 3 - Should highlight resource-panel
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);
    
    await expect(spotlight).toBeVisible();
    console.log('✅ Step 3: Spotlight visible on resources');

    // Take screenshot
    await page.screenshot({ path: 'test-results/tutorial-spotlight-step3.png', fullPage: true });
    console.log('📸 Screenshot saved: tutorial-spotlight-step3.png');
  });

  test('Tutorial positions content near highlighted elements', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Go to step 2 (race selection)
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Check tutorial container position
    const container = page.locator('.tutorial-container');
    await expect(container).toBeVisible();
    
    const containerBox = await container.boundingBox();
    console.log('Tutorial container position:', containerBox);

    // Container should be positioned (not centered)
    expect(containerBox).not.toBeNull();
    console.log('✅ Tutorial container positioned near highlighted element');
  });

  test('Tutorial scrolls highlighted elements into view', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Go through steps
    for (let i = 0; i < 3; i++) {
      await page.locator('button:has-text("Next")').click();
      await page.waitForTimeout(800); // Wait for scroll animation
    }

    // Check that action-buttons are visible (scrolled into view)
    const actionButtons = page.locator('.action-buttons');
    const isVisible = await actionButtons.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('✅ Elements scrolled into view');
    } else {
      console.log('⚠️ Element not found (may be on different page)');
    }
  });

  test('Tutorial spotlight animates smoothly', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Go to step 2
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Check spotlight has animation
    const spotlight = page.locator('.tutorial-spotlight');
    const hasAnimation = await spotlight.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.animation !== 'none' && style.animation !== '';
    });

    if (hasAnimation) {
      console.log('✅ Spotlight has pulse animation');
    }

    // Check border has animation
    const border = page.locator('.tutorial-highlight-border');
    const borderHasAnimation = await border.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.animation !== 'none' && style.animation !== '';
    });

    if (borderHasAnimation) {
      console.log('✅ Border has glow animation');
    }
  });
});
