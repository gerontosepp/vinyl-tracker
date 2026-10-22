import { test, expect } from '@playwright/test';

// 1×1 px PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Label photo inbox', () => {
  test.beforeEach(async ({ page }) => {
    // Unrelated dashboard requests get empty answers (registered first, so specific routes win)
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/users/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser', token: 'fake-jwt-token' }),
      });
    });

    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
  });

  test('uploads a label photo from the scanner as JPEG', async ({ page }) => {
    let uploadedType: string | undefined;
    await page.route('**/api/label-photos*', async (route) => {
      if (route.request().method() === 'POST') {
        uploadedType = route.request().headers()['content-type'];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 5, pendingCount: 2 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ photos: [], pendingCount: 1 }),
        });
      }
    });

    await page.locator('aside').getByRole('button', { name: 'Scan' }).click();
    await expect(page.getByRole('button', { name: 'Take label photo' })).toBeVisible();
    await expect(page.getByTestId('label-inbox-count')).toHaveText('1 in inbox');

    await page.getByTestId('label-photo-input').setInputFiles({
      name: 'label.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    await expect(page.getByText('Photo saved to the label inbox (2 open).')).toBeVisible();
    await expect(page.getByTestId('label-inbox-count')).toHaveText('2 in inbox');
    expect(uploadedType).toBe('image/jpeg');
  });
});
