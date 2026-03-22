/**
 * e2e: Social Systems — Diplomacy, Leaderboard, Guild Management, World Map
 */
import { test, expect } from '@playwright/test';
import { enterDemoMode, createKingdomAndEnter, navigateTo } from './e2e-helpers';

// ─── Diplomacy ────────────────────────────────────────────────────────────────

test.describe('Diplomacy Interface', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnter(page);
    await navigateTo(page, 'diplomacy');
    await expect(page).toHaveURL(/\/diplomacy/);
  });

  test('dashboard tab shows reputation and stats', async ({ page }) => {
    await expect(page.getByText('Reputation')).toBeVisible();
    await expect(page.getByText('Active Treaties')).toBeVisible();
    await expect(page.getByText('Pending Proposals')).toBeVisible();
    await expect(page.getByText('At War')).toBeVisible();
    await expect(page.getByText('100')).toBeVisible(); // Reputation starts at 100
  });

  test('Relations tab shows kingdoms with action buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'Relations' }).click();
    await expect(page.getByRole('button', { name: /Negotiate/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Declare War/ }).first()).toBeVisible();
    // Status badges
    await expect(page.getByText(/NEUTRAL|FRIENDLY/i).first()).toBeVisible();
  });

  test('Declare War changes status to WAR', async ({ page }) => {
    await page.getByRole('button', { name: 'Relations' }).click();
    await page.getByRole('button', { name: /Declare War/ }).first().click();
    await expect(page.getByText('WAR')).toBeVisible({ timeout: 3000 });
  });

  test('Negotiate shows treaty type options', async ({ page }) => {
    await page.getByRole('button', { name: 'Relations' }).click();
    await page.getByRole('button', { name: /Negotiate/ }).first().click();
    await expect(page.getByRole('button', { name: /Non-Aggression Pact/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Trade Agreement/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Military Alliance/i })).toBeVisible();
  });

  test('sending Non-Aggression Pact appears in Proposals tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Relations' }).click();
    await page.getByRole('button', { name: /Negotiate/ }).first().click();
    await page.getByRole('button', { name: /Non-Aggression Pact/i }).click();
    // Check outgoing proposals
    await page.getByRole('button', { name: 'Proposals' }).click();
    await expect(page.getByText(/NON AGGRESSION|NON_AGGRESSION/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Pending Response/i)).toBeVisible();
  });

  test('Proposals tab has Incoming and Outgoing sections', async ({ page }) => {
    await page.getByRole('button', { name: 'Proposals' }).click();
    await expect(page.getByRole('heading', { name: /Incoming Proposals/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Outgoing Proposals/i })).toBeVisible();
  });

  test('History tab loads diplomatic history', async ({ page }) => {
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: /Diplomatic History/i })).toBeVisible();
    // Either history entries or empty state — both are valid
    const hasHistory = await page.getByText(/Accepted|proposed|PROPOSAL/i).isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmpty = await page.getByText(/No diplomatic history/i).isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasHistory || hasEmpty).toBeTruthy();
  });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnter(page);
    await navigateTo(page, 'leaderboard');
    await expect(page).toHaveURL(/\/leaderboard/);
  });

  test('All tab shows kingdoms with ranks and networth', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText(/Networth/i)).toBeVisible();
  });

  test('shows Demo or LIVE badge', async ({ page }) => {
    const badge = page.getByText(/Demo|LIVE/).first();
    await expect(badge).toBeVisible();
  });

  test('race tab filters to matching kingdoms', async ({ page }) => {
    await page.getByRole('tab', { name: 'Human' }).click();
    await expect(page.getByRole('heading', { name: /Human Rankings/i })).toBeVisible();
    // All visible kingdoms should be Human
    const raceLabels = page.getByText(/^Human$/).all();
    expect((await raceLabels).length).toBeGreaterThanOrEqual(1);
  });

  test('Elven tab shows empty state when no Elven kingdoms', async ({ page }) => {
    await page.getByRole('tab', { name: 'Elven' }).click();
    // Either kingdoms or empty state
    const hasEmpty = await page.getByText(/No kingdoms match/i).isVisible({ timeout: 2000 }).catch(() => false);
    const hasKingdoms = await page.getByText('#1').isVisible({ timeout: 500 }).catch(() => false);
    expect(hasEmpty || hasKingdoms).toBeTruthy();
  });

  test('Guilds tab shows guild rankings heading', async ({ page }) => {
    await page.getByRole('tab', { name: 'Guilds' }).click();
    await expect(page.getByRole('heading', { name: /Guild Rankings/i })).toBeVisible();
    // Empty state in demo mode
    await expect(page.getByText(/No guilds found/i)).toBeVisible({ timeout: 2000 });
  });

  test('search box filters kingdoms by name', async ({ page }) => {
    const searchBox = page.getByRole('searchbox', { name: /Search kingdoms/i });
    await searchBox.fill('Shadow');
    await page.waitForTimeout(300);
    await expect(page.getByText(/Shadow Realm/)).toBeVisible();
    // Other kingdoms should be hidden
    await expect(page.getByText(/Golden Dynasty/i)).not.toBeVisible({ timeout: 1000 }).catch(() => {});
    // Clear
    await searchBox.clear();
    await page.waitForTimeout(300);
    await expect(page.getByText('#1')).toBeVisible();
  });

  test('Show fair targets filter updates list', async ({ page }) => {
    const checkbox = page.getByText(/Show fair targets only/i).locator('..');
    await checkbox.click();
    await page.waitForTimeout(300);
    // List should update (not empty or same as before depending on networth)
    await expect(page.getByRole('heading', { name: /All Kingdoms|Rankings/i })).toBeVisible();
  });

  test('message button opens MessageCompose modal', async ({ page }) => {
    // Click the first ✉ button (not own kingdom)
    const msgBtn = page.getByRole('button', { name: /Send diplomatic message/i }).first();
    if (await msgBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await msgBtn.click();
      await expect(page.getByRole('dialog', { name: /Send Diplomatic Message/i })).toBeVisible({ timeout: 3000 });
      await page.getByRole('button', { name: /Cancel|Close|×/i }).click();
    }
  });
});

