import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock login and data
    await page.route('**/api/users/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser', token: 'fake-jwt-token' }),
      });
    });

    // Mock dashboard data with some content
    await page.route('**/api/analytics/recent*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            timestamp: new Date().toISOString(),
            record: { title: 'Test Album', artist: 'Test Artist', thumbUrl: '' },
          },
        ]),
      });
    });

    await page.route('**/api/analytics/top*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ key: 'Test Artist', value: 5 }]),
      });
    });

    // Login for each test
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should display dashboard sections', async ({ page }) => {
    await expect(page.getByText('Top Records')).toBeVisible();
    await expect(page.getByText('Recent Listens')).toBeVisible();
    await expect(page.getByText('Test Album')).toBeVisible();
    await expect(page.getByText('Test Artist').first()).toBeVisible();
  });

  test('should toggle scanner', async ({ page }) => {
    const scanButton = page.getByRole('button', { name: 'SCAN RECORD' });
    await expect(scanButton).toBeVisible();
    await scanButton.click();

    await expect(page.getByText('Back to Dashboard')).toBeVisible();
    // Verify scanner container or elements
    // Since camera might not work in CI/headless, we look for the component structure
    // e.g., the fallback or the video element
    // await expect(page.locator('#html5-qrcode-reader')).toBeVisible(); // example ID if used

    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(scanButton).toBeVisible();
  });
});
