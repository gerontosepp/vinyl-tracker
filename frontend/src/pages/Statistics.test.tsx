import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Statistics from './Statistics';
import * as useAuthHook from '../context/useAuth';
import * as api from '../services/api';

vi.mock('../services/api');

describe('Statistics Component', () => {
  const mockUser = { id: 1, username: 'testuser', token: 'token', discogsUsername: 'testdiscogs' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      register: vi.fn(),
      updateDiscogs: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      isSyncing: false,
      syncMessage: '',
      performSync: vi.fn(),
      resetAllListens: vi.fn(),
    });

    vi.spyOn(api, 'getCollectionValue').mockResolvedValue({
      minimum: { currency: 'USD', value: 1000 },
      median: { currency: 'USD', value: 1500 },
      maximum: { currency: 'USD', value: 2000 },
    });
    vi.spyOn(api, 'getGenreBreakdown').mockResolvedValue([
      { name: 'Rock', value: 10 },
      { name: 'Jazz', value: 5 },
    ]);
    vi.spyOn(api, 'getCollection').mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: {} },
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Statistics />
      </BrowserRouter>
    );
  };

  it('renders statistics page headers and loads data', async () => {
    renderComponent();
    expect(screen.getByText('Collection Statistics')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Min: 1,000 / Max: 2,000')).toBeInTheDocument();
    });
    
    // Test that genres sum up to 15 correctly inside the donut
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Rock')).toBeInTheDocument();
      expect(screen.getByText('Jazz')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    vi.spyOn(api, 'getCollectionValue').mockRejectedValue(new Error('API Failure'));
    vi.spyOn(api, 'getGenreBreakdown').mockRejectedValue(new Error('API Failure'));

    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.getByText('Collection value currently unavailable.')).toBeInTheDocument();
      expect(screen.getByText('Genre breakdown currently unavailable.')).toBeInTheDocument();
    });
  });
});
