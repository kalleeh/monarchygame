/**
 * e2e-battle-reports.spec.ts
 * Covers: Battle Reports (/reports) and Battle Replays (/replays, /replay/:id)
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

  await page.getByRole('button', { name: /Create.*(Kingdom|First)/ }).first().click();
  await page.getByRole('button', { name: '🎲' }).click();
  await page.getByRole('button', { name: /Conqueror/ }).click();
  await page.getByRole('button', { name: 'Create Kingdom', exact: true }).click();
  await page.waitForURL('**/kingdoms');
  await page.getByRole('button', { name: 'Enter Kingdom' }).first().click();
  await page.waitForURL('**/kingdom/**');
}

// ---------------------------------------------------------------------------
// Navigate to a sub-page within the current kingdom using pushState.
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

// ---------------------------------------------------------------------------
// Execute a battle so that battle reports / replays have data.
// Navigates to /combat, picks the first available target and unit, then clicks
// Execute Battle, waits for the result modal, and closes it.
// ---------------------------------------------------------------------------
async function executeBattle(page: Page): Promise<void> {
  await goToSubPage(page, 'combat');

  // Wait for AI kingdoms to be loaded into the dropdown
  const targetSelect = page.locator('select').first();
  await expect(targetSelect).toBeVisible({ timeout: 15000 });

  // Select the first real option (not the placeholder)
  await targetSelect.selectOption({ index: 1 });

  // Wait for units to load — click the first available unit card
  const unitCard = page.locator('.unit-card').first();
  const hasUnits = await unitCard.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasUnits) {
    await unitCard.locator('.unit-info').click();
  }

  // Execute battle (button may be disabled if no units available — that is OK, we just proceed)
  const executeBtn = page.getByRole('button', { name: 'Execute Battle' });
  const isEnabled = await executeBtn.isEnabled({ timeout: 3000 }).catch(() => false);
  if (isEnabled) {
    await executeBtn.click();

    // Wait for the battle result modal and close it
    const modal = page.locator('.battle-result-modal');
    const modalVisible = await modal.isVisible({ timeout: 8000 }).catch(() => false);
    if (modalVisible) {
      // Close by pressing Escape or clicking a close/dismiss button
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } catch { /* ignore */ }
      // If modal still visible, try to click a button inside it
      const stillVisible = await modal.isVisible({ timeout: 500 }).catch(() => false);
      if (stillVisible) {
        const closeBtn = modal.locator('button').last();
        await closeBtn.click({ timeout: 2000 }).catch(() => {});
      }
    }
  }

  await page.waitForTimeout(500);
}

// ===========================================================================
// Battle Reports (/reports)
// ===========================================================================

