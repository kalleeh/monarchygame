/**
 * Demo Mode - Core Gameplay Tests
 *
 * Covers the primary user journey through demo mode:
 * welcome page → kingdom creation → dashboard → sub-pages.
 *
 * Key observations from the source code that drive the selectors used here:
 *
 * WelcomePage renders a button with text "🎮 Demo Mode".  Clicking it sets
 * localStorage "demo-mode" = "true" and calls onGetStarted().  App.tsx then
 * navigates to /creation (no saved kingdoms) or /kingdoms (saved kingdoms).
 *
 * After kingdom creation App.tsx navigates to /kingdoms and renders a
 * KingdomList.  Each kingdom card has an "Enter Kingdom" button that goes to
 * /kingdom/:id, which renders KingdomDashboard.
 *
 * KingdomDashboard shows:
 *   - A header region (TopNavigation) with kingdom.name
 *   - "Resources" section with Gold / Population / Land / Turns labels
 *   - "Kingdom Actions" section with buttons: Combat Operations, Trade, …
 *
 * The tutorial appears automatically on first demo-mode entry
 * (TutorialOverlay in App.tsx + Tutorial inside KingdomDashboard).
 * We bypass it using the "Skip Tutorial" button that the tutorial renders.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared helper – enters demo mode from the welcome page and skips any
// tutorial overlay that may appear.
// ---------------------------------------------------------------------------
async function enterDemoMode(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Clear demo state so each test starts fresh.
  await page.evaluate(() => {
    localStorage.removeItem('demo-mode');
    localStorage.removeItem('demo-kingdoms');
    localStorage.removeItem('tutorial-progress');
    // Clear any per-kingdom keys
    Object.keys(localStorage)
      .filter(k => k.startsWith('kingdom-'))
      .forEach(k => localStorage.removeItem(k));
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator('button:has-text("🎮 Demo Mode")').click();
  await page.waitForLoadState('networkidle');

  // Dismiss tutorial overlay — wait up to 5 seconds for it to appear.
  try {
    await page.locator('button:has-text("Skip Tutorial")').click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch { /* no tutorial, continue */ }
}

