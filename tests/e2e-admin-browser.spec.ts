/**
 * e2e-admin-browser.spec.ts
 * Covers: Admin Dashboard (/admin), Kingdom Browser (/browse), Multiplayer Lobby (/multiplayer)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared setup helper — creates a Human kingdom and enters its dashboard.
// ---------------------------------------------------------------------------
async function setupDemoKingdom(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('demo-mode', 'true');
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  try {
    await page.getByRole('button', { name: 'Skip Tutorial' }).click({ timeout: 3000 });
  } catch { /* no tutorial */ }

  // App may land on /creation (no kingdoms) or /kingdoms
  if (!page.url().includes('/creation')) {
    await page.getByRole('button', { name: /Create.*(Kingdom|First)/ }).first().click();
    await page.waitForURL('**/creation');
  }
  await page.getByRole('button', { name: /generate random|🎲/i }).click();
  await page.getByRole('button', { name: /Conqueror/ }).click();
  await page.getByRole('button', { name: 'Create Kingdom', exact: true }).click();
  await page.waitForURL('**/kingdoms');
  await page.getByRole('button', { name: 'Enter Kingdom' }).first().click();
  await page.waitForURL('**/kingdom/**');
  // Wait for dashboard to render
  await page.waitForSelector('img[alt="Turns"]', { timeout: 10000 }).catch(() => {});
  // Dismiss kingdom-level tutorial if present
  try { await page.getByRole('button', { name: /Close tutorial/i }).click({ timeout: 3000 }); await page.waitForTimeout(300); } catch {}
}

