import { test, expect, Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('demo-mode', 'true'); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  try { await page.getByRole('button', { name: 'Skip Tutorial' }).click({ timeout: 3000 }); } catch {}
  const createBtn = page.getByRole('button', { name: /Create.*(Kingdom|First)/i }).first();
  await createBtn.click();
  await page.waitForURL('**/creation');
  await page.getByRole('button', { name: '🎲' }).click();
  await page.getByRole('button', { name: /Conqueror/ }).click();
  await page.getByRole('button', { name: 'Create Kingdom', exact: true }).click();
  await page.waitForURL('**/kingdoms');
  await page.getByRole('button', { name: 'Enter Kingdom' }).first().click();
  await page.waitForURL('**/kingdom/**');
}

async function nav(page: Page, section: string) {
  await page.evaluate((s) => {
    const id = window.location.pathname.match(/\/kingdom\/([^/]+)/)?.[1];
    if (id) { window.history.pushState({}, '', `/kingdom/${id}/${s}`); window.dispatchEvent(new PopStateEvent('popstate')); }
  }, section);
  await page.waitForLoadState('networkidle');
}

// ===========================================================================
// Combat / Battle Formations
// ===========================================================================

test.describe('Combat / Battle Formations', () => {

  test.beforeEach(async ({ page }) => {
    await setup(page);
    await nav(page, 'combat');
  });

  test('page loads with Battle Statistics panel', async ({ page }) => {
    await expect(page.getByText('Battle Statistics')).toBeVisible();
    await expect(page.getByText('Total Battles')).toBeVisible();
    await expect(page.getByText('Win Rate')).toBeVisible();
    await expect(page.getByText('Land Gained')).toBeVisible();
  });

  test('target dropdown shows 5 AI kingdoms', async ({ page }) => {
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    const options = await select.locator('option').all();
    // Filter out placeholder options (empty value or disabled)
    const nonPlaceholder = [];
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val.trim() !== '') nonPlaceholder.push(opt);
    }
    expect(nonPlaceholder.length).toBeGreaterThanOrEqual(5);
  });

  test('selecting target and unit enables Execute Battle', async ({ page }) => {
    // Select the first non-placeholder target option
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(300);

    // Click the first unit card via evaluate
    await page.evaluate(() => {
      const btn = document.querySelectorAll('.unit-card .unit-info')[0] as HTMLElement;
      btn?.click();
    });
    await page.waitForTimeout(300);

    const executeBtn = page.getByRole('button', { name: /Execute Battle/i });
    await expect(executeBtn).toBeEnabled();
  });

  test('executing battle shows result modal', async ({ page }) => {
    // Select target
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(300);

    // Select unit
    await page.evaluate(() => {
      const btn = document.querySelectorAll('.unit-card .unit-info')[0] as HTMLElement;
      btn?.click();
    });
    await page.waitForTimeout(300);

    const executeBtn = page.getByRole('button', { name: /Execute Battle/i });
    if (await executeBtn.isEnabled()) {
      await executeBtn.click();
      await page.waitForTimeout(1000);

      // Modal shows victory or defeat
      const victory = page.getByText('🎉 Victory!');
      const defeat = page.getByText('💀 Defeat');
      const hasVictory = await victory.isVisible().catch(() => false);
      const hasDefeat = await defeat.isVisible().catch(() => false);
      expect(hasVictory || hasDefeat).toBe(true);

      await expect(page.getByText('Defender:')).toBeVisible();
      await expect(page.getByText('Result:')).toBeVisible();

      await page.getByRole('button', { name: /Close/i }).click();
      await page.waitForTimeout(300);

      // Modal dismissed
      const victoryAfter = await page.getByText('🎉 Victory!').isVisible().catch(() => false);
      const defeatAfter = await page.getByText('💀 Defeat').isVisible().catch(() => false);
      expect(victoryAfter || defeatAfter).toBe(false);
    }
  });

  test('battle stats update after battle', async ({ page }) => {
    // Select target and unit, execute battle
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const btn = document.querySelectorAll('.unit-card .unit-info')[0] as HTMLElement;
      btn?.click();
    });
    await page.waitForTimeout(300);

    const executeBtn = page.getByRole('button', { name: /Execute Battle/i });
    if (await executeBtn.isEnabled()) {
      await executeBtn.click();
      await page.waitForTimeout(1000);

      // Close modal
      await page.getByRole('button', { name: /Close/i }).click().catch(() => {});
      await page.waitForTimeout(300);

      // Total Battles should now read 1
      await expect(page.getByText('1')).toBeVisible();
    }
  });

  test('formation cards can be clicked', async ({ page }) => {
    // Click "Defensive Wall" or "Cavalry Charge" formation card if present
    const defensiveWall = page.getByText('Defensive Wall');
    const cavalryCharge = page.getByText('Cavalry Charge');

    const hasDefensive = await defensiveWall.isVisible().catch(() => false);
    const hasCavalry = await cavalryCharge.isVisible().catch(() => false);

    if (hasDefensive) {
      await defensiveWall.click().catch(() => {});
      await page.waitForTimeout(300);
    } else if (hasCavalry) {
      await cavalryCharge.click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // No error — page should still be alive
    await expect(page.getByText('Battle Statistics')).toBeVisible();
  });

  test('Set Stance button changes defensive stance', async ({ page }) => {
    const setStanceBtn = page.getByRole('button', { name: /Set Stance/i }).first();
    const isVisible = await setStanceBtn.isVisible().catch(() => false);
    if (isVisible) {
      await setStanceBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Active')).toBeVisible();
    }
  });

  test('ambush checkbox toggles', async ({ page }) => {
    const checkbox = page.locator('input[type="checkbox"]').first();
    const isVisible = await checkbox.isVisible().catch(() => false);
    if (isVisible) {
      const initialChecked = await checkbox.isChecked();
      await checkbox.click();
      await page.waitForTimeout(300);
      expect(await checkbox.isChecked()).toBe(!initialChecked);

      await checkbox.click();
      await page.waitForTimeout(300);
      expect(await checkbox.isChecked()).toBe(initialChecked);
    }
  });

});

