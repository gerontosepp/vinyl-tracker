import { test, expect } from '@playwright/test';

const loginViaUi = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your username').fill('testuser');
  await page.getByPlaceholder('Enter your password').fill('password');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL('/');
};

const openSettingsFromDashboard = async (page: import('@playwright/test').Page) => {
  await expect(page.getByRole('heading', { name: 'Top Records', exact: true })).toBeVisible();
  await page.locator('aside').getByText('Profile', { exact: true }).click();
  await expect(page).toHaveURL('/profile');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page).toHaveURL('/settings');
};

test.describe('Settings Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/users/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'testuser',
          token: 'fake-jwt-token',
          discogsUsername: 'discogs-user',
        }),
      });
    });

    await page.route('**/api/analytics/recent*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/analytics/top*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('should show success toast after manual sync', async ({ page }) => {
    await page.route('**/api/collection/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ added: 3, removed: 1 }),
      });
    });

    await loginViaUi(page);
    await openSettingsFromDashboard(page);

    const syncButton = page.getByRole('button', { name: 'Force Sync Collection' });
    await syncButton.click();

    await expect(page.getByText('Syncing Discogs Collection...')).toBeVisible();
    await expect(page.getByText('Synced successfully! Added: 3, Removed: 1')).toBeVisible();
  });

  test('should show error toast when manual sync fails', async ({ page }) => {
    await page.route('**/api/collection/sync', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'sync failed' }),
      });
    });

    await loginViaUi(page);
    await openSettingsFromDashboard(page);

    await page.getByRole('button', { name: 'Force Sync Collection' }).click();

    await expect(page.getByText('Failed to synchronize collection.')).toBeVisible();
  });
});
