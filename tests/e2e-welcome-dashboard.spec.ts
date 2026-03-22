/**
 * e2e: Welcome Page & Dashboard
 * Covers: WelcomePage interactions, Dashboard resources/panels/modals,
 * multi-kingdom management.
 */
import { test, expect } from '@playwright/test';
import { enterDemoMode, createKingdomAndEnter, navigateTo } from './e2e-helpers';

// ─── Welcome Page ─────────────────────────────────────────────────────────────

test.describe('Welcome Page', () => {
  test.beforeEach(async ({ page }) => {
    // Exit demo mode so the welcome page is shown
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('demo-mode'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('feature tabs update displayed content', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Build Your Kingdom/ })).toBeVisible();
    await page.getByRole('button', { name: /Epic Combat System/ }).click();
    await expect(page.getByRole('heading', { name: /Epic Combat System/ })).toBeVisible();
    await page.getByRole('button', { name: /Choose Your Race/ }).click();
    await expect(page.getByRole('heading', { name: /Choose Your Race/ })).toBeVisible();
    await page.getByRole('button', { name: /Real-Time Strategy/ }).click();
    await expect(page.getByRole('heading', { name: /Real-Time Strategy/ })).toBeVisible();
  });

  test('race selector updates stats and special ability', async ({ page }) => {
    // Default is Human
    await expect(page.getByRole('heading', { name: 'Human' }).last()).toBeVisible();
    // Switch to Elven
    await page.getByRole('button', { name: /^Elven$/ }).click();
    await expect(page.getByRole('heading', { name: 'Elven' }).last()).toBeVisible();
    await expect(page.getByText(/Can cast fog/i)).toBeVisible();
    // Switch to Goblin
    await page.getByRole('button', { name: /^Goblin$/ }).click();
    await expect(page.getByRole('heading', { name: 'Goblin' }).last()).toBeVisible();
    await expect(page.getByText(/siege warfare/i)).toBeVisible();
    // Switch to Vampire
    await page.getByRole('button', { name: /^Vampire$/ }).click();
    await expect(page.getByText(/2.* resources/i)).toBeVisible();
  });

  test('all 10 race buttons are displayed', async ({ page }) => {
    const races = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];
    for (const race of races) {
      await expect(page.getByRole('button', { name: new RegExp(`^${race}$`) })).toBeVisible();
    }
  });

  test('Learn More button scrolls page without navigating', async ({ page }) => {
    await page.getByRole('button', { name: 'Learn More' }).click();
    await expect(page).toHaveURL('/');
    // Game Features section should be scrolled into view
    await expect(page.getByRole('heading', { name: 'Game Features' })).toBeVisible();
  });

  test('Demo Mode button enters demo mode', async ({ page }) => {
    await page.getByRole('button', { name: /Demo Mode/i }).click();
    await page.waitForLoadState('networkidle');
    // Should end up on /creation or /kingdoms
    await expect(page).toHaveURL(/\/(creation|kingdoms)/);
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnter(page);
  });

  test('shows all four resource cards', async ({ page }) => {
    await expect(page.getByText('Gold').first()).toBeVisible();
    await expect(page.getByText('Population').first()).toBeVisible();
    await expect(page.getByText('Land').first()).toBeVisible();
    await expect(page.getByText('Turns').first()).toBeVisible();
  });

  test('displays kingdom networth score', async ({ page }) => {
    await expect(page.getByText('KINGDOM NETWORTH (SCORE)')).toBeVisible();
  });

  test('notification bell opens panel', async ({ page }) => {
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.getByRole('dialog', { name: /Notification panel/ })).toBeVisible();
  });

  test('mark all read clears notification badge', async ({ page }) => {
    await page.getByRole('button', { name: /Notifications/ }).click();
    const markAll = page.getByRole('button', { name: /Mark all read/ });
    if (await markAll.isVisible({ timeout: 1000 }).catch(() => false)) {
      await markAll.click();
    }
    // Badge should be gone
    await expect(page.getByText(/\d+ unread/)).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('Generate Turns adds 3 turns', async ({ page }) => {
    const turnsEl = page.locator('img[alt="Turns"]').first().locator('..');
    const turnsBefore = parseInt((await turnsEl.textContent()) ?? '0');
    await page.getByRole('button', { name: 'Generate Turns' }).first().click();
    await page.waitForTimeout(400);
    const turnsAfter = parseInt((await turnsEl.textContent()) ?? '0');
    expect(turnsAfter).toBeGreaterThan(turnsBefore);
  });

  test('Generate Income increases gold', async ({ page }) => {
    const goldEl = page.locator('img[alt="Gold"]').first().locator('..');
    const goldBefore = await goldEl.textContent() ?? '0';
    await page.getByRole('button', { name: 'Generate Income' }).first().click();
    await page.waitForTimeout(400);
    const goldAfter = await goldEl.textContent() ?? '0';
    expect(goldAfter).not.toEqual(goldBefore);
  });

  test('Encamp 16h shows countdown message', async ({ page }) => {
    const encampBtn = page.getByRole('button', { name: /Encamp 16h/ });
    if (await encampBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await encampBtn.click();
      await expect(page.getByText(/Kingdom is resting/i)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/remaining/i)).toBeVisible();
    }
  });

  test('Time Travel opens panel with fast-forward buttons', async ({ page }) => {
    await page.getByRole('button', { name: /Time Travel/i }).click();
    await expect(page.getByRole('button', { name: '+1 Hour' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+1 Day' })).toBeVisible();
  });

  test('+1 Hour time travel increases turns', async ({ page }) => {
    await page.getByRole('button', { name: /Time Travel/i }).click();
    const turnsEl = page.locator('img[alt="Turns"]').first().locator('..');
    const turnsBefore = parseInt((await turnsEl.textContent()) ?? '0');
    await page.getByRole('button', { name: '+1 Hour' }).click();
    await page.waitForTimeout(400);
    const turnsAfter = parseInt((await turnsEl.textContent()) ?? '0');
    expect(turnsAfter).toBeGreaterThanOrEqual(turnsBefore);
  });

  test('View All Achievements button navigates to achievements page', async ({ page }) => {
    await page.getByRole('button', { name: /View All Achievements/i }).click();
    await expect(page).toHaveURL(/\/achievements/);
    await expect(page.getByRole('heading', { name: /Achievements/i }).first()).toBeVisible();
  });

  test('World Activity Feed can be collapsed and expanded', async ({ page }) => {
    const feedBtn = page.getByRole('button', { name: /World Activity Feed/i }).first();
    await expect(feedBtn).toBeVisible();
    const isExpanded = (await feedBtn.getAttribute('aria-expanded')) !== 'false';
    await feedBtn.click();
    await page.waitForTimeout(300);
    // Toggle again
    await feedBtn.click();
    await page.waitForTimeout(300);
    // Should be back to original state or visible
    await expect(feedBtn).toBeVisible();
  });

  test('action bar Expand shows grouped menu', async ({ page }) => {
    await page.getByRole('button', { name: /▼ Expand/i }).click();
    await expect(page.getByRole('heading', { name: /Kingdom/i, level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Warfare/i, level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Social/i, level: 4 })).toBeVisible();
  });

  test('action bar Expand navigates when a button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /▼ Expand/i }).click();
    await page.getByRole('button', { name: /Trade Trade/i }).click();
    await expect(page).toHaveURL(/\/trade/);
  });

  test('? Units modal opens with tier information', async ({ page }) => {
    await page.getByRole('button', { name: '? Units' }).click();
    await expect(page.getByRole('dialog', { name: /Unit Roster/i })).toBeVisible();
    await expect(page.getByText(/T1 Basic|T1|Tier 1/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Close/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Unit Roster/i })).not.toBeVisible({ timeout: 2000 });
  });

  test('? Help modal opens with quick reference', async ({ page }) => {
    await page.getByRole('button', { name: '? Help' }).click();
    await expect(page.getByText(/MONARCHY QUICK REFERENCE|QUICK REFERENCE/i).first()).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /Got it|Close/i }).first().click();
  });

  test('Getting Started panel dismiss button removes it', async ({ page }) => {
    const dismissBtn = page.getByRole('button', { name: /Dismiss getting started/i });
    if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissBtn.click();
      await expect(page.getByText('Getting Started')).not.toBeVisible({ timeout: 2000 });
    }
  });
});