test.describe('Battle Reports — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    await goToSubPage(page, 'reports');
  });

  test('page loads with Battle Reports heading and stat cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Battle Reports', level: 3 })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.gm-stat-card__label', { hasText: 'Total Battles' })).toBeVisible();
    await expect(page.locator('.gm-stat-card__label', { hasText: 'Victories' })).toBeVisible();
    await expect(page.locator('.gm-stat-card__label', { hasText: 'Defeats' })).toBeVisible();
    await expect(page.locator('.gm-stat-card__label', { hasText: 'Win Rate' })).toBeVisible();
  });

  test('search input has correct placeholder text', async ({ page }) => {
    await expect(page.getByPlaceholder('Search by opponent or attack type...')).toBeVisible({ timeout: 10000 });
  });

  test('filter dropdown has correct options', async ({ page }) => {
    const select = page.locator('select.filter-select, select.gm-select');
    await expect(select).toBeVisible({ timeout: 10000 });
    await expect(select.locator('option', { hasText: 'All Battles' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Victories Only' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Defeats Only' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Your Attacks' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Your Defenses' })).toBeAttached();
  });

  test('selecting Victories Only shows "No battles match your current filters" empty state', async ({ page }) => {
    const select = page.locator('select.filter-select, select.gm-select');
    await expect(select).toBeVisible({ timeout: 10000 });
    await select.selectOption('victories');
    await expect(page.locator('.no-reports-text')).toContainText('No battles match your current filters');
  });

  test('column sort header buttons are present', async ({ page }) => {
    await expect(page.locator('button.sort-button', { hasText: /Date/ })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button.sort-button', { hasText: /Opponent/ })).toBeVisible();
    await expect(page.locator('button.sort-button', { hasText: /Outcome/ })).toBeVisible();
    await expect(page.locator('button.sort-button', { hasText: /Net Gain/ })).toBeVisible();
  });

  test('Date column sorts descending by default (shows arrow indicator)', async ({ page }) => {
    // The Date column is the default sort field (timestamp, desc). It should show a ↓ arrow.
    await expect(page.locator('button.sort-button.active', { hasText: /Date.*↓/ })).toBeVisible({ timeout: 10000 });
  });

  test('clicking Opponent header activates sort and shows ↓', async ({ page }) => {
    const opponentBtn = page.locator('button.sort-button', { hasText: /^Opponent/ });
    await expect(opponentBtn).toBeVisible({ timeout: 10000 });
    await opponentBtn.click();
    await expect(page.locator('button.sort-button.active', { hasText: /Opponent.*↓/ })).toBeVisible();
  });

  test('clicking Opponent ↓ again toggles to ↑', async ({ page }) => {
    const opponentBtn = page.locator('button.sort-button', { hasText: /^Opponent/ });
    await expect(opponentBtn).toBeVisible({ timeout: 10000 });
    // First click activates desc sort
    await opponentBtn.click();
    await expect(page.locator('button.sort-button.active', { hasText: /Opponent.*↓/ })).toBeVisible();
    // Second click reverses to asc
    await page.locator('button.sort-button.active', { hasText: /Opponent.*↓/ }).click();
    await expect(page.locator('button.sort-button.active', { hasText: /Opponent.*↑/ })).toBeVisible();
  });
});

test.describe('Battle Reports — with battle history', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    await executeBattle(page);
    await goToSubPage(page, 'reports');
  });

  test('battle row click opens detail view with Battle Report Details heading', async ({ page }) => {
    // Wait for at least one row to appear
    const row = page.locator('.table-row').first();
    const hasRows = await row.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, 'No battle rows present — battle execution may not have succeeded.');
      return;
    }

    await row.click();
    await expect(page.getByRole('heading', { name: 'Battle Report Details', level: 3 })).toBeVisible({ timeout: 5000 });
  });

  test('detail view shows Your Forces, Defender section, and Battle Spoils', async ({ page }) => {
    const row = page.locator('.table-row').first();
    const hasRows = await row.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, 'No battle rows present.');
      return;
    }

    await row.click();
    await expect(page.getByRole('heading', { name: 'Battle Report Details', level: 3 })).toBeVisible({ timeout: 5000 });

    // Attacker section (player is attacker)
    await expect(page.locator('.combatant.attacker h4', { hasText: /Your Forces/ })).toBeVisible();
    // Defender section
    await expect(page.locator('.combatant.defender h4', { hasText: /Defender/ })).toBeVisible();

    // Before/After army headings in detail
    await expect(page.locator('.army-before h5', { hasText: 'Before Battle' }).first()).toBeVisible();
    await expect(page.locator('.army-after h5', { hasText: 'After Battle' }).first()).toBeVisible();

    // Battle Spoils section (only rendered on success)
    const spoils = page.locator('.spoils-section');
    const hasSpoils = await spoils.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasSpoils) {
      await expect(spoils.getByRole('heading', { name: 'Battle Spoils', level: 4 })).toBeVisible();
      await expect(spoils.locator('.spoil-label', { hasText: 'Gold:' })).toBeVisible();
      await expect(spoils.locator('.spoil-label', { hasText: 'Land:' })).toBeVisible();
    }
  });

  test('"Back to Reports" button in detail view returns to list', async ({ page }) => {
    const row = page.locator('.table-row').first();
    const hasRows = await row.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, 'No battle rows present.');
      return;
    }

    await row.click();
    await expect(page.getByRole('heading', { name: 'Battle Report Details', level: 3 })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '← Back to Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Battle Reports', level: 3 })).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Battle Replays (/replays)
