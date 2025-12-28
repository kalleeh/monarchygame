import { test, expect } from '@playwright/test';

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
    
    // Should show demo mode header
    await expect(page.locator('h1')).toContainText('Demo Mode');
  });

  test('Kingdom Creation - Race Selection and Customization', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for kingdom creation page to load
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    
    // Test all 10 races are available (use first() to avoid strict mode violations)
    const races = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
    for (const race of races) {
      await expect(page.locator(`h3:has-text("${race}")`).first()).toBeVisible();
    }
    
    // Test kingdom name input (use more specific selector)
    const kingdomNameInput = page.locator('input[type="text"], input:not([type])').first();
    await expect(kingdomNameInput).toBeVisible();
    await kingdomNameInput.fill('Test Kingdom');
    
    // Select a race (Elven)
    await page.locator('text=ElvenSkilled warriors and').click();
    
    // Verify race details update
    await expect(page.locator('h3:has-text("Elven Details")')).toBeVisible();
    await expect(page.locator('text=Elven Scouts')).toBeVisible();
    
    // Test create button is enabled
    const createButton = page.locator('button:has-text("Create Kingdom")');
    await expect(createButton).toBeEnabled();
  });

  test('Kingdom Creation - Form Validation', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for kingdom creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    
    // Test create button exists
    const createButton = page.locator('button:has-text("Create Kingdom")');
    await expect(createButton).toBeVisible();
    
    // Fill kingdom name
    const kingdomNameInput = page.locator('input[type="text"], input:not([type])').first();
    await kingdomNameInput.fill('Test Kingdom');
    
    // Select a race to complete the form
    await page.locator('text=Human').first().click();
    
    // Button should be enabled with valid form data
    await expect(createButton).toBeEnabled();
    
    // Verify form data is properly filled
    await expect(kingdomNameInput).toHaveValue('Test Kingdom');
    await expect(page.locator('h3:has-text("Human Details")')).toBeVisible();
  });

  test('Race Selection - All Races Display Correctly', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for kingdom creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    
    const raceData = [
      { name: 'Human', ability: 'Can send caravans to allies twice as often' },
      { name: 'Elven', ability: 'Can cast fog remotely onto other kingdoms in their faith' },
      { name: 'Goblin', ability: 'Cunning and numerous' },
      { name: 'Droben', ability: 'Fierce warriors' },
      { name: 'Vampire', ability: 'Dark masters' }
    ];
    
    for (const race of raceData) {
      // Click on race
      await page.locator(`text=${race.name}`).first().click();
      
      // Verify race details appear
      await expect(page.locator(`h3:has-text("${race.name} Details")`)).toBeVisible();
      
      // Verify starting resources are shown
      await expect(page.locator('text=Starting Resources:')).toBeVisible();
      await expect(page.locator('text=Gold:')).toBeVisible();
      await expect(page.locator('text=Population:')).toBeVisible();
      await expect(page.locator('text=Land:')).toBeVisible();
      await expect(page.locator('text=Turns:')).toBeVisible();
    }
  });

  test('Demo Mode - Header and Navigation', async ({ page }) => {
    // Enter demo mode
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Test demo mode header
    await expect(page.locator('h1:has-text("Demo Mode")')).toBeVisible();
    await expect(page.locator('text=Demo Player')).toBeVisible();
    
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
    
    // Wait for kingdom creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    
    // Fill out form (use more specific selector)
    await page.locator('input[type="text"], input:not([type])').first().fill('Test Kingdom');
    await page.locator('text=Human').first().click();
    
    // Try to create kingdom (will fail due to backend issues)
    await page.locator('button:has-text("Create Kingdom")').click();
    
    // Handle the error dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Failed to create kingdom');
      await dialog.accept();
    });
    
    // Verify we're still on the creation page
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible();
  });

  test('Accessibility - Keyboard Navigation and ARIA', async ({ page }) => {
    // Test keyboard navigation on welcome page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Demo mode button should be focusable
    const demoButton = page.locator('text=🎮 Demo Mode');
    await expect(demoButton).toBeFocused();
    
    // Enter demo mode with keyboard
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Test form accessibility
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    
    // Test input is accessible (use more specific selector)
    const textInput = page.locator('input[type="text"], input:not([type])').first();
    await expect(textInput).toBeVisible();
    
    // Test race buttons are accessible
    const raceButtons = page.locator('h3:has-text("Human")').first();
    await expect(raceButtons).toBeVisible();
  });

  test('UI Components - Visual Elements and Styling', async ({ page }) => {
    // Test welcome page visual elements
    await expect(page.locator('h1')).toContainText('Monarchy');
    
    // Test race preview section
    await expect(page.locator('text=Choose Your Destiny')).toBeVisible();
    
    // Test all race buttons in preview
    const previewRaces = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
    for (const race of previewRaces) {
      await expect(page.locator(`button:has-text("${race}")`)).toBeVisible();
    }
    
    // Test game features section
    await expect(page.locator('text=Game Features')).toBeVisible();
    await expect(page.locator('text=Build Your Kingdom').first()).toBeVisible();
    await expect(page.locator('text=Epic Combat System')).toBeVisible();
    
    // Enter demo mode to test game UI
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    // Test demo mode styling
    await expect(page.locator('h1:has-text("Demo Mode")')).toBeVisible();
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
  });
});