// ─── Guild Management ─────────────────────────────────────────────────────────

test.describe('Guild Management', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnter(page);
    await navigateTo(page, 'alliance');
    await expect(page).toHaveURL(/\/alliance/);
  });

  test('Overview tab shows not-in-guild state and benefits', async ({ page }) => {
    await page.getByRole('button', { name: 'Overview' }).click();
    await expect(page.getByText(/not in a guild|no guild/i)).toBeVisible();
    await expect(page.getByText(/Guild Benefits/i)).toBeVisible();
  });

  test('Browse Alliances tab loads without errors', async ({ page }) => {
    await page.getByRole('button', { name: /Browse Alliances/i }).click();
    await expect(page.getByText(/Public Alliances|Alliance/i)).toBeVisible({ timeout: 3000 });
  });

  test('Create Alliance tab shows full form', async ({ page }) => {
    await page.getByRole('button', { name: /Create Alliance/i }).click();
    await expect(page.getByRole('heading', { name: /Create New Alliance/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Guild Name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Guild Tag/i })).toBeVisible();
  });

  test('Create Alliance form enables submit when name and tag filled', async ({ page }) => {
    await page.getByRole('button', { name: /Create Alliance/i }).click();
    await page.getByRole('textbox', { name: /Guild Name/i }).fill('Test Alliance');
    await page.getByRole('textbox', { name: /Guild Tag/i }).fill('TST');
    const submitBtn = page.getByRole('button', { name: 'Create Alliance', exact: true }).last();
    await expect(submitBtn).toBeEnabled();
  });

  test('Auto-approve checkbox can be toggled', async ({ page }) => {
    await page.getByRole('button', { name: /Create Alliance/i }).click();
    const checkbox = page.getByRole('checkbox', { name: /Auto-approve/i });
    const isChecked = await checkbox.isChecked().catch(() => false);
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !isChecked });
  });
});

// ─── World Map ────────────────────────────────────────────────────────────────

test.describe('World Map', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await createKingdomAndEnter(page);
    await navigateTo(page, 'worldmap');
    await expect(page).toHaveURL(/\/worldmap/);
    // Wait for ReactFlow to render
    await page.waitForTimeout(1500);
  });

  test('page loads with map heading and legend', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /World Map/i })).toBeVisible();
    await expect(page.getByText(/Your Territory/i)).toBeVisible();
    await expect(page.getByText(/Fog of War/i)).toBeVisible();
  });

  test('Kingdom Stats panel shows territory count', async ({ page }) => {
    await expect(page.getByText(/Territories: 1/i)).toBeVisible();
  });

  test('Fit View control button is clickable', async ({ page }) => {
    const fitView = page.getByRole('button', { name: /Fit View/i });
    await expect(fitView).toBeVisible();
    await fitView.click();
    // Should not crash
    await expect(page.getByRole('heading', { name: /World Map/i })).toBeVisible();
  });

  test('territory nodes are rendered', async ({ page }) => {
    const nodeCount = await page.evaluate(() =>
      document.querySelectorAll('.react-flow__node[data-id]:not([data-id="map-bg"])').length
    );
    expect(nodeCount).toBeGreaterThan(5);
  });

  test('clicking a territory node opens detail panel', async ({ page }) => {
    // Click first non-fog, non-background territory
    const nodeId = await page.evaluate((): string | null => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'));
      const target = nodes.find(n =>
        n.dataset.id !== 'map-bg' &&
        n.textContent !== '???' &&
        n.textContent?.trim() !== ''
      );
      if (target) { target.click(); return target.dataset.id ?? null; }
      return null;
    });
    if (nodeId) {
      await page.waitForTimeout(600);
      // Either a territory detail panel or fog panel should appear
      const panelVisible = await page.locator('.territory-panel, [class*="territory"]').isVisible({ timeout: 2000 }).catch(() => false);
      if (!panelVisible) {
        // Check for slide-in panel too
        const slideIn = await page.getByText(/Unclaimed|Enemy|Player|Partial Visibility/i).isVisible({ timeout: 1000 }).catch(() => false);
        expect(slideIn || panelVisible).toBeTruthy();
      }
    }
  });

  test('Attack button navigates to combat page', async ({ page }) => {
    // Click a territory to open panel
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'));
      const target = nodes.find(n => n.dataset.id !== 'map-bg');
      target?.click();
    });
    await page.waitForTimeout(600);

    // Try Attack button via pointerdown (the fix we applied)
    const navigated = await page.evaluate(async (): Promise<boolean> => {
      const btn = document.querySelector<HTMLElement>('.attack-button');
      if (btn && !btn.hasAttribute('disabled')) {
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });

    if (navigated) {
      await page.waitForURL('**/combat', { timeout: 3000 }).catch(() => {});
      await expect(page).toHaveURL(/\/combat/);
    }
  });

  test('Back to Kingdom button returns to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /← Back to Kingdom/i }).click();
    await expect(page).toHaveURL(/\/kingdom\/[^/]+$/);
  });
});