// ---------------------------------------------------------------------------
// Shared helper – creates a kingdom and navigates to its dashboard.
// Assumes the browser is already on /creation (after enterDemoMode).
// ---------------------------------------------------------------------------
async function createKingdomAndEnterDashboard(
  page: import('@playwright/test').Page,
  name = 'Playwright Kingdom',
  raceText = 'Human',
) {
  await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

  // Fill name
  await page.locator('#kingdom-name').fill(name);

  // Select race – the race card is a div[role="button"] containing an h4 with the race name.
  await page.locator(`.race-card h4:has-text("${raceText}")`).first().click();

  // Submit
  await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
  await page.waitForLoadState('networkidle');

  // We land on /kingdoms – click "Enter Kingdom" for the kingdom we just created.
  const enterBtn = page.locator('.kingdom-card', { hasText: name }).locator('button:has-text("Enter Kingdom")');
  await expect(enterBtn).toBeVisible({ timeout: 10000 });
  await enterBtn.click();
  await page.waitForTimeout(3000);

  // Dismiss dashboard tutorial — it uses a "×" close button or ESC key.
  try {
    await page.locator('button:has-text("Skip Tutorial")').click({ timeout: 2000 });
    await page.waitForTimeout(300);
  } catch { /* no skip tutorial button */ }
  try {
    const closeBtn = page.locator('button[aria-label*="lose"], button:has-text("×"), button:has-text("✕")').first();
    if (await closeBtn.isVisible({ timeout: 2000 })) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  } catch { /* no close button */ }
  // ESC key also dismisses the tutorial
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// ===========================================================================

test.describe('Demo Mode - Core Gameplay', () => {

  test('can start demo mode from welcome page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Demo Mode button exists on the welcome page hero section.
    const demoButton = page.locator('button:has-text("🎮 Demo Mode")');
    await expect(demoButton).toBeVisible();

    await demoButton.click();
    await page.waitForLoadState('networkidle');

    // Should land on /creation (no saved kingdoms) or /kingdoms.
    // Verify we navigated away from the welcome page.
    await expect(page).not.toHaveURL('/');
  });

  test('demo mode header shows player name and Exit Demo button', async ({ page }) => {
    await enterDemoMode(page);

    // App.tsx renders these in the header when demoMode === true.
    await expect(page.locator('text=Demo Player')).toBeVisible();
    await expect(page.locator('button:has-text("Exit Demo")')).toBeVisible();
  });

  test('exit demo returns to welcome page', async ({ page }) => {
    await enterDemoMode(page);

    await page.locator('button:has-text("Exit Demo")').click();
    await page.waitForLoadState('networkidle');

    // Back to welcome page.
    await expect(page.locator('h1')).toContainText('Monarchy');
    await expect(page.locator('button:has-text("🎮 Demo Mode")')).toBeVisible();
  });

  test('can create a kingdom with Human race and reach the kingdoms list', async ({ page }) => {
    await enterDemoMode(page);
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    await page.locator('#kingdom-name').fill('My Test Kingdom');

    // Click the Human race card.
    await page.locator('.race-card h4:has-text("Human")').first().click();

    // After selecting a race the detail panel shows the race name.
    await expect(page.locator('h4:has-text("Human Details")')).toBeVisible();

    await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // Should arrive at the kingdoms list page.
    await expect(page.locator('h2:has-text("Your Kingdoms")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.kingdom-card', { hasText: 'My Test Kingdom' })).toBeVisible();
  });

  test('dashboard displays kingdom resources after entering', async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnterDashboard(page, 'Resource Kingdom', 'Human');

    await expect(page.locator('h2:has-text("Resources")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Gold').first()).toBeVisible();
    await expect(page.locator('text=Population').first()).toBeVisible();
    await expect(page.locator('text=Land').first()).toBeVisible();
  });

  test('dashboard shows kingdom name in the header', async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnterDashboard(page, 'Named Kingdom', 'Elven');

    // TopNavigation renders the kingdom name as the title.
    await expect(page.locator('text=Named Kingdom')).toBeVisible({ timeout: 10000 });
  });

  test('dashboard shows Kingdom Actions panel with navigation buttons', async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnterDashboard(page, 'Action Kingdom', 'Human');

    await expect(page.locator('h2:has-text("Kingdom Actions")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Combat Operations")')).toBeVisible();
    await expect(page.locator('button:has-text("Trade")')).toBeVisible();
  });

  test('can navigate to combat page from dashboard', async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnterDashboard(page, 'Combat Kingdom', 'Goblin');

    await page.locator('button:has-text("Combat Operations")').click();
    await page.waitForLoadState('networkidle');

    // URL should contain /combat.
    await expect(page).toHaveURL(/\/combat/);
  });

  test('can navigate to trade page from dashboard', async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnterDashboard(page, 'Trade Kingdom', 'Human');

    await page.locator('button:has-text("Trade")').click();
    await page.waitForLoadState('networkidle');

    // URL should contain /trade.
    await expect(page).toHaveURL(/\/trade/);
  });

  test('can navigate back to kingdoms list from dashboard', async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnterDashboard(page, 'Back Kingdom', 'Human');

    // TopNavigation renders "← Back to Kingdoms" as a back button.
    await page.locator('button:has-text("Back to Kingdoms")').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2:has-text("Your Kingdoms")')).toBeVisible({ timeout: 10000 });
  });

  test('kingdoms list shows Create New Kingdom button', async ({ page }) => {
    await enterDemoMode(page);
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    // Create one kingdom and go to the list.
    await page.locator('#kingdom-name').fill('List Kingdom');
    await page.locator('.race-card h4:has-text("Human")').first().click();
    await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has-text("Create New Kingdom")')).toBeVisible();
  });

  test('demo mode persists across page reload', async ({ page }) => {
    await enterDemoMode(page);
    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

    // Create a kingdom so there is saved state.
    await page.locator('#kingdom-name').fill('Persist Kingdom');
    await page.locator('.race-card h4:has-text("Human")').first().click();
    await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // Reload the page — demo-mode flag is in localStorage so the app should
    // stay in demo mode and navigate to /kingdoms.
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Demo Mode');
    await expect(page.locator('h2:has-text("Your Kingdoms")')).toBeVisible({ timeout: 10000 });
  });
});
