import { test, expect } from '@playwright/test';

const openSettingsFromDashboard = async (page: import('@playwright/test').Page) => {
  await expect(page.getByRole('heading', { name: 'Top Records', exact: true })).toBeVisible();
  await page.locator('aside').getByText('Profile', { exact: true }).click();
  await expect(page).toHaveURL('/profile');
  await page.getByRole('button', { name: 'Settings' }).click();
};

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/users/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
      });
    });
    // Mock analytics to prevent errors on dashboard load
    await page.route('**/api/analytics/recent*', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.route('**/api/analytics/top*', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should navigate to settings', async ({ page }) => {
    await openSettingsFromDashboard(page);
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('should contain Discogs connection form in settings', async ({ page }) => {
    await openSettingsFromDashboard(page);
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Discogs Integration')).toBeVisible();
  });
});
