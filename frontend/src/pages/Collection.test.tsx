import { render, screen, fireEvent, waitFor } from '../test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Collection from './Collection';
import * as api from '../services/api';
import * as useAuthHook from '../context/useAuth';
 
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
 
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      updateDiscogs: vi.fn(),
      isLoading: false,
      isSyncing: false,
      performSync: vi.fn(),
      resetAllListens: vi.fn(),
    });
  });
 
  it('renders collection page and fetches data', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 2, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });
 
    render(<Collection />);
 
    // Check for skeleton loader instead of text
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
 
    await waitFor(() => {
      expect(screen.getAllByText('Album One')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Album Two')[0]).toBeInTheDocument();
    });
 
    expect(mockGetCollection).toHaveBeenCalledWith(
      'TestUser',
      1,
      50,
      0,
      'artist',
      'asc',
      '',
      expect.any(Object)
    );
  });
 
  it('renders empty state correctly', async () => {
    mockGetCollection.mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });
 
    render(<Collection />);
 
    await waitFor(() => {
      expect(screen.getByText('Your collection is empty')).toBeInTheDocument();
    });
  });
 
  it('handles "Played Only" filter', async () => {
    mockGetCollection.mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });
 
    render(<Collection />);
 
    const filterButton = screen.getByText('Played Only');
    fireEvent.click(filterButton);
 
    await waitFor(() => {
      // Should fetch with minPlays = 1
      expect(mockGetCollection).toHaveBeenLastCalledWith(
        'TestUser',
        1,
        50,
        1,
        'artist',
        'asc',
        '',
        expect.any(Object)
      );
    });
  });
 
  it('handles selection of items', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 2, page: 1, pages: 1, per_page: 50, urls: { next: '' } },
    });
 
    render(<Collection />);
 
    await waitFor(() => {
      expect(screen.getAllByText('Album One')[0]).toBeInTheDocument();
    });
 
    // Click first item to select
    const item1 = screen.getAllByText('Album One')[0].closest('.group');
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
 
    render(<Collection />);
    await waitFor(() => expect(screen.getAllByText('Album One')[0]).toBeInTheDocument());
 
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
 
    render(<Collection />);
    await waitFor(() => expect(screen.getAllByText('Album One')[0]).toBeInTheDocument());
 
    // Select one item
    const item1 = screen.getAllByText('Album One')[0].closest('.group');
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
 
    render(<Collection />);
 
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
 
    render(<Collection />);
    await waitFor(() => expect(screen.getAllByText('Album One')[0]).toBeInTheDocument());
 
    const nextBtn = screen.getByText('>');
    fireEvent.click(nextBtn);
 
    await waitFor(() => {
      expect(mockGetCollection).toHaveBeenLastCalledWith(
        'TestUser',
        2,
        50,
        0,
        'artist',
        'asc',
        '',
        expect.any(Object)
      );
    });
  });
 
  it('handles sorting and items per page changes', async () => {
    mockGetCollection.mockResolvedValue({
      releases: mockReleases,
      pagination: { items: 100, page: 1, pages: 2, per_page: 50, urls: { next: '' } },
    });
 
    render(<Collection />);
    await waitFor(() => expect(screen.getAllByText('Album One')[0]).toBeInTheDocument());
 
    // Change sort to listens
    const sortSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(sortSelect, { target: { value: 'listens' } });
 
    await waitFor(() => {
      expect(mockGetCollection).toHaveBeenLastCalledWith(
        'TestUser',
        1,
        50,
        0,
        'listens',
        'asc',
        '',
        expect.any(Object)
      );
    });
 
    // Change sort order
    const sortOrderBtn = screen.getByTitle('Ascending');
    fireEvent.click(sortOrderBtn);
 
    await waitFor(() => {
      expect(mockGetCollection).toHaveBeenLastCalledWith(
        'TestUser',
        1,
        50,
        0,
        'listens',
        'desc',
        '',
        expect.any(Object)
      );
    });
 
    // Change perPage
    const perPageSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(perPageSelect, { target: { value: '20' } });
 
    await waitFor(() => {
      expect(mockGetCollection).toHaveBeenLastCalledWith(
        'TestUser',
        1,
        20,
        0,
        'listens',
        'desc',
        '',
        expect.any(Object)
      );
    });
  });
});
