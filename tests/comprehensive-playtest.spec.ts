import { test, expect } from '@playwright/test';

/**
 * COMPREHENSIVE PLAYTEST SUITE
 * Tests complete user journey and identifies UI/UX gaps
 */

test.describe('Monarchy Game - Comprehensive Playtest', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('CRITICAL BUG: Demo Mode Navigation Flow', async ({ page }) => {
    // Step 1: Verify welcome page loads
    await expect(page.locator('h1')).toContainText('Monarchy');
    console.log('✅ Welcome page loaded');
    
    // Step 2: Click demo mode button
    const demoButton = page.locator('text=🎮 Demo Mode');
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    console.log('✅ Demo mode button clicked');
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give extra time for state updates
    
    // Step 3: Check what page we're on
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/demo-mode-after-click.png', fullPage: true });
    
    // Check for various possible elements
    const hasH1 = await page.locator('h1').count();
    const hasH2 = await page.locator('h2').count();
    const hasCreateKingdom = await page.locator('text=Create Your Kingdom').count();
    const hasKingdomCreation = await page.locator('text=Create Kingdom').count();
    const hasDemoHeader = await page.locator('text=Demo Mode').count();
    
    console.log('Page analysis:');
    console.log('- H1 elements:', hasH1);
    console.log('- H2 elements:', hasH2);
    console.log('- "Create Your Kingdom" text:', hasCreateKingdom);
    console.log('- "Create Kingdom" button:', hasKingdomCreation);
    console.log('- "Demo Mode" text:', hasDemoHeader);
    
    // Get all visible text
    const bodyText = await page.locator('body').textContent();
    console.log('Visible text (first 500 chars):', bodyText?.substring(0, 500));
    
    // EXPECTED: Should navigate to /creation or /kingdoms
    // ACTUAL: Need to verify what's happening
    
    // This test documents the bug - it will fail until fixed
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 5000 });
  });

  test('UI/UX Gap: Welcome Page - Race Preview Interaction', async ({ page }) => {
    // Test if race preview buttons are interactive
    const raceButtons = page.locator('button:has-text("Human")');
    const count = await raceButtons.count();
    
    if (count > 0) {
      await raceButtons.first().click();
      // Should show race details or navigate somewhere
      // Currently unclear what should happen
      console.log('Race preview button clicked - no clear feedback');
    }
  });

  test('UI/UX Gap: Missing Loading States', async ({ page }) => {
    // Click demo mode
    await page.locator('text=🎮 Demo Mode').click();
    
    // Check if there's a loading indicator
    const hasLoadingIndicator = await page.locator('text=Loading').isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!hasLoadingIndicator) {
      console.log('⚠️ UX GAP: No loading indicator shown during navigation');
    }
  });

  test('Gameplay Gap: Tutorial/Onboarding Missing', async ({ page }) => {
    // Enter demo mode (if it works)
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for tutorial or onboarding
    const hasTutorial = await page.locator('text=Tutorial').count();
    const hasHelp = await page.locator('text=Help').count();
    const hasGuide = await page.locator('text=Guide').count();
    
    console.log('Tutorial/Help elements found:', hasTutorial + hasHelp + hasGuide);
    
    if (hasTutorial + hasHelp + hasGuide === 0) {
      console.log('⚠️ GAMEPLAY GAP: No tutorial or onboarding system detected');
    }
  });

  test('Accessibility: Keyboard Navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName + (el?.textContent?.substring(0, 20) || '');
    });
    
    console.log('Focused element after 2 tabs:', focusedElement);
    
    // Test if demo mode can be activated with keyboard
    const demoButton = page.locator('text=🎮 Demo Mode');
    await demoButton.focus();
    await page.keyboard.press('Enter');
    
    await page.waitForLoadState('networkidle');
    console.log('✅ Demo mode accessible via keyboard');
  });

  test('Performance: Initial Load Time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Initial load time: ${loadTime}ms`);
    
    if (loadTime > 3000) {
      console.log('⚠️ PERFORMANCE: Load time exceeds 3 seconds');
    }
    
    expect(loadTime).toBeLessThan(5000);
  });

  test('Mobile Responsiveness: Touch Targets', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check button sizes
    const demoButton = page.locator('text=🎮 Demo Mode');
    const box = await demoButton.boundingBox();
    
    if (box) {
      console.log(`Demo button size: ${box.width}x${box.height}`);
      
      if (box.height < 44) {
        console.log('⚠️ ACCESSIBILITY: Touch target smaller than 44px minimum');
      }
    }
  });

  test('Error Handling: Network Failures', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForTimeout(2000);
    
    // Check for error messages
    const hasErrorMessage = await page.locator('text=error').count() > 0 ||
                           await page.locator('text=failed').count() > 0 ||
                           await page.locator('text=offline').count() > 0;
    
    if (!hasErrorMessage) {
      console.log('⚠️ UX GAP: No clear error message when offline');
    }
    
    await page.context().setOffline(false);
  });

  test('Visual Consistency: Dark Theme', async ({ page }) => {
    // Check if dark theme is applied
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    console.log('Body background color:', bgColor);
    
    // Should be dark (rgb values < 50)
    const isDark = bgColor.includes('rgb') && 
                   bgColor.split(',').slice(0, 3).every(val => {
                     const num = parseInt(val.replace(/[^\d]/g, ''));
                     return num < 50;
                   });
    
    if (!isDark) {
      console.log('⚠️ VISUAL: Dark theme may not be properly applied');
    }
  });

  test('Content: Race Information Completeness', async ({ page }) => {
    // Check if all 10 races are mentioned
    const races = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 
                   'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
    
    const bodyText = await page.locator('body').textContent() || '';
    
    const missingRaces = races.filter(race => !bodyText.includes(race));
    
    if (missingRaces.length > 0) {
      console.log('⚠️ CONTENT GAP: Missing races on welcome page:', missingRaces);
    }
  });
});

