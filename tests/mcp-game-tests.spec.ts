import { test, expect } from '@playwright/test';

// Helper to dismiss tutorial overlay if present
async function dismissTutorial(page: import('@playwright/test').Page) {
  const skipBtn = page.locator('button:has-text("Skip Tutorial")');
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }
}

// Helper to set up a kingdom and enter its dashboard
async function setupKingdomDashboard(
  page: import('@playwright/test').Page,
  name: string,
  race: string
) {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  await page.locator('text=🎮 Demo Mode').click();
  await page.waitForLoadState('networkidle');

  // Dismiss tutorial if it appears
  await dismissTutorial(page);

  await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

  const kingdomNameInput = page.locator('input[type="text"]').first();
  await kingdomNameInput.fill(name);
  await page.locator(`.race-card h4:has-text("${race}")`).first().click();
  await page.locator('button:has-text("Create Kingdom")').click();
  await page.waitForLoadState('networkidle');

  // Enter the created kingdom
  const enterBtn = page.locator('.kingdom-card', { hasText: name }).locator('button:has-text("Enter Kingdom")');
  await expect(enterBtn).toBeVisible({ timeout: 10000 });
  await enterBtn.click();
  await page.waitForTimeout(3000);

  // Dismiss dashboard tutorial
  await dismissTutorial(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

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

    // Dismiss tutorial if it appears
    await dismissTutorial(page);

    // Kingdom creation flow
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    const kingdomNameInput = page.locator('input[type="text"]').first();
    await kingdomNameInput.fill('MCP Test Kingdom');

    await page.locator('.race-card h4:has-text("Elven")').first().click();
    await expect(page.locator('h4:has-text("Elven Details")')).toBeVisible();

    const createButton = page.locator('button:has-text("Create Kingdom")');
    await createButton.click();
    await page.waitForLoadState('networkidle');

    // We land on /kingdoms - enter the kingdom
    const enterBtn = page.locator('.kingdom-card', { hasText: 'MCP Test Kingdom' }).locator('button:has-text("Enter Kingdom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();
    await page.waitForTimeout(3000);

    // Dismiss dashboard tutorial
    await dismissTutorial(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify kingdom dashboard - check for kingdom name in heading
    await expect(page.locator('h1:has-text("MCP Test Kingdom")')).toBeVisible({ timeout: 15000 });
    // Check for resource labels (use specific class to avoid strict mode violation)
    await expect(page.locator('.resource-label:has-text("Gold")').first()).toBeVisible();
  });

  test('Territory and Building System', async ({ page }) => {
    await setupKingdomDashboard(page, 'Territory Test', 'Human');

    // Test territory navigation using exact button text
    await page.locator('button:has-text("Manage Territories")').first().click();
    await page.waitForLoadState('networkidle');

    // Territory page should be visible
    await expect(page).toHaveURL(/\/territories/);
  });

  test('Combat System Interface', async ({ page }) => {
    await setupKingdomDashboard(page, 'Combat Test', 'Goblin');

    // Test combat interface using exact button text
    await page.locator('button:has-text("Combat Operations")').click();
    await page.waitForLoadState('networkidle');

    // Combat page should be visible
    await expect(page).toHaveURL(/\/combat/);
    await expect(page.locator('h2:has-text("Battle Statistics")')).toBeVisible({ timeout: 5000 });
  });

  test('Magic System and Spells', async ({ page }) => {
    await setupKingdomDashboard(page, 'Magic Test', 'Sidhe');

    // Test magic interface using exact button text
    await page.locator('button:has-text("Cast Spells")').click();
    await page.waitForLoadState('networkidle');

    // Magic page should be visible
    await expect(page).toHaveURL(/\/magic/);
    await expect(page.locator('text=Elan').first()).toBeVisible({ timeout: 5000 });
  });

  test('Alliance and Chat System', async ({ page }) => {
    await setupKingdomDashboard(page, 'Alliance Test', 'Human');

    // Test alliance interface using exact button text
    await page.locator('button:has-text("Alliance Management")').click();
    await page.waitForLoadState('networkidle');

    // Alliance page should be visible
    await expect(page).toHaveURL(/\/alliance/);
    await expect(page.locator('text=Guild Management').first()).toBeVisible({ timeout: 5000 });
  });
});