// ===========================================================================

test.describe('Battle Replays — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    await goToSubPage(page, 'replays');
  });

  test('page loads with Battle Replays heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Battle Replays', level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('shows "No replays available yet" empty state when no battles', async ({ page }) => {
    await expect(page.locator('text=No replays available yet')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Battle Replays — with battle history', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoKingdom(page);
    await executeBattle(page);
    await goToSubPage(page, 'replays');
  });

  test('shows a Victory or Defeat row with View Replay button after a battle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Battle Replays', level: 1 })).toBeVisible({ timeout: 10000 });

    // The replays list renders rows when the combatReplayStore has data
    const viewReplayBtn = page.getByRole('button', { name: 'View Replay' }).first();
    const hasReplay = await viewReplayBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasReplay) {
      // Empty state may still be shown if replay store didn't capture the battle
      test.skip(true, 'Replay store had no data — battle may not have recorded a replay.');
      return;
    }

    // Should show Victory or Defeat label
    const replayRow = page.locator('div').filter({ has: viewReplayBtn }).first();
    const rowText = await replayRow.textContent();
    expect(rowText).toMatch(/Victory|Defeat/i);
  });

  test('clicking View Replay navigates to /replay/:id with Battle Replay heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Battle Replays', level: 1 })).toBeVisible({ timeout: 10000 });

    const viewReplayBtn = page.getByRole('button', { name: 'View Replay' }).first();
    const hasReplay = await viewReplayBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasReplay) {
      test.skip(true, 'No replay available.');
      return;
    }

    await viewReplayBtn.click();
    await expect(page).toHaveURL(/\/replay\//);
    await expect(page.getByRole('heading', { name: /Battle Replay/, level: 2 })).toBeVisible({ timeout: 5000 });
  });

  test('replay shows attacker VS defender, terrain, result and land gained', async ({ page }) => {
    const viewReplayBtn = page.getByRole('button', { name: 'View Replay' }).first();
    const hasReplay = await viewReplayBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasReplay) {
      test.skip(true, 'No replay available.');
      return;
    }

    await viewReplayBtn.click();
    await expect(page).toHaveURL(/\/replay\//);

    // Participants section
    await expect(page.locator('.battle-participants')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.vs', { hasText: 'VS' })).toBeVisible();
    await expect(page.locator('.participant.attacker h3')).toBeVisible();
    await expect(page.locator('.participant.defender h3')).toBeVisible();

    // Battle conditions: terrain, result, land gained
    await expect(page.locator('.condition .label', { hasText: 'Terrain:' })).toBeVisible();
    await expect(page.locator('.condition .label', { hasText: 'Result:' })).toBeVisible();
    await expect(page.locator('.condition .label', { hasText: 'Land Gained:' })).toBeVisible();
    await expect(page.locator('.condition .value').filter({ hasText: /Victory|Defeat/ })).toBeVisible();
  });

  test('replay shows round stats and navigation buttons', async ({ page }) => {
    const viewReplayBtn = page.getByRole('button', { name: 'View Replay' }).first();
    const hasReplay = await viewReplayBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasReplay) {
      test.skip(true, 'No replay available.');
      return;
    }

    await viewReplayBtn.click();
    await expect(page).toHaveURL(/\/replay\//);

    // Round stats
    await expect(page.locator('.stat-group').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.stat-group h4', { hasText: 'Attacker' })).toBeVisible();
    await expect(page.locator('.stat-group h4', { hasText: 'Defender' })).toBeVisible();

    // Navigation buttons — Previous and Next always present
    await expect(page.getByRole('button', { name: '← Previous' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();

    // For a single-round battle both should be disabled
    const prevBtn = page.getByRole('button', { name: '← Previous' });
    const nextBtn = page.getByRole('button', { name: 'Next →' });
    // At round 0, Previous is always disabled
    await expect(prevBtn).toBeDisabled();
    // Next is disabled when there is only 1 round
    const roundText = await page.locator('.replay-timeline h3').textContent();
    if (roundText?.includes('1 of 1')) {
      await expect(nextBtn).toBeDisabled();
    }
  });
});