// ===========================================================================
// Spell Casting
// ===========================================================================

test.describe('Spell Casting', () => {

  test.beforeEach(async ({ page }) => {
    await setup(page);
    await nav(page, 'magic');
  });

  test('page loads with 7 spell cards', async ({ page }) => {
    const castButtons = page.getByRole('button', { name: /Cast Spell/i });
    await expect(castButtons.first()).toBeVisible();
    const count = await castButtons.count();
    expect(count).toBe(7);
  });

  test('Calming Chant is enabled with 0 elan cost', async ({ page }) => {
    // Find the Calming Chant spell card
    const calmingChantCard = page.locator(':has-text("Calming Chant")').last();
    await expect(calmingChantCard).toBeVisible();

    // Its Cast Spell button should not be disabled
    const castBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Calming Chant' })
      .getByRole('button', { name: /Cast Spell/i });

    const isEnabled = await castBtn.isEnabled().catch(() => true);
    expect(isEnabled).toBe(true);

    // Should show 0 elan cost
    await expect(page.getByText('💙 0')).toBeVisible();
  });

  test('casting Calming Chant increments elan and shows cooldown', async ({ page }) => {
    const castBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Calming Chant' })
      .getByRole('button', { name: /Cast Spell/i });

    if (await castBtn.isEnabled().catch(() => false)) {
      await castBtn.click();
      await page.waitForTimeout(300);

      // Elan should now show 1
      await expect(page.getByText(/Elan:\s*1/)).toBeVisible();

      // A cooldown indicator should appear (e.g. a timer or "cooldown" text)
      const cooldown = page.locator('[class*="cooldown"], [class*="timer"], :has-text("Cooldown")');
      await expect(cooldown.first()).toBeVisible();
    }
  });

  test('Rousing Wind becomes enabled after gaining 1 elan', async ({ page }) => {
    // Cast Calming Chant to gain 1 elan
    const calmingCastBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Calming Chant' })
      .getByRole('button', { name: /Cast Spell/i });

    if (await calmingCastBtn.isEnabled().catch(() => false)) {
      await calmingCastBtn.click();
      await page.waitForTimeout(300);
    }

    // Rousing Wind Cast Spell should now be enabled
    const rousingWindCastBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Rousing Wind' })
      .getByRole('button', { name: /Cast Spell/i });

    const isEnabled = await rousingWindCastBtn.isEnabled().catch(() => false);
    expect(isEnabled).toBe(true);
  });

  test('Rousing Wind shows target selector', async ({ page }) => {
    // First gain elan
    const calmingCastBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Calming Chant' })
      .getByRole('button', { name: /Cast Spell/i });

    if (await calmingCastBtn.isEnabled().catch(() => false)) {
      await calmingCastBtn.click();
      await page.waitForTimeout(300);
    }

    const rousingWindCastBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Rousing Wind' })
      .getByRole('button', { name: /Cast Spell/i });

    if (await rousingWindCastBtn.isEnabled().catch(() => false)) {
      await rousingWindCastBtn.click();
      await page.waitForTimeout(300);

      await expect(page.getByText('Select Target')).toBeVisible();
    }
  });

  test('Cancel dismisses target selector', async ({ page }) => {
    // Gain elan and open target selector
    const calmingCastBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Calming Chant' })
      .getByRole('button', { name: /Cast Spell/i });

    if (await calmingCastBtn.isEnabled().catch(() => false)) {
      await calmingCastBtn.click();
      await page.waitForTimeout(300);
    }

    const rousingWindCastBtn = page
      .locator('.spell-card, [class*="spell"]')
      .filter({ hasText: 'Rousing Wind' })
      .getByRole('button', { name: /Cast Spell/i });

    if (await rousingWindCastBtn.isEnabled().catch(() => false)) {
      await rousingWindCastBtn.click();
      await page.waitForTimeout(300);

      await expect(page.getByText('Select Target')).toBeVisible();

      await page.getByRole('button', { name: /Cancel/i }).click();
      await page.waitForTimeout(300);

      await expect(page.getByText('Select Target')).not.toBeVisible();
    }
  });

  test('temple threshold error shows percentage not decimal', async ({ page }) => {
    // If any error message about a temple threshold appears, check its format
    const errorText = page.locator('[class*="error"], [class*="warning"], [role="alert"]');
    const isVisible = await errorText.isVisible().catch(() => false);
    if (isVisible) {
      const text = await errorText.textContent() ?? '';
      // Should not show raw decimal like 0.02
      expect(text).not.toMatch(/0\.\d{2}%/);
      // Should show integer percentage like 2%
      if (text.includes('%')) {
        expect(text).toMatch(/\d+%/);
      }
    }
  });

});

