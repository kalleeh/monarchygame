import { test, expect } from '@playwright/test';

test.describe('Monarchy Game - MCP Interactive Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('Complete Game Flow - Welcome to Kingdom Management', async ({ page }) => {
    // Test welcome page and demo mode
    await expect(page.locator('h1')).toContainText('Monarchy');
    
    const demoButton = page.locator('text=🎮 Demo Mode');
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    await page.waitForLoadState('networkidle');

    // Kingdom creation flow
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    
    const kingdomNameInput = page.locator('input[type="text"]').first();
    await kingdomNameInput.fill('MCP Test Kingdom');
    
    await page.locator('text=ElvenSkilled warriors').click();
    await expect(page.locator('h3:has-text("Elven Details")')).toBeVisible();
    
    const createButton = page.locator('button:has-text("Create Kingdom")');
    await createButton.click();
    await page.waitForLoadState('networkidle');

    // Verify kingdom dashboard
    await expect(page.locator('h1:has-text("MCP Test Kingdom")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Gold')).toBeVisible();
    await expect(page.locator('text=Food')).toBeVisible();
  });

  test('Territory and Building System', async ({ page }) => {
    // Setup kingdom
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    const kingdomNameInput = page.locator('input[type="text"]').first();
    await kingdomNameInput.fill('Territory Test');
    await page.locator('text=Human').click();
    await page.locator('button:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // Test territory management
    await page.locator('text=Territory').click();
    await page.waitForLoadState('networkidle');
    
    const buildingTypes = ['Homes', 'Farms', 'Barracks', 'Guilds'];
    for (const building of buildingTypes) {
      await expect(page.locator(`text=${building}`)).toBeVisible();
    }
  });

  test('Combat System Interface', async ({ page }) => {
    // Setup with combat-focused race
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    const kingdomNameInput = page.locator('input[type="text"]').first();
    await kingdomNameInput.fill('Combat Test');
    await page.locator('text=Goblin').click();
    await page.locator('button:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // Test combat interface
    await page.locator('text=Combat').click();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=Army Status')).toBeVisible();
    await expect(page.locator('text=Attack')).toBeVisible();
  });

  test('Magic System and Spells', async ({ page }) => {
    // Setup with magic race
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    const kingdomNameInput = page.locator('input[type="text"]').first();
    await kingdomNameInput.fill('Magic Test');
    await page.locator('text=Sidhe').click();
    await page.locator('button:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // Test magic interface
    await page.locator('text=Magic').click();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=Mana')).toBeVisible();
    await expect(page.locator('text=Spells')).toBeVisible();
  });

  test('Alliance and Chat System', async ({ page }) => {
    // Setup kingdom
    await page.locator('text=🎮 Demo Mode').click();
    await page.waitForLoadState('networkidle');
    
    const kingdomNameInput = page.locator('input[type="text"]').first();
    await kingdomNameInput.fill('Alliance Test');
    await page.locator('text=Human').click();
    await page.locator('button:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // Test alliance interface
    await page.locator('text=Alliance').click();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=Alliance Status')).toBeVisible();
  });
});