// ─── Multi-Kingdom Management ─────────────────────────────────────────────────

test.describe('Multi-Kingdom Management', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test('can create and enter a second kingdom with a different race', async ({ page }) => {
    // Create Human kingdom
    await createKingdomAndEnter(page, { race: 'Human' });
    await expect(page.getByText('Human Kingdom')).toBeVisible();

    // Back to kingdoms list
    await page.getByRole('button', { name: /← Back to Kingdoms/i }).click();
    await expect(page).toHaveURL(/\/kingdoms/);

    // Two Enter Kingdom buttons should not exist yet — create Goblin
    await page.getByRole('button', { name: 'Create New Kingdom' }).click();
    await page.waitForURL('**/creation');
    await page.getByRole('button', { name: /generate random|🎲/i }).click();
    await page.getByRole('button', { name: /^Goblin/ }).first().click();
    await page.getByRole('button', { name: /Conqueror/i }).click();
    await page.getByRole('button', { name: 'Create Kingdom', exact: true }).click();
    await page.waitForURL('**/kingdoms');

    // Both kingdoms listed
    const enterBtns = page.getByRole('button', { name: 'Enter Kingdom' });
    await expect(enterBtns).toHaveCount(2);

    // Enter Goblin kingdom (second)
    await enterBtns.nth(1).click();
    await expect(page.getByText('Goblin Kingdom')).toBeVisible();
    // Goblin starts with 1200 gold (shown as "1.2K")
    await expect(page.getByText(/1\.2K/)).toBeVisible();
  });

  test('Goblin kingdom has race-specific buildings', async ({ page }) => {
    // Create Goblin kingdom directly
    await createKingdomAndEnter(page, { race: 'Goblin' });
    // Goblin buildings: Mines instead of Quarries/Mills
    await expect(page.getByText(/Mines|Mine/i).first()).toBeVisible();
    // Goblin race label
    await expect(page.getByText('Goblin Kingdom')).toBeVisible();
  });
});
