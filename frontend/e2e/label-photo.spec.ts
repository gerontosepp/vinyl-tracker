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
    await expect(page.getByTestId('label-inbox-count')).toContainText('1 in inbox');

    await page.getByTestId('label-photo-input').setInputFiles({
      name: 'label.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    await expect(page.getByText('Photo saved to the label inbox (2 open).')).toBeVisible();
    await expect(page.getByTestId('label-inbox-count')).toContainText('2 in inbox');
    expect(uploadedType).toBe('image/jpeg');
  });

  test('opens the inbox from the scanner and deletes photos', async ({ page }) => {
    let photos = [1, 2, 3].map((id) => ({
      id,
      status: 'pending',
      discogsId: null,
      createdAt: `2026-10-22T15:0${id}:00Z`,
      processedAt: null,
    }));
    const deleted: string[] = [];
    await page.route('**/api/label-photos**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith('/image')) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
      } else if (request.method() === 'DELETE') {
        deleted.push(url.pathname + url.search);
        const id = Number(url.pathname.split('/').pop());
        const count = Number.isNaN(id) ? photos.length : 1;
        photos = Number.isNaN(id) ? [] : photos.filter((p) => p.id !== id);
        await route.fulfill(
          Number.isNaN(id)
            ? { status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: count, pendingCount: 0 }) }
            : { status: 204 }
        );
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ photos, pendingCount: photos.length }),
        });
      }
    });

    await page.locator('aside').getByRole('button', { name: 'Scan' }).click();
    await page.getByTestId('label-inbox-count').click();

    await expect(page).toHaveURL('/label-inbox');
    await expect(page.getByRole('heading', { name: 'Label inbox' })).toBeVisible();
    await expect(page.getByTestId('label-inbox-photo')).toHaveCount(3);

    await page.getByTestId('label-inbox-delete').first().click();
    await expect(page.getByTestId('label-inbox-photo')).toHaveCount(2);
    await expect(page.getByText('Photo deleted.')).toBeVisible();

    await page.getByTestId('label-inbox-delete-all').click();
    await expect(page.getByText('Really delete all 2 open photos?')).toBeVisible();
    await page.getByTestId('label-inbox-confirm-delete-all').click();
    await expect(page.getByTestId('label-inbox-empty')).toHaveText('The label inbox is empty.');
    expect(deleted).toEqual(['/api/label-photos/1', '/api/label-photos?status=pending']);
  });
});
