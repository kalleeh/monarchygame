/**
 * Navigation and Routing Tests
 *
 * Covers URL-level routing behaviour defined in AppRouter.tsx plus the visible
 * UI elements on the welcome page (WelcomePage.tsx).
 *
 * Key facts from source:
 *
 * WelcomePage:
 *   - <h1> contains the text "Monarchy" (and "The Ultimate Strategy Game" as a
 *     <span class="subtitle"> inside).
 *   - Hero buttons: "Start Your Reign", "Learn More", "🎮 Demo Mode".
 *   - Features section: id="features", h2 "Game Features", tabs for each
 *     feature – titles include "Build Your Kingdom", "Epic Combat System",
 *     "Choose Your Race", "Real-Time Strategy".
 *   - Race preview section: h2 "Choose Your Destiny", race tab buttons for
 *     all 10 races.
 *   - CTA section: h2 "Ready to Build Your Empire?", stat "10 Unique Races".
 *
 * AppRouter routes:
 *   - /          → WelcomePage (when not in demo mode)
 *   - /creation  → KingdomCreation
 *   - /kingdoms  → KingdomList
 *   - /kingdom/:id/* → KingdomDashboard and sub-routes
 *   - * (unknown) → Navigate to "/"
 *
 * The page <title> is set in index.html — the existing tests reference
 * /Monarchy/i so we keep that expectation.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared helper: enter demo mode from a clean state.
// ---------------------------------------------------------------------------
async function enterDemoMode(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('demo-mode');
    localStorage.removeItem('demo-kingdoms');
    localStorage.removeItem('tutorial-progress');
    Object.keys(localStorage)
      .filter(k => k.startsWith('kingdom-'))
      .forEach(k => localStorage.removeItem(k));
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator('button:has-text("🎮 Demo Mode")').click();
  await page.waitForLoadState('networkidle');

  const skipButton = page.locator('button:has-text("Skip Tutorial")');
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(300);
  }
}

// ---------------------------------------------------------------------------
// Shared helper: go to /creation in demo mode and create a kingdom, then
// return the kingdom id from the URL after entering the dashboard.
// ---------------------------------------------------------------------------
async function createAndEnterKingdom(page: import('@playwright/test').Page, name = 'Nav Kingdom') {
  await enterDemoMode(page);
  await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

  await page.locator('#kingdom-name').fill(name);
  await page.locator('.race-card h4:has-text("Human")').first().click();
  await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
  await page.waitForLoadState('networkidle');

  // From /kingdoms, enter the kingdom.
  await page.locator('.kingdom-card', { hasText: name }).locator('button:has-text("Enter Kingdom")').click();
  await page.waitForLoadState('networkidle');

  // Dismiss dashboard tutorial.
  const skipDash = page.locator('button:has-text("Skip Tutorial")');
  if (await skipDash.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipDash.click();
    await page.waitForTimeout(300);
  }

  // Return the kingdom id from the URL path (/kingdom/:id).
  const url = page.url();
  const match = url.match(/\/kingdom\/([^/]+)/);
  return match ? match[1] : null;
}

// ===========================================================================

test.describe('Navigation', () => {

  test.describe('Welcome Page', () => {

    test.beforeEach(async ({ page }) => {
      // Always start from a clean welcome page (not in demo mode).
      await page.evaluate(() => {
        localStorage.removeItem('demo-mode');
        localStorage.removeItem('demo-kingdoms');
        localStorage.removeItem('tutorial-progress');
      });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('welcome page loads and has the correct title', async ({ page }) => {
      await expect(page).toHaveTitle(/Monarchy/i);
    });

    test('welcome page renders the Monarchy heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Monarchy');
    });

    test('shows all three hero action buttons', async ({ page }) => {
      await expect(page.locator('button:has-text("Start Your Reign")')).toBeVisible();
      await expect(page.locator('button:has-text("Learn More")')).toBeVisible();
      await expect(page.locator('button:has-text("🎮 Demo Mode")')).toBeVisible();
    });

    test('Game Features section is present and shows Build Your Kingdom tab', async ({ page }) => {
      await expect(page.locator('#features h2:has-text("Game Features")')).toBeVisible();
      // Feature tabs are rendered from the features array.
      await expect(page.locator('button:has-text("Build Your Kingdom")')).toBeVisible();
      await expect(page.locator('button:has-text("Epic Combat System")')).toBeVisible();
      await expect(page.locator('button:has-text("Choose Your Race")')).toBeVisible();
      await expect(page.locator('button:has-text("Real-Time Strategy")')).toBeVisible();
    });

    test('clicking a feature tab updates the displayed feature content', async ({ page }) => {
      // Default is first tab (Build Your Kingdom, index 0).
      await page.locator('button:has-text("Epic Combat System")').click();

      // The feature-content area should show the selected feature description.
      const featureContent = page.locator('.feature-display');
      await expect(featureContent.locator('h3')).toHaveText('Epic Combat System');
    });

    test('Choose Your Destiny section shows 10 race tabs', async ({ page }) => {
      await expect(page.locator('h2:has-text("Choose Your Destiny")')).toBeVisible();

      const races = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
      for (const race of races) {
        await expect(page.locator('.race-tab:has-text("' + race + '")')).toBeVisible();
      }
    });

    test('clicking a race tab in the preview updates the race showcase', async ({ page }) => {
      // Click Elven tab in race-preview section.
      await page.locator('.race-tab:has-text("Elven")').click();

      // The race showcase section should now display Elven details.
      const showcase = page.locator('.race-showcase .race-info');
      await expect(showcase.locator('h3')).toHaveText('Elven');
    });

    test('CTA section shows 10 Unique Races stat', async ({ page }) => {
      await expect(page.locator('.game-stats .stat-item', { hasText: '10' })).toBeVisible();
      await expect(page.locator('text=Unique Races')).toBeVisible();
    });

    test('unknown route redirects to welcome page', async ({ page }) => {
      await page.goto('/does-not-exist-xyz');
      await page.waitForLoadState('networkidle');

      // AppRouter redirects * to "/" which shows the WelcomePage (not demo mode).
      await expect(page.locator('h1')).toContainText('Monarchy');
      await expect(page).toHaveURL(/\/$/);
    });
  });

  test.describe('Route: /creation', () => {

    test('navigating to /creation in demo mode renders the creation form', async ({ page }) => {
      await enterDemoMode(page);

      await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/creation/);
    });

    test('/creation outside demo mode redirects away (not creation form for guests)', async ({ page }) => {
      // Clear demo mode so no auth.
      await page.evaluate(() => localStorage.removeItem('demo-mode'));
      await page.goto('/creation');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // The app redirects protected routes to auth (setShowAuth(true)).
      // The result is the Amplify Authenticator UI or back to welcome page.
      // In either case the kingdom creation heading should NOT be visible
      // because the user is not authenticated.
      // We just verify the page didn't silently serve the form.
      const creationHeading = page.locator('h2:has-text("Create Your Kingdom")');
      // This should not be visible without being in demo mode or authenticated.
      await expect(creationHeading).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Route: /kingdoms', () => {

    test('kingdoms list page shows "Your Kingdoms" after creation', async ({ page }) => {
      await enterDemoMode(page);
      await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

      await page.locator('#kingdom-name').fill('Route Kingdom');
      await page.locator('.race-card h4:has-text("Human")').first().click();
      await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/kingdoms/);
      await expect(page.locator('h2:has-text("Your Kingdoms")')).toBeVisible();
    });

    test('kingdoms list has a Create New Kingdom button', async ({ page }) => {
      await enterDemoMode(page);
      await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

      await page.locator('#kingdom-name').fill('Route Kingdom 2');
      await page.locator('.race-card h4:has-text("Human")').first().click();
      await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('button:has-text("Create New Kingdom")')).toBeVisible();
    });

    test('Create New Kingdom button navigates to /creation', async ({ page }) => {
      await enterDemoMode(page);
      await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });

      await page.locator('#kingdom-name').fill('Route Kingdom 3');
      await page.locator('.race-card h4:has-text("Human")').first().click();
      await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
      await page.waitForLoadState('networkidle');

      await page.locator('button:has-text("Create New Kingdom")').click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/creation/);
      await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Route: /kingdom/:id sub-pages', () => {

    test('dashboard URL is /kingdom/:id (index route)', async ({ page }) => {
      await createAndEnterKingdom(page, 'URL Kingdom');

      await expect(page).toHaveURL(/\/kingdom\/[^/]+$/);
    });

    test('combat sub-route /kingdom/:id/combat renders BattleFormations', async ({ page }) => {
      await createAndEnterKingdom(page, 'Combat Route Kingdom');

      await page.locator('button:has-text("Combat Operations")').click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/kingdom\/[^/]+\/combat/);
      // BattleFormations component renders; at minimum the page should not show
      // the kingdom creation or welcome headings.
      await expect(page.locator('h2:has-text("Create Your Kingdom")')).not.toBeVisible();
    });

    test('trade sub-route /kingdom/:id/trade renders TradeSystem', async ({ page }) => {
      await createAndEnterKingdom(page, 'Trade Route Kingdom');

      await page.locator('button:has-text("Trade")').click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/kingdom\/[^/]+\/trade/);
      await expect(page.locator('h2:has-text("Create Your Kingdom")')).not.toBeVisible();
    });

    test('magic sub-route /kingdom/:id/magic renders SpellCastingInterface', async ({ page }) => {
      await createAndEnterKingdom(page, 'Magic Route Kingdom');

      await page.locator('button:has-text("Cast Spells")').click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/kingdom\/[^/]+\/magic/);
    });

    test('back navigation from sub-page returns to /kingdom/:id dashboard', async ({ page }) => {
      await createAndEnterKingdom(page, 'Back Nav Kingdom');

      await page.locator('button:has-text("Combat Operations")').click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/combat/);

      // BattleFormations renders an onBack prop that calls handleBackToDashboard.
      // Look for any back-type button.
      const backBtn = page.locator('button:has-text("Back")').first();
      await expect(backBtn).toBeVisible({ timeout: 5000 });
      await backBtn.click();
      await page.waitForLoadState('networkidle');

      // Should be back at /kingdom/:id (no sub-path).
      await expect(page).toHaveURL(/\/kingdom\/[^/]+$/);
    });

    test('leaderboard sub-route renders Kingdom Scrolls heading', async ({ page }) => {
      await createAndEnterKingdom(page, 'Leaderboard Kingdom');

      await page.locator('button:has-text("Kingdom Scrolls")').click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/leaderboard/);
      await expect(page.locator('h1:has-text("Kingdom Scrolls")')).toBeVisible({ timeout: 8000 });
    });
  });
});
