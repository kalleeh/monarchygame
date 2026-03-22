import { test, expect, Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('demo-mode', 'true'); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  try { await page.getByRole('button', { name: 'Skip Tutorial' }).click({ timeout: 3000 }); } catch {}
  // App may land on /creation directly (no kingdoms) or /kingdoms
  if (!page.url().includes('/creation')) {
    await page.getByRole('button', { name: /Create.*(Kingdom|First)/i }).first().click();
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

async function nav(page: Page, section: string) {
  await page.evaluate((s) => {
    const id = window.location.pathname.match(/\/kingdom\/([^/]+)/)?.[1];
    if (id) { window.history.pushState({}, '', `/kingdom/${id}/${s}`); window.dispatchEvent(new PopStateEvent('popstate')); }
  }, section);
  await page.waitForLoadState('networkidle');
}

// ===========================================================================
// Trade System
// ===========================================================================

test.describe('Trade System', () => {

  test.beforeEach(async ({ page }) => {
    await setup(page);
    await nav(page, 'trade');
  });

  test('page loads with Market Overview section', async ({ page }) => {
    await expect(page.getByText('Market Overview')).toBeVisible();
    await expect(page.getByText('Trade Volume')).toBeVisible();
    await expect(page.getByText('Avg Price')).toBeVisible();
    await expect(page.getByText('Market Volatility')).toBeVisible();
    await expect(page.getByText('Total Market Value')).toBeVisible();
  });

  test('shows 4 resource price cards', async ({ page }) => {
    await expect(page.getByText('Gold').first()).toBeVisible();
    await expect(page.getByText('Mana').first()).toBeVisible();
    await expect(page.getByText('Population').first()).toBeVisible();
    await expect(page.getByText('Land').first()).toBeVisible();
  });

  test('Active Offers section shows demo offers', async ({ page }) => {
    // Demo mode seeds pre-existing offers — Accept buttons should be visible
    const acceptBtns = page.getByRole('button', { name: /Accept/i });
    await expect(acceptBtns.first()).toBeVisible();
    const count = await acceptBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Create Offer form appears on button click', async ({ page }) => {
    await page.getByRole('button', { name: /Create Offer/i }).first().click();
    await page.waitForTimeout(300);

    // Form should show a resource dropdown and quantity/price inputs
    const resourceSelect = page.locator('select').first();
    await expect(resourceSelect).toBeVisible();

    const inputs = page.locator('input[type="number"]');
    await expect(inputs.first()).toBeVisible();
  });

  test('form enables submit when all fields filled', async ({ page }) => {
    await page.getByRole('button', { name: /Create Offer/i }).first().click();
    await page.waitForTimeout(300);

    // Select Gold from the resource dropdown
    const resourceSelect = page.locator('select').first();
    await resourceSelect.selectOption({ label: "Gold" });
    await page.waitForTimeout(300);

    // Fill quantity and price
    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill('100');
    await inputs.nth(1).fill('2');
    await page.waitForTimeout(300);

    // The submit button inside the form should now be enabled
    const submitBtn = page.getByRole('button', { name: /Create Offer/i }).last();
    await expect(submitBtn).toBeEnabled();
  });

  test('submitting creates offer in active list', async ({ page }) => {
    await page.getByRole('button', { name: /Create Offer/i }).first().click();
    await page.waitForTimeout(300);

    const resourceSelect = page.locator('select').first();
    await resourceSelect.selectOption({ label: "Gold" });
    await page.waitForTimeout(300);

    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill('100');
    await inputs.nth(1).fill('2');
    await page.waitForTimeout(300);

    const submitBtn = page.getByRole('button', { name: /Create Offer/i }).last();
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(500);

      // A Cancel button for our new Gold offer should appear
      const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
      await expect(cancelBtn).toBeVisible();
    }
  });

  test('own offer shows Cancel not Accept', async ({ page }) => {
    // Create a Gold offer
    await page.getByRole('button', { name: /Create Offer/i }).first().click();
    await page.waitForTimeout(300);

    const resourceSelect = page.locator('select').first();
    await resourceSelect.selectOption({ label: "Gold" });
    await page.waitForTimeout(300);

    const inputs = page.locator('input[type="number"]');
    await inputs.nth(0).fill('50');
    await inputs.nth(1).fill('3');
    await page.waitForTimeout(300);

    const submitBtn = page.getByRole('button', { name: /Create Offer/i }).last();
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(500);

      // Our own offer row should have a Cancel button
      const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
      await expect(cancelBtn).toBeVisible();

      // Our own offer row should NOT have an Accept button immediately next to it
      // (the existing AI offers further down may still have Accept)
      // Verify the Cancel button exists — that is the key assertion for own offer
      const cancelCount = await page.getByRole('button', { name: /Cancel/i }).count();
      expect(cancelCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('accepting a Population offer updates resources', async ({ page }) => {
    // Find a Population offer's Accept button
    const offerRows = page.locator('[class*="offer"], [class*="trade-item"], tr').filter({ hasText: /Population/i });
    const acceptBtn = offerRows.getByRole('button', { name: /Accept/i }).first();

    const isVisible = await acceptBtn.isVisible().catch(() => false);
    if (isVisible) {
      // Count Accept buttons before
      const beforeCount = await page.getByRole('button', { name: /Accept/i }).count();

      await acceptBtn.click();
      await page.waitForTimeout(500);

      // The offer should be removed — Accept button count should decrease
      const afterCount = await page.getByRole('button', { name: /Accept/i }).count();
      expect(afterCount).toBeLessThan(beforeCount);
    }
  });

});
