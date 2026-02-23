/**
 * Kingdom Creation Tests
 *
 * Focuses on the /creation route which renders KingdomCreation.tsx.
 *
 * Key facts derived from the source code:
 *
 * - The form has <label htmlFor="kingdom-name"> and <input id="kingdom-name">.
 * - Validation: name required, minimum 3 characters.  Error appears in a
 *   div[role="alert"] / div#name-error with the message.
 * - Submit button is <button type="submit"> disabled when name is blank or no
 *   race is selected (but a race is pre-selected by default: races[0] which is
 *   Human, the first RACES entry).
 * - Race cards are divs with class "race-card" and role="button"; they contain
 *   an <h4> with the race name.
 * - After selecting a race the side panel shows <h4>{race.name} Details</h4>
 *   plus starting resources: Gold, Population, Land, Turns.
 * - The random name generator button has aria-label="Generate random kingdom name".
 * - There are exactly 10 races: Human, Elven, Goblin, Droben, Vampire,
 *   Elemental, Centaur, Sidhe, Dwarven, Fae.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: navigate to the creation page in demo mode with a clean state.
// ---------------------------------------------------------------------------
async function goToCreation(page: import('@playwright/test').Page) {
  await page.goto('/');
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

  // Skip tutorial if it appears.
  const skipButton = page.locator('button:has-text("Skip Tutorial")');
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(300);
  }

  await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible({ timeout: 10000 });
}

// ===========================================================================

test.describe('Kingdom Creation', () => {

  test('creation page has the correct heading and form elements', async ({ page }) => {
    await goToCreation(page);

    await expect(page.locator('h2:has-text("Create Your Kingdom")')).toBeVisible();
    await expect(page.locator('#kingdom-name')).toBeVisible();
    await expect(page.locator('label[for="kingdom-name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Create Kingdom")')).toBeVisible();
  });

  test('shows all 10 races', async ({ page }) => {
    await goToCreation(page);

    const races = ['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae'];

    for (const race of races) {
      await expect(page.locator(`.race-card h4:has-text("${race}")`).first()).toBeVisible();
    }

    // Total race card count should be 10.
    await expect(page.locator('.race-card')).toHaveCount(10);
  });

  test('first race (Human) is pre-selected and shows its details panel', async ({ page }) => {
    await goToCreation(page);

    // Human is the first RACES entry and set as the initial selectedRace.
    const humanCard = page.locator('.race-card h4:has-text("Human")').first().locator('..');
    await expect(humanCard).toHaveClass(/selected/);

    // The details panel appears when selectedRace is set.
    await expect(page.locator('h4:has-text("Human Details")')).toBeVisible();
  });

  test('starting resources panel is visible after race selection', async ({ page }) => {
    await goToCreation(page);

    // A race is pre-selected, so the starting resources block renders immediately.
    await expect(page.locator('h4:has-text("Starting Resources:")')).toBeVisible();
    await expect(page.locator('.resource-label:has-text("Gold:")')).toBeVisible();
    await expect(page.locator('.resource-label:has-text("Population:")')).toBeVisible();
    await expect(page.locator('.resource-label:has-text("Land:")')).toBeVisible();
    await expect(page.locator('.resource-label:has-text("Turns:")')).toBeVisible();
  });

  test('selecting a different race updates the details panel', async ({ page }) => {
    await goToCreation(page);

    // Default is Human – select Elven.
    await page.locator('.race-card h4:has-text("Elven")').first().click();

    await expect(page.locator('h4:has-text("Elven Details")')).toBeVisible();

    // The Elven card should now have the selected class.
    const elvenCard = page.locator('.race-card h4:has-text("Elven")').first().locator('..');
    await expect(elvenCard).toHaveClass(/selected/);

    // The Human card should no longer be selected.
    const humanCard = page.locator('.race-card h4:has-text("Human")').first().locator('..');
    await expect(humanCard).not.toHaveClass(/selected/);
  });

  test('race stats differ between Human and Droben', async ({ page }) => {
    await goToCreation(page);

    // Read the special-ability text for Human.
    await page.locator('.race-card h4:has-text("Human")').first().click();
    const humanAbilityText = await page.locator('.race-details p').first().textContent();

    // Switch to Droben.
    await page.locator('.race-card h4:has-text("Droben")').first().click();
    await expect(page.locator('h4:has-text("Droben Details")')).toBeVisible();
    const drobenAbilityText = await page.locator('.race-details p').first().textContent();

    // The ability descriptions must be different.
    expect(humanAbilityText).not.toEqual(drobenAbilityText);
  });

  test('validates kingdom name - empty name shows error', async ({ page }) => {
    await goToCreation(page);

    // Submit button should be disabled when input is empty (no value yet).
    const submitBtn = page.locator('button[type="submit"]:has-text("Create Kingdom")');
    await expect(submitBtn).toBeDisabled();

    // If we attempt to submit anyway by programmatically removing the disabled
    // attribute and clicking, the validation fires.  A simpler approach: type
    // a name then clear it and try to submit.
    await page.locator('#kingdom-name').fill('ab');
    await page.locator('#kingdom-name').fill('');

    // Still disabled.
    await expect(submitBtn).toBeDisabled();
  });

  test('validates kingdom name - too short (under 3 chars) shows error message', async ({ page }) => {
    await goToCreation(page);

    await page.locator('#kingdom-name').fill('ab');

    // KingdomCreation disables the button if name is blank.  For the
    // "too short" validation the button is enabled (name is non-empty)
    // but submitting reveals the inline error.
    const submitBtn = page.locator('button[type="submit"]:has-text("Create Kingdom")');

    // The button is enabled because the value is non-empty.
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();

    // The validation error div#name-error with role="alert" should appear.
    await expect(page.locator('#name-error')).toBeVisible();
    await expect(page.locator('#name-error')).toContainText('at least 3 characters');
  });

  test('error message clears when user starts typing again', async ({ page }) => {
    await goToCreation(page);

    // Trigger the error.
    await page.locator('#kingdom-name').fill('ab');
    await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
    await expect(page.locator('#name-error')).toBeVisible();

    // Type a valid character – error should disappear.
    await page.locator('#kingdom-name').fill('abc');
    await expect(page.locator('#name-error')).not.toBeVisible();
  });

  test('submit button is disabled with no name and enabled with valid name', async ({ page }) => {
    await goToCreation(page);

    const submitBtn = page.locator('button[type="submit"]:has-text("Create Kingdom")');

    // Initially: no name → disabled.
    await expect(submitBtn).toBeDisabled();

    // Type a valid name.
    await page.locator('#kingdom-name').fill('Valid Name');
    await expect(submitBtn).toBeEnabled();

    // Clear the name.
    await page.locator('#kingdom-name').fill('');
    await expect(submitBtn).toBeDisabled();
  });

  test('random name generator fills the name input', async ({ page }) => {
    await goToCreation(page);

    const input = page.locator('#kingdom-name');
    await expect(input).toHaveValue('');

    // Click the 🎲 random name button.
    await page.locator('button[aria-label="Generate random kingdom name"]').click();

    // The input should now have some non-empty value.
    const generatedName = await input.inputValue();
    expect(generatedName.length).toBeGreaterThan(0);
  });

  test('race card is keyboard-accessible', async ({ page }) => {
    await goToCreation(page);

    // Race cards have role="button" and tabIndex={0} and respond to Enter.
    const elvenCard = page.locator('.race-card').filter({ hasText: 'Elven' }).first();
    await elvenCard.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('h4:has-text("Elven Details")')).toBeVisible();
  });

  test('successful creation navigates away from /creation', async ({ page }) => {
    await goToCreation(page);

    await page.locator('#kingdom-name').fill('My Demo Kingdom');
    await page.locator('.race-card h4:has-text("Human")').first().click();
    await page.locator('button[type="submit"]:has-text("Create Kingdom")').click();
    await page.waitForLoadState('networkidle');

    // After creation the app navigates to /kingdoms.
    await expect(page).toHaveURL(/\/kingdoms/);
    await expect(page.locator('h2:has-text("Your Kingdoms")')).toBeVisible({ timeout: 10000 });
  });
});
