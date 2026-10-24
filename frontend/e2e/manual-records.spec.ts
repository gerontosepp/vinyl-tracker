import { test, expect, Route } from '@playwright/test';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const manualRecord = {
  id: 11,
  discogs_id: -1,
  title: "Embryo's Rache",
  artist: 'Embryo',
  year: '1996',
  genres: [],
  in_collection: true,
  instance_id: -1,
  listen_count: 0,
  tracklist: [],
  format: 'LP',
  formats: [],
  labels: [{ name: 'Schneeball', catno: '30561' }],
  source: 'manual',
};

const collectionRelease = {
  id: -1,
  instance_id: -1,
  date_added: '2026-10-24T12:00:00Z',
  rating: 0,
  listen_count: 0,
  source: 'manual',
  basic_information: {
    id: -1,
    title: "Embryo's Rache",
    artists: [{ name: 'Embryo' }],
    year: 1996,
    genres: [],
    styles: [],
    format: 'LP',
  },
};

test.describe('Manual records', () => {
  test.beforeEach(async ({ page }) => {
    // Unrelated API requests get empty answers (registered first, so specific routes win)
    await page.route('**/api/**', (route) => json(route, []));
    await page.route('**/api/users/me', (route) => json(route, { id: 1, username: 'testuser' }));
    await page.route('**/api/users/me/openrouter', (route) =>
      json(route, { hasApiKey: true, model: 'm', defaultModel: 'm' })
    );
    await page.route('**/api/users/login', (route) =>
      json(route, { id: 1, username: 'testuser', token: 'fake-jwt-token' })
    );
    await page.goto('/login');
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.getByPlaceholder('Enter your password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/');
  });

  test('creates a record from a label photo without Discogs match and marks it in the collection', async ({ page }) => {
    let created: Record<string, unknown> | null = null;
    await page.route('**/api/label-photos**', (route) => {
      const url = route.request().url();
      if (url.includes('/image')) {
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
      }
      const photos = created
        ? []
        : [
            {
              id: 1,
              status: 'pending',
              discogsId: null,
              createdAt: '2026-10-24T12:00:00Z',
              processedAt: null,
              identifyState: 'done',
              identifyError: 'Kein Eintrag bei Discogs',
              labelReading: { artist: 'Embryo', title: "Embryo's Rache", label: 'Schneeball', catno: '30561', year: '1996' },
            },
          ];
      return json(route, { photos, pendingCount: photos.length });
    });
    await page.route('**/api/records/manual', async (route) => {
      created = route.request().postDataJSON();
      await json(route, { record: manualRecord }, 201);
    });
    await page.route('**/api/collection?**', (route) =>
      json(route, { releases: created ? [collectionRelease] : [], pagination: { page: 1, pages: 1, per_page: 50, items: 1, urls: {} } })
    );

    await page.goto('/label-inbox');
    await expect(page.getByTestId('label-photo-no-match')).toContainText('No Discogs entry found.');
    await page.getByTestId('label-photo-manual').click();

    const form = page.getByTestId('manual-record-form');
    await expect(form.getByTestId('manual-artist')).toHaveValue('Embryo');
    await expect(form.getByTestId('manual-catno')).toHaveValue('30561');
    await form.getByTestId('manual-value').fill('20');
    await form.getByTestId('manual-record-save').click();

    await expect(page.getByTestId('manual-record-saved')).toContainText(`"Embryo's Rache" was added`);
    expect(created).toMatchObject({ artist: 'Embryo', catno: '30561', value: 20, labelPhotoId: 1 });
    await page.getByTestId('manual-record-done').click();
    await expect(page.getByTestId('label-inbox-photo')).toHaveCount(0);

    await page.goto('/collection');
    await expect(page.getByTestId('manual-badge').first()).toBeVisible();
  });
});
