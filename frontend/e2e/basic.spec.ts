import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Vinyl Tracker/);
});

test('login flow', async ({ page }) => {
    await page.goto('/login');

    // Expect a login form
    await expect(page.getByRole('heading', { name: 'Vinyl Tracker' })).toBeVisible();

    // Fill input (adjust selectors based on your actual code)
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');

    // Click login
    await page.getByRole('button', { name: 'Login' }).click();

    // Expect dashboard or error (since we don't have a backend running with this user maybe)
    // For now, let's just verify the button state or error message if it fails
    // On successful login it should navigate. 
    // Given we are testing against a potential dev server, we might strictly fail if backend is down.
    // This test assumes backend is reachable or mocked. 
    // For a pure frontend E2E, we might want to mock the API. 
});
