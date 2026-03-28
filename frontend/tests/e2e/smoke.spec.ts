import { expect, test } from '@playwright/test';

test('login page is reachable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
});