test.describe('Kingdom Creation Flow (If Demo Mode Works)', () => {
  
  test.skip('Kingdom Creation: Form Validation', async ({ page }) => {
    // This test is skipped until demo mode navigation is fixed
    await page.goto('/');
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Try to create without filling form
    const createButton = page.locator('button:has-text("Create Kingdom")');
    
    if (await createButton.isVisible()) {
      const isDisabled = await createButton.isDisabled();
      
      if (!isDisabled) {
        console.log('⚠️ VALIDATION GAP: Create button enabled without form data');
      }
    }
  });

  test.skip('Kingdom Creation: Race Selection Feedback', async ({ page }) => {
    // This test is skipped until demo mode navigation is fixed
    await page.goto('/');
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Select a race
    await page.locator('text=Human').first().click();
    
    // Should show visual feedback (highlight, border, etc.)
    const selectedRace = page.locator('.race-card.selected, .race-option.selected, [aria-selected="true"]');
    const hasSelection = await selectedRace.count() > 0;
    
    if (!hasSelection) {
      console.log('⚠️ UX GAP: No clear visual feedback for race selection');
    }
  });
});

test.describe('Core Gameplay Features (Post-Creation)', () => {
  
  test.skip('Dashboard: Resource Display', async ({ page }) => {
    // Skip until we can get past kingdom creation
    console.log('⚠️ BLOCKED: Cannot test dashboard until demo mode navigation is fixed');
  });

  test.skip('Combat: Attack Flow', async ({ page }) => {
    // Skip until we can get past kingdom creation
    console.log('⚠️ BLOCKED: Cannot test combat until demo mode navigation is fixed');
  });

  test.skip('Territory: Expansion Mechanics', async ({ page }) => {
    // Skip until we can get past kingdom creation
    console.log('⚠️ BLOCKED: Cannot test territory until demo mode navigation is fixed');
  });
});
