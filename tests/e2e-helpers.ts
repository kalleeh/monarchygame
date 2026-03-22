/**
 * Shared Playwright helpers for e2e tests.
 * All tests use demo mode — no authentication required.
 */
import type { Page } from '@playwright/test';

/** Enter demo mode from the welcome page, clearing prior state and skipping tutorial. */
export async function enterDemoMode(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    // Clear all demo-related localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('kingdom-') || k.startsWith('demo-') || k === 'tutorial-progress')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('demo-mode', 'true');
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Skip tutorial if it appears
  try {
    await page.getByRole('button', { name: 'Skip Tutorial' }).click({ timeout: 3000 });
    await page.waitForTimeout(400);
  } catch { /* no tutorial */ }
}

/**
 * Create a kingdom and navigate to its dashboard.
 * Call after enterDemoMode(). Returns the kingdom ID from the URL.
 */
export async function createKingdomAndEnter(
  page: Page,
  { name, race = 'Human', playstyle = 'Conqueror' }: { name?: string; race?: string; playstyle?: string } = {}
): Promise<string> {
  // May land on /creation directly or /kingdoms
  const url = page.url();
  if (!url.includes('/creation')) {
    const createBtn = page.getByRole('button', { name: /Create.*(Kingdom|First)/i }).first();
    await createBtn.waitFor({ timeout: 5000 });
    await createBtn.click();
    await page.waitForURL('**/creation');
  }

  // Fill kingdom name
  if (name) {
    await page.getByLabel('Kingdom Name:').fill(name);
  } else {
    await page.getByRole('button', { name: /generate random|🎲/i }).click();
    await page.waitForTimeout(200);
  }

  // Select race if not Human (Human is preselected)
  if (race !== 'Human') {
    await page.getByRole('button', { name: new RegExp(`^${race}\\b`, 'i') }).first().click();
    await page.waitForTimeout(200);
  }

  // Select playstyle (required before Create Kingdom enables)
  await page.getByRole('button', { name: new RegExp(playstyle, 'i') }).click();

  // Submit
  await page.getByRole('button', { name: 'Create Kingdom', exact: true }).click();
  await page.waitForURL('**/kingdoms');

  // Enter the kingdom
  await page.getByRole('button', { name: 'Enter Kingdom' }).first().click();
  await page.waitForURL('**/kingdom/**');
  // Wait for the dashboard to actually render (not just URL change)
  await page.waitForSelector('img[alt="Turns"]', { timeout: 10000 });
  // Dismiss kingdom-level tutorial overlay if present
  try {
    await page.getByRole('button', { name: /Close tutorial/i }).click({ timeout: 3000 });
    await page.waitForTimeout(300);
  } catch { /* no tutorial */ }

  return getKingdomIdFromUrl(page.url());
}

/** Navigate to a kingdom sub-page without triggering a full page reload. */
export async function navigateTo(page: Page, section: string): Promise<void> {
  await page.evaluate((s) => {
    const m = window.location.pathname.match(/\/kingdom\/([^/]+)/);
    if (m) {
      window.history.pushState({}, '', `/kingdom/${m[1]}${s ? `/${s}` : ''}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, section);
  await page.waitForLoadState('networkidle');
}

/** Extract kingdom ID from a /kingdom/:id/... URL. */
export function getKingdomIdFromUrl(url: string): string {
  return url.match(/\/kingdom\/([^/]+)/)?.[1] ?? '';
}

/** Generate income on the dashboard (for tests that need gold). */
export async function generateIncome(page: Page, times = 1): Promise<void> {
  await navigateTo(page, '');
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: 'Generate Income' }).first().click();
    await page.waitForTimeout(200);
  }
}
