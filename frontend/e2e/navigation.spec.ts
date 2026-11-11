import { test, expect } from '@playwright/test';
import { mockUnhandledApi } from './mock-api';

const openSettings = async (page: import('@playwright/test').Page) => {
  const profileNavItem = page.locator('aside').getByTestId('nav-settings');
  await expect(profileNavItem).toBeVisible();
  await profileNavItem.click();
  await expect(page).toHaveURL('/settings');
};

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login is mocked, so no call may reach the real backend (#253)
    await mockUnhandledApi(page);

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
    await page.route('**/api/analytics/collection/**', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.route('**/api/roon/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ host: '', port: 9330, paired: false }),
      });
    });

    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should navigate to settings', async ({ page }) => {
    await openSettings(page);
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('should contain Discogs connection form in settings', async ({ page }) => {
    await openSettings(page);
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Discogs Integration')).toBeVisible();
  });
});
