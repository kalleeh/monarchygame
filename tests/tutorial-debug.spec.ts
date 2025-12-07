import { test, expect } from '@playwright/test';

test('Debug - Check page content and console errors', async ({ page }) => {
  // Capture console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  
  // Capture page errors
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  
  // Clear localStorage
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.removeItem('demo-mode');
    localStorage.removeItem('tutorial-progress');
  });
  
  // Navigate to root
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Wait for React to render
  await page.waitForTimeout(5000);
  
  // Print console messages
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));
  
  // Print page errors
  console.log('\n=== Page Errors ===');
  if (pageErrors.length > 0) {
    pageErrors.forEach(err => console.log(err));
  } else {
    console.log('No page errors');
  }
  
  // Get page content
  const url = page.url();
  const h1Count = await page.locator('h1').count();
  const bodyText = await page.locator('body').textContent();
  
  console.log('\n=== Page Info ===');
  console.log('URL:', url);
  console.log('H1 elements:', h1Count);
  console.log('Body length:', bodyText?.length);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
  console.log('\nScreenshot saved');
});
