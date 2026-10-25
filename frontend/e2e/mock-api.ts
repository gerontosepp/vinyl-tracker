import { Page } from '@playwright/test';

/**
 * For specs that only mock the login and have no real session: answers every API call the spec
 * does not mock itself, so none reaches the backend, whose 401 would log the app out (#253).
 * Call it before the spec's own `page.route` mocks – Playwright tries the latest route first.
 */
export async function mockUnhandledApi(page: Page): Promise<void> {
  await page.route('**/api/**', (route) => {
    const request = route.request();
    return route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        title: 'Not mocked',
        status: 404,
        detail: `${request.method()} ${new URL(request.url()).pathname} is not mocked in this spec`,
      }),
    });
  });
  // Label recognition settings on the settings page
  await page.route('**/api/users/me/openrouter', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hasApiKey: false,
        model: 'anthropic/claude-sonnet-5.5',
        defaultModel: 'anthropic/claude-sonnet-5.5',
      }),
    })
  );
}
