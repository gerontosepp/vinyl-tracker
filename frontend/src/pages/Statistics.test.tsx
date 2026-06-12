import { render, screen } from '../test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Statistics from './Statistics';
import * as useAuthHook from '../context/useAuth';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../context/useAuth');

describe('Statistics Component', () => {
  const mockUser = { id: 1, username: 'testuser', token: 'token', discogsUsername: 'testdiscogs' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      register: vi.fn(),
      updateDiscogs: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      isSyncing: false,
      performSync: vi.fn(),
      resetAllListens: vi.fn(),
    });

    vi.mocked(api.getCollectionValue).mockResolvedValue({
      minimum: { currency: 'USD', value: 1000 },
      median: { currency: 'USD', value: 1500 },
      maximum: { currency: 'USD', value: 2000 },
    });
    vi.mocked(api.getGenreBreakdown).mockResolvedValue([
      { name: 'Rock', value: 10 },
      { name: 'Jazz', value: 5 },
    ]);
    vi.mocked(api.getCollection).mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1 },
    } as any);
  });

  it('renders statistics page headers and loads data', async () => {
    render(<Statistics />);
    expect(await screen.findByText(/Collection Statistics/i)).toBeInTheDocument();

    // Find text with longer timeout
    await screen.findByText(/1[.,]000/, {}, { timeout: 4000 });
    await screen.findByText(/2[.,]000/, {}, { timeout: 4000 });
    await screen.findByText(/Rock/, {}, { timeout: 4000 });
    await screen.findByText(/Jazz/, {}, { timeout: 4000 });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(api.getCollectionValue).mockRejectedValue(new Error('Value Fail'));
    vi.mocked(api.getGenreBreakdown).mockRejectedValue(new Error('Genre Fail'));

    render(<Statistics />);

    // Increased timeouts to handle multiple sequential async calls
    await screen.findAllByText(/N\/A/i, {}, { timeout: 4000 });
    await screen.findAllByText(/Value Fail/i, {}, { timeout: 4000 });
    await screen.findAllByText(/Genre Fail/i, {}, { timeout: 4000 });
  });
});