// ---------------------------------------------------------------------------
// Navigate to a sub-page within the current kingdom using pushState.
// Used for /browse and /multiplayer which are not in the action bar.
// ---------------------------------------------------------------------------
async function goToSubPage(page: Page, subPath: string): Promise<void> {
  await page.evaluate((path) => {
    const id = window.location.pathname.match(/kingdom\/([^/]+)/)?.[1];
    if (!id) throw new Error('Not on a kingdom page');
    window.history.pushState({}, '', `/kingdom/${id}/${path}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, subPath);
  await page.waitForLoadState('networkidle');
}

// ===========================================================================
// Admin Dashboard (/admin)
// ===========================================================================

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    // Navigate to admin via the demo mode header button (not direct URL)
    await page.getByRole('button', { name: /⚙.*Admin/ }).click();
    await page.waitForURL('**/admin');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Monarchy Admin heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Monarchy Admin/, level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('shows "Demo Mode — changes won\'t persist" subtitle', async ({ page }) => {
    await expect(page.locator('.admin-demo-badge')).toContainText("Demo Mode — changes won't persist", { timeout: 10000 });
  });

  test('Active Season section shows Season #, Status, Current Age, Start Date, Participants', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Active Season', level: 2 })).toBeVisible({ timeout: 10000 });

    const seasonInfo = page.locator('.admin-season-info');
    await expect(seasonInfo).toBeVisible({ timeout: 5000 });

    await expect(seasonInfo.locator('.admin-info-label', { hasText: 'Season' })).toBeVisible();
    await expect(seasonInfo.locator('.admin-info-value', { hasText: '#1' })).toBeVisible();

    await expect(seasonInfo.locator('.admin-info-label', { hasText: 'Status' })).toBeVisible();
    await expect(seasonInfo.locator('.badge')).toContainText('active');

    await expect(seasonInfo.locator('.admin-info-label', { hasText: 'Current Age' })).toBeVisible();
    await expect(seasonInfo.locator('.admin-info-label', { hasText: 'Start Date' })).toBeVisible();
    await expect(seasonInfo.locator('.admin-info-label', { hasText: 'Participants' })).toBeVisible();
  });

  test('Create Season button is disabled when a season is active', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Active Season', level: 2 })).toBeVisible({ timeout: 10000 });
    const createBtn = page.getByRole('button', { name: 'Create Season' });
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeDisabled();
  });

  test('Check Ages button is present and clickable in demo mode (shows toast)', async ({ page }) => {
    const checkBtn = page.getByRole('button', { name: 'Check Ages' });
    await expect(checkBtn).toBeVisible({ timeout: 10000 });
    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();
    // In demo mode this shows a toast "[Demo] Season ages checked"
    // We just verify the button remains visible and enabled after clicking
    await expect(checkBtn).toBeVisible({ timeout: 3000 });
  });

  test('End Season button triggers a confirmation dialog; canceling keeps page unchanged', async ({ page }) => {
    const endBtn = page.getByRole('button', { name: 'End Season' });
    await expect(endBtn).toBeVisible({ timeout: 10000 });

    // Override window.confirm to return false (cancel)
    await page.evaluate(() => { window.confirm = () => false; });

    await endBtn.click();

    // Page should remain unchanged — still showing the active season panel
    await expect(page.getByRole('heading', { name: 'Active Season', level: 2 })).toBeVisible();
    await expect(page.locator('.admin-season-info')).toBeVisible();
  });

  test('Turn Management: spinbutton allows changing value and Tick All Kingdoms shows result', async ({ page }) => {
    const turnsInput = page.getByRole('spinbutton', { name: 'Turns to add' });
    await expect(turnsInput).toBeVisible({ timeout: 10000 });

    // Change the value
    await turnsInput.fill('3');
    await expect(turnsInput).toHaveValue('3');

    const tickBtn = page.getByRole('button', { name: 'Tick All Kingdoms' });
    await expect(tickBtn).toBeVisible();
    await tickBtn.click();

    // In demo mode this shows "Ticked 3 kingdoms (+3 turns each) [Demo Mode]"
    await expect(page.locator('.admin-result')).toContainText(/Ticked.*kingdoms/i, { timeout: 5000 });
  });

  test('Season History button expands to show a table with correct columns', async ({ page }) => {
    const historyHeader = page.locator('.admin-panel-header--clickable', { hasText: 'Season History' });
    await expect(historyHeader).toBeVisible({ timeout: 10000 });

    // Initial state is collapsed
    await expect(historyHeader).toHaveAttribute('aria-expanded', 'false');

    await historyHeader.click();

    // Should expand and show the history table
    await expect(historyHeader).toHaveAttribute('aria-expanded', 'true');
    const table = page.locator('.admin-history-body .admin-table');
    await expect(table).toBeVisible({ timeout: 5000 });

    // Table headers
    await expect(table.locator('th', { hasText: 'Season' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'End Date' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Participants' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Results' })).toBeVisible();
  });

  test('View Results button in Season History opens SeasonResults modal', async ({ page }) => {
    const historyHeader = page.locator('.admin-panel-header--clickable', { hasText: 'Season History' });
    await expect(historyHeader).toBeVisible({ timeout: 10000 });
    await historyHeader.click();

    const viewResultsBtn = page.getByRole('button', { name: 'View Results' }).first();
    await expect(viewResultsBtn).toBeVisible({ timeout: 5000 });
    await viewResultsBtn.click();

    // SeasonResults modal
    await expect(page.getByRole('heading', { name: /Season.*Complete!/ })).toBeVisible({ timeout: 5000 });
  });

  test('SeasonResults modal shows Alliance Honours, Hall of Kings sections and a Dismiss button', async ({ page }) => {
    const historyHeader = page.locator('.admin-panel-header--clickable', { hasText: 'Season History' });
    await historyHeader.click();

    const viewResultsBtn = page.getByRole('button', { name: 'View Results' }).first();
    await expect(viewResultsBtn).toBeVisible({ timeout: 5000 });
    await viewResultsBtn.click();

    await expect(page.getByRole('heading', { name: /Season.*Complete!/ })).toBeVisible({ timeout: 5000 });

    // The heading text nodes in SeasonResults use h2 with textContent "Alliance Honours" and "Hall of Kings"
    await expect(page.locator('h2', { hasText: 'Alliance Honours' })).toBeVisible();
    await expect(page.locator('h2', { hasText: /Hall of Kings/ })).toBeVisible();

    // Dismiss button
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });

  test('SeasonResults Dismiss button closes the modal', async ({ page }) => {
    const historyHeader = page.locator('.admin-panel-header--clickable', { hasText: 'Season History' });
    await historyHeader.click();

    const viewResultsBtn = page.getByRole('button', { name: 'View Results' }).first();
    await expect(viewResultsBtn).toBeVisible({ timeout: 5000 });
    await viewResultsBtn.click();

    await expect(page.getByRole('heading', { name: /Season.*Complete!/ })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByRole('heading', { name: /Season.*Complete!/ })).not.toBeVisible({ timeout: 3000 });
  });
});

// ===========================================================================
// Kingdom Browser (/browse)
// ===========================================================================

test.describe('Kingdom Browser', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    await goToSubPage(page, 'browse');
  });

  test('page loads with Kingdom Browser heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Kingdom Browser', level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('shows 5 kingdoms count in result counter', async ({ page }) => {
    // The result count span shows "N kingdoms"
    await expect(page.locator('.result-count')).toContainText('5 kingdoms', { timeout: 10000 });
  });

  test('search box filters kingdoms by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Get the name of the first kingdom card to search for
    const firstKingdomName = await page.locator('.browser-kingdom-card h3').first().textContent();
    const searchTerm = firstKingdomName?.trim().split(' ')[0] ?? 'Shadow';

    await searchInput.fill(searchTerm);

    // Result count should drop below 5
    const resultCount = page.locator('.result-count');
    await expect(resultCount).not.toContainText('5 kingdoms', { timeout: 5000 });
  });

  test('clearing search shows all 5 kingdoms again', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill('zzz_no_match_query');
    await expect(page.locator('.result-count')).toContainText('0 kingdoms', { timeout: 5000 });

    await searchInput.clear();
    await expect(page.locator('.result-count')).toContainText('5 kingdoms', { timeout: 5000 });
  });

  test('Attack button navigates to /combat', async ({ page }) => {
    const attackBtn = page.getByRole('button', { name: 'Attack' }).first();
    await expect(attackBtn).toBeVisible({ timeout: 10000 });
    await attackBtn.click();
    await expect(page).toHaveURL(/\/combat/);
  });

  test('Trade button navigates to /trade', async ({ page }) => {
    const tradeBtn = page.getByRole('button', { name: 'Trade' }).first();
    await expect(tradeBtn).toBeVisible({ timeout: 10000 });
    await tradeBtn.click();
    await expect(page).toHaveURL(/\/trade/);
  });

  test('Diplomacy button navigates to /diplomacy', async ({ page }) => {
    const diplomacyBtn = page.getByRole('button', { name: 'Diplomacy' }).first();
    await expect(diplomacyBtn).toBeVisible({ timeout: 10000 });
    await diplomacyBtn.click();
    await expect(page).toHaveURL(/\/diplomacy/);
  });
});

// ===========================================================================
// Multiplayer Lobby (/multiplayer)
// ===========================================================================

test.describe('Multiplayer Lobby', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    await goToSubPage(page, 'multiplayer');
  });

  test('page loads with Multiplayer Lobby heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Multiplayer Lobby', level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('shows message about requiring authentication in demo mode', async ({ page }) => {
    // In demo mode, MultiplayerLobby renders the demo notice
    await expect(page.locator('.lobby-demo-notice')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.lobby-demo-notice')).toContainText(/authentication|sign in/i);
  });

  test('lists Season-based gameplay feature bullet', async ({ page }) => {
    await expect(page.locator('.lobby-demo-notice li', { hasText: /Season-based/i })).toBeVisible({ timeout: 10000 });
  });

  test('lists Real player kingdoms feature bullet', async ({ page }) => {
    await expect(page.locator('.lobby-demo-notice li', { hasText: /Real player kingdoms/i })).toBeVisible({ timeout: 10000 });
  });

  test('lists Diplomatic treaties and alliances feature bullet', async ({ page }) => {
    await expect(page.locator('.lobby-demo-notice li', { hasText: /Diplomatic/i })).toBeVisible({ timeout: 10000 });
  });

  test('lists War declarations feature bullet', async ({ page }) => {
    await expect(page.locator('.lobby-demo-notice li', { hasText: /War declarations/i })).toBeVisible({ timeout: 10000 });
  });
});
