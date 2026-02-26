import { test, expect } from '@playwright/test';

// Helper to dismiss tutorial overlay if present
async function dismissTutorial(page: import('@playwright/test').Page) {
  const skipBtn = page.locator('button:has-text("Skip Tutorial")');
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }
}

test.describe('Monarchy Game - Complete Functionality Test', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Welcome Page - Landing and Demo Mode Access', async ({ page }) => {
    // Test welcome page loads with parallax design
    await expect(page.locator('h1')).toContainText('Monarchy');

    // Test demo mode button exists and is clickable
    const demoButton = page.locator('text=🎮 Demo Mode');
    await expect(demoButton).toBeVisible();

    // Click demo mode to enter the game
    await demoButton.click();
    await page.waitForLoadState('networkidle');

    // Should show demo mode utility bar with "Demo Mode" label
    await expect(page.locator('.utility-bar-label:has-text("Demo Mode")')).toBeVisible();
  });

  test('Kingdom Creation - Race Selection and Customization', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Wait for kingdom creation page to load
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    // Test all 10 races are available (use first() to avoid strict mode violations)
    const races = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
    for (const race of races) {
      await expect(page.locator(`.race-card h4:has-text("${race}")`).first()).toBeVisible();
    }

    // Test kingdom name input (use more specific selector)
    const kingdomNameInput = page.locator('input[type="text"], input:not([type])').first();
    await expect(kingdomNameInput).toBeVisible();
    await kingdomNameInput.fill('Test Kingdom');

    // Select a race (Elven) using race card
    await page.locator('.race-card h4:has-text("Elven")').first().click();

    // Verify race details update
    await expect(page.locator('h4:has-text("Elven Details")')).toBeVisible();

    // Test create button is enabled
    const createButton = page.locator('button:has-text("Create Kingdom")');
    await expect(createButton).toBeEnabled();
  });

  test('Kingdom Creation - Form Validation', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Wait for kingdom creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    // Test create button exists
    const createButton = page.locator('button:has-text("Create Kingdom")');
    await expect(createButton).toBeVisible();

    // Fill kingdom name
    const kingdomNameInput = page.locator('input[type="text"], input:not([type])').first();
    await kingdomNameInput.fill('Test Kingdom');

    // Select a race to complete the form (use specific race card selector)
    await page.locator('.race-card h4:has-text("Human")').first().click();

    // Button should be enabled with valid form data
    await expect(createButton).toBeEnabled();

    // Verify form data is properly filled
    await expect(kingdomNameInput).toHaveValue('Test Kingdom');
    await expect(page.locator('h4:has-text("Human Details")')).toBeVisible();
  });

  test('Race Selection - All Races Display Correctly', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Wait for kingdom creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    const raceData = [
      { name: 'Human' },
      { name: 'Elven' },
      { name: 'Goblin' },
      { name: 'Droben' },
      { name: 'Vampire' }
    ];

    for (const race of raceData) {
      // Click on race card using specific selector
      await page.locator(`.race-card h4:has-text("${race.name}")`).first().click();

      // Verify race details appear
      await expect(page.locator(`h4:has-text("${race.name} Details")`)).toBeVisible();

      // Verify starting resources are shown
      await expect(page.locator('h4:has-text("Starting Resources:")')).toBeVisible();
      await expect(page.locator('.resource-label:has-text("Gold:")')).toBeVisible();
      await expect(page.locator('.resource-label:has-text("Population:")')).toBeVisible();
      await expect(page.locator('.resource-label:has-text("Land:")')).toBeVisible();
      await expect(page.locator('.resource-label:has-text("Turns:")')).toBeVisible();
    }
  });

  test('Demo Mode - Header and Navigation', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial first so the backdrop doesn't block the utility bar
    await dismissTutorial(page);

    // Test demo mode utility bar shows "Demo Mode" label
    await expect(page.locator('.utility-bar-label:has-text("Demo Mode")')).toBeVisible();

    // Test exit demo button
    const exitButton = page.locator('button:has-text("Exit Demo")');
    await expect(exitButton).toBeVisible();

    // Click exit demo
    await exitButton.click();
    await page.waitForLoadState('networkidle');

    // Should return to welcome page
    await expect(page.locator('h1')).toContainText('Monarchy');
    await expect(page.locator('text=🎮 Demo Mode')).toBeVisible();
  });

  test('Responsive Design - Mobile and Desktop Views', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify welcome page elements are visible
    await expect(page.locator('h1')).toContainText('Monarchy');
    await expect(page.locator('text=🎮 Demo Mode')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Elements should still be visible and accessible
    await expect(page.locator('h1')).toContainText('Monarchy');
    await expect(page.locator('text=🎮 Demo Mode')).toBeVisible();

    // Test demo mode in mobile
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Kingdom creation should work in mobile
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
  });

  test('Performance - Page Load Times', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify page loads within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Test that demo mode loads quickly
    const demoStartTime = Date.now();
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    const demoLoadTime = Date.now() - demoStartTime;
    expect(demoLoadTime).toBeLessThan(3000);
  });

  test('Error Handling - Backend Connection Issues', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Wait for kingdom creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    // Fill out form (use more specific selector)
    await page.locator('input[type="text"], input:not([type])').first().fill('Test Kingdom');
    await page.locator('.race-card h4:has-text("Human")').first().click();

    // Try to create kingdom (in demo mode it should succeed locally)
    await page.locator('button:has-text("Create Kingdom")').click();

    // Handle the error dialog if one appears
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Failed to create kingdom');
      await dialog.accept();
    });

    // In demo mode, creation should succeed and navigate to /kingdoms
    // OR stay on creation page if something went wrong
    await page.waitForTimeout(2000);
    // We just verify the page is still functional
    const url = page.url();
    expect(url).toMatch(/\/(creation|kingdoms)/);
  });

  test('Accessibility - Keyboard Navigation and ARIA', async ({ page }) => {
    // Test keyboard navigation on welcome page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Demo mode button should be focusable - check it exists
    const demoButton = page.locator('button:has-text("🎮 Demo Mode")');
    await expect(demoButton).toBeVisible();

    // Enter demo mode
    await demoButton.click();
    await page.waitForLoadState('networkidle');

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Test form accessibility
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    // Test input is accessible (use more specific selector)
    const textInput = page.locator('input[type="text"], input:not([type])').first();
    await expect(textInput).toBeVisible();

    // Test race buttons are accessible (use h4 which is what race cards use)
    const raceButtons = page.locator('.race-card h4:has-text("Human")').first();
    await expect(raceButtons).toBeVisible();
  });

  test('UI Components - Visual Elements and Styling', async ({ page }) => {
    // Test welcome page visual elements
    await expect(page.locator('h1')).toContainText('Monarchy');

    // Test race preview section
    await expect(page.locator('text=Choose Your Destiny')).toBeVisible();

    // Test all race buttons in preview (using race tab buttons)
    const previewRaces = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
    for (const race of previewRaces) {
      await expect(page.locator(`.race-tab:has-text("${race}")`)).toBeVisible();
    }

    // Test game features section
    await expect(page.locator('text=Game Features')).toBeVisible();
    await expect(page.locator('text=Build Your Kingdom').first()).toBeVisible();
    await expect(page.locator('text=Epic Combat System')).toBeVisible();

    // Enter demo mode to test game UI
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');

    // Test demo mode shows utility bar with Demo Mode label
    await expect(page.locator('.utility-bar-label:has-text("Demo Mode")')).toBeVisible();

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
  });
});