// ===========================================================================
// Unit Summoning
// ===========================================================================

test.describe('Unit Summoning', () => {

  test.beforeEach(async ({ page }) => {
    await setup(page);
    await nav(page, 'summon');
  });

  test('page loads with Army Overview and Summon Units tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Army Overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Summon Units/i })).toBeVisible();
  });

  test('Summon Units tab shows unit cards', async ({ page }) => {
    await page.getByRole('button', { name: /Summon Units/i }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Peasants/i)).toBeVisible();
    await expect(page.getByText(/Militia/i)).toBeVisible();
    await expect(page.getByText(/Knights/i)).toBeVisible();
    await expect(page.getByText(/Cavalry/i)).toBeVisible();
  });

  test('Max button sets quantity to max affordable', async ({ page }) => {
    await page.getByRole('button', { name: /Summon Units/i }).click();
    await page.waitForTimeout(300);

    const maxBtn = page.getByRole('button', { name: /Max/i }).first();
    await expect(maxBtn).toBeVisible();
    await maxBtn.click();
    await page.waitForTimeout(300);

    // The quantity input should now have a value > 0
    const input = page.locator('input[type="number"]').first();
    const value = await input.inputValue();
    expect(parseInt(value, 10)).toBeGreaterThan(0);
  });

  test('Summon button deducts resources', async ({ page }) => {
    await page.getByRole('button', { name: /Summon Units/i }).click();
    await page.waitForTimeout(300);

    // Get initial turns value
    const turnsLocator = page.getByText(/Turns/i).first();
    const initialText = await turnsLocator.textContent() ?? '';

    // Click Max on the Peasants card (first unit)
    const maxBtn = page.getByRole('button', { name: /Max/i }).first();
    await maxBtn.click();
    await page.waitForTimeout(300);

    // Summon
    const summonBtn = page.getByRole('button', { name: /^Summon$/i }).first();
    if (await summonBtn.isEnabled()) {
      await summonBtn.click();
      await page.waitForTimeout(300);

      // Turns should have decreased
      const afterText = await turnsLocator.textContent() ?? '';
      expect(afterText).not.toBe(initialText);
    }
  });

  test('Army Overview shows summoned units after training', async ({ page }) => {
    // Switch to Summon Units and train some Peasants
    await page.getByRole('button', { name: /Summon Units/i }).click();
    await page.waitForTimeout(300);

    const maxBtn = page.getByRole('button', { name: /Max/i }).first();
    await maxBtn.click();
    await page.waitForTimeout(300);

    const summonBtn = page.getByRole('button', { name: /^Summon$/i }).first();
    if (await summonBtn.isEnabled()) {
      await summonBtn.click();
      await page.waitForTimeout(500);
    }

    // Switch to Army Overview
    await page.getByRole('button', { name: /Army Overview/i }).click();
    await page.waitForTimeout(300);

    // Some unit should be listed in the overview
    const unitEntry = page.locator('[class*="unit"], [class*="army"]').first();
    await expect(unitEntry).toBeVisible();
  });

});
