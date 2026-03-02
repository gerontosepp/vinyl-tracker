import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Collection from './Collection';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../services/api';

// Mock API
vi.mock('../services/api');
const mockGetCollection = vi.mocked(api.getCollection);
const mockDownloadQrCodes = vi.mocked(api.downloadQrCodes);
const mockDownloadQrCodesSelected = vi.mocked(api.downloadQrCodesSelected);

// Mock URL.createObjectURL and revokeObjectURL
window.URL.createObjectURL = vi.fn(() => 'blob:url');
window.URL.revokeObjectURL = vi.fn();

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Collection Component', () => {
  const mockUser = {
    id: 1,
    username: 'TestUser',
    discogsUsername: 'TestDiscogs',
    token: 'token',
  };

  const mockReleases = [
    {
      id: 101,
      instance_id: 1,
      listen_count: 5,
      date_added: '2023-01-01',
      rating: 4,
      basic_information: {
        id: 101,
        title: 'Album One',
        year: 2020,
        thumb: 'thumb1.jpg',
        cover_image: 'cover1.jpg',
        artists: [{ name: 'Artist One' }],
        labels: [],
      },
    },
    {
      id: 102,
      instance_id: 2,
      listen_count: 0,
      date_added: '2023-01-02',
      rating: 0,
      basic_information: {
        id: 102,
        title: 'Album Two',
        year: 2021,
        thumb: '',
        cover_image: '',
        artists: [{ name: 'Artist Two' }],
        labels: [],
      },
    },
  ];

  const renderCollection = (user = mockUser) => {
    render(
      <AuthContext.Provider
        value={{
          user,
          login: vi.fn(),
          logout: vi.fn(),
          register: vi.fn(),
          updateDiscogs: vi.fn(),
          isLoading: false,
        }}
      >
        <BrowserRouter>
          <Collection />
        </BrowserRouter>
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collection page and fetches data', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 2, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });

    renderCollection();

    expect(screen.getByText('Loading collection...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Album One')).toBeInTheDocument();
      expect(screen.getByText('Album Two')).toBeInTheDocument();
    });

    expect(mockGetCollection).toHaveBeenCalledWith('TestUser', 1, 50, 0, 'artist', 'asc');
  });

  it('renders empty state correctly', async () => {
    mockGetCollection.mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });

    renderCollection();

    await waitFor(() => {
      expect(screen.getByText('No records found in your collection yet.')).toBeInTheDocument();
    });
  });

  it('handles "Played Only" filter', async () => {
    mockGetCollection.mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });

    renderCollection();

    const filterButton = screen.getByText('Played Only');
    fireEvent.click(filterButton);

    await waitFor(() => {
      // Should fetch with minPlays = 1
      expect(mockGetCollection).toHaveBeenLastCalledWith('TestUser', 1, 50, 1, 'artist', 'asc');
    });
  });

  it('handles selection of items', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 2, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });

    renderCollection();

    await waitFor(() => {
      expect(screen.getByText('Album One')).toBeInTheDocument();
    });

    // Click first item to select
    const item1 = screen.getByText('Album One').closest('div.group');
    fireEvent.click(item1!);

    // Check if QR Selected button updates
    await waitFor(() => {
      expect(screen.getByText('QR Selected (1)')).toBeInTheDocument();
    });

    // Click again to deselect
    fireEvent.click(item1!);
    await waitFor(() => {
      expect(screen.getByText('QR Selected (0)')).toBeInTheDocument();
    });
  });

  it('handles "Select Page" toggle', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 2, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });

    renderCollection();
    await waitFor(() => expect(screen.getByText('Album One')).toBeInTheDocument());

    const selectPageBtn = screen.getByText('Select Page');

    // Select All
    fireEvent.click(selectPageBtn);
    await waitFor(() => {
      expect(screen.getByText('QR Selected (2)')).toBeInTheDocument();
    });

    // Deselect All
    fireEvent.click(selectPageBtn);
    await waitFor(() => {
      expect(screen.getByText('QR Selected (0)')).toBeInTheDocument();
    });
  });

  it('handles QR Code generation for selected items', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 2, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });
    mockDownloadQrCodesSelected.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));

    renderCollection();
    await waitFor(() => expect(screen.getByText('Album One')).toBeInTheDocument());

    // Select one item
    const item1 = screen.getByText('Album One').closest('div.group');
    fireEvent.click(item1!);

    const downloadBtn = screen.getByText(/QR Selected/);
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockDownloadQrCodesSelected).toHaveBeenCalled();
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('handles QR Code generation for all items', async () => {
    // @ts-expect-error Testing error behavior
    mockGetCollection.mockResolvedValue({ releases: [], pagination: null });
    mockDownloadQrCodes.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);

    renderCollection();

    const downloadAllBtn = screen.getByText('QR All');
    fireEvent.click(downloadAllBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockDownloadQrCodes).toHaveBeenCalledWith('TestUser');
    });

    confirmSpy.mockRestore();
  });

  it('handles page navigation', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 100, page: 1, pages: 2, per_page: 50, urls: { next: '' } },
    });

    renderCollection();
    await waitFor(() => expect(screen.getByText('Album One')).toBeInTheDocument());

    const nextBtn = screen.getByText('>');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(mockGetCollection).toHaveBeenLastCalledWith('TestUser', 2, 50, 0, 'artist', 'asc');
    });
  });
});
