import { test, expect } from '@playwright/test';

test.describe('In-app help', () => {
  test.beforeEach(async ({ page }) => {
    // Unrelated API requests get empty answers (registered first, so specific routes win)
    await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/label-photos**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [], pendingCount: 0 }) })
    );
    // A full page load (page.goto) fetches the user again
    await page.route('**/api/users/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'testuser' }) })
    );
    await page.route('**/api/users/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser', token: 'fake-jwt-token' }),
      })
    );
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
  });

  test('opens the help from the sidebar and filters it by search', async ({ page }) => {
    await page.getByTestId('nav-help').click();
    await expect(page).toHaveURL('/help');
    await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
    await expect(page.getByTestId('help-section').first()).toBeVisible();
    expect(await page.getByTestId('help-section').count()).toBeGreaterThan(10);

    await page.getByTestId('help-search').fill('Kallax');
    await expect(page.getByTestId('help-section')).toHaveCount(1);
    await expect(page.getByTestId('help-section')).toContainText('Shelves');
  });

  test('context help jumps to the section of the page', async ({ page }) => {
    await page.goto('/label-inbox');
    await page.getByTestId('help-link').click();
    await expect(page).toHaveURL('/help#label-foto');
    await expect(page.locator('#label-foto')).toBeInViewport();
  });

  test('shows a tooltip for icon buttons on hover', async ({ page }) => {
    const languageButton = page.getByRole('button', { name: /^(en|de)$/i }).first();
    await languageButton.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Auf Deutsch wechseln');
  });
});
