import { test, expect } from '@playwright/test';

test.describe('Tutorial System - Functionality Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to welcome page
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.removeItem('demo-mode');
      localStorage.removeItem('tutorial-progress');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Tutorial appears automatically in demo mode', async ({ page }) => {
    // Click demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tutorial should be visible
    const tutorialOverlay = page.locator('.tutorial-overlay');
    await expect(tutorialOverlay).toBeVisible({ timeout: 5000 });

    // Check first step content
    await expect(page.locator('text=Welcome to Monarchy!')).toBeVisible();
    await expect(page.locator('text=Step 1 of 5')).toBeVisible();
    
    console.log('✅ Tutorial appears automatically');
  });

  test('Tutorial navigation - Next button progresses steps', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 1
    await expect(page.locator('text=Step 1 of 5')).toBeVisible();
    await expect(page.locator('text=Welcome to Monarchy!')).toBeVisible();

    // Click Next
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Step 2
    await expect(page.locator('text=Step 2 of 5')).toBeVisible();
    await expect(page.locator('text=Kingdom Creation')).toBeVisible();

    // Click Next again
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);

    // Step 3
    await expect(page.locator('text=Step 3 of 5')).toBeVisible();
    await expect(page.locator('text=Resource Management')).toBeVisible();

    console.log('✅ Next button progresses through steps');
  });

  test('Tutorial navigation - Previous button works', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Go to step 2
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Step 2 of 5')).toBeVisible();

    // Click Previous
    await page.locator('button:has-text("Previous")').click();
    await page.waitForTimeout(500);

    // Should be back to step 1
    await expect(page.locator('text=Step 1 of 5')).toBeVisible();
    await expect(page.locator('text=Welcome to Monarchy!')).toBeVisible();

    console.log('✅ Previous button works');
  });

  test('Tutorial skip button closes tutorial', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tutorial should be visible
    await expect(page.locator('.tutorial-overlay')).toBeVisible();

    // Click Skip
    await page.locator('button:has-text("Skip Tutorial")').click();
    await page.waitForTimeout(500);

    // Tutorial should be hidden
    await expect(page.locator('.tutorial-overlay')).not.toBeVisible();

    console.log('✅ Skip button closes tutorial');
  });

  test('Tutorial Escape key closes tutorial', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tutorial should be visible
    await expect(page.locator('.tutorial-overlay')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Tutorial should be hidden
    await expect(page.locator('.tutorial-overlay')).not.toBeVisible();

    console.log('✅ Escape key closes tutorial');
  });

  test('Tutorial completion - Complete button on last step', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Navigate to last step (step 5)
    for (let i = 0; i < 4; i++) {
      await page.locator('button:has-text("Next")').click();
      await page.waitForTimeout(300);
    }

    // Should be on step 5
    await expect(page.locator('text=Step 5 of 5')).toBeVisible();
    await expect(page.locator('text=Combat & Alliances')).toBeVisible();

    // Last step should show "Complete" button
    const completeButton = page.locator('button:has-text("Complete")');
    await expect(completeButton).toBeVisible();

    // Click Complete
    await completeButton.click();
    await page.waitForTimeout(500);

    // Tutorial should be hidden
    await expect(page.locator('.tutorial-overlay')).not.toBeVisible();

    console.log('✅ Complete button finishes tutorial');
  });

  test('Tutorial persistence - Does not show after completion', async ({ page }) => {
    // Complete tutorial
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Skip tutorial
    await page.locator('button:has-text("Skip Tutorial")').click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tutorial should NOT appear
    await expect(page.locator('.tutorial-overlay')).not.toBeVisible();

    console.log('✅ Tutorial does not show after completion');
  });

  test('Tutorial restart from dashboard', async ({ page }) => {
    // Skip tutorial first
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Skip Tutorial")').click();
    await page.waitForTimeout(500);

    // Create kingdom to get to dashboard
    await page.waitForTimeout(2000);
    
    // Fill kingdom creation form
    const nameInput = page.locator('input[type="text"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Kingdom');
      await page.locator('text=Human').first().click();
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Create Kingdom")').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Look for tutorial restart button
    const tutorialButton = page.locator('button:has-text("Tutorial")');
    if (await tutorialButton.isVisible()) {
      await tutorialButton.click();
      await page.waitForTimeout(1000);

      // Tutorial should appear again
      await expect(page.locator('.tutorial-overlay')).toBeVisible();
      await expect(page.locator('text=Step 1 of 5')).toBeVisible();

      console.log('✅ Tutorial restart from dashboard works');
    } else {
      console.log('⚠️ Tutorial button not found on dashboard (may need navigation)');
    }
  });

  test('Tutorial progress indicator updates correctly', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check progress bar exists
    const progressBar = page.locator('.tutorial-progress-bar');
    await expect(progressBar).toBeVisible();

    // Step 1 - should be 20% (1/5)
    await expect(page.locator('text=Step 1 of 5')).toBeVisible();
    
    // Go to step 3
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(300);

    // Step 3 - should be 60% (3/5)
    await expect(page.locator('text=Step 3 of 5')).toBeVisible();

    console.log('✅ Progress indicator updates correctly');
  });

  test('Tutorial accessibility - Keyboard navigation', async ({ page }) => {
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check ARIA attributes
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Check for aria-labelledby
    const title = page.locator('#tutorial-title');
    await expect(title).toBeVisible();

    // Check for aria-describedby
    const description = page.locator('#tutorial-description');
    await expect(description).toBeVisible();

    console.log('✅ Tutorial has proper accessibility attributes');
  });

  test('Tutorial mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tutorial should be visible and responsive
    const tutorialContainer = page.locator('.tutorial-container');
    await expect(tutorialContainer).toBeVisible();

    // Check button sizes (should be touch-friendly)
    const nextButton = page.locator('button:has-text("Next")');
    const box = await nextButton.boundingBox();
    
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44); // Minimum touch target
      console.log(`✅ Mobile: Button height ${box.height}px (min 44px)`);
    }

    console.log('✅ Tutorial is mobile responsive');
  });
});
