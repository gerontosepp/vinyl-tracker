import { render, screen, fireEvent, waitFor, act } from '../test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../pages/Dashboard';
import * as useAuthHook from '../context/useAuth';
import * as api from '../services/api';
 
// Mock Dependencies
vi.mock('../context/useAuth');
 
vi.mock('../services/api', () => ({
  getRecentListens: vi.fn(),
  getTopRecords: vi.fn(),
  scanBarcode: vi.fn(),
  getProxiedImageUrl: vi.fn((url) => `/proxy?url=${url}`),
  getCollection: vi.fn().mockResolvedValue({
    releases: [],
    pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: {} },
  }),
  getUser: vi.fn().mockResolvedValue(null),
}));
 
// Mock html5-qrcode (Same mock as in BarcodeScanner.test.tsx)
const mockRender = vi.fn();
const mockClear = vi.fn().mockResolvedValue(undefined);
 
vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: vi.fn().mockImplementation(function () {
    return {
      render: mockRender,
      clear: mockClear,
    };
  }),
}));
 
describe('Integration: Scan to Collection Flow', () => {
  const mockUser = { username: 'integration-user', id: 1 };
 
  // Test Data
  const initialRecentListens: any[] = [];
  const updatedRecentListens = [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      record: {
        discogsId: 12345,
        title: 'Integration Test Album',
        artist: 'Test Artist',
        thumbUrl: '/test-thumb.jpg',
      },
    },
  ];
 
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
 
    // Default API behaviors
    vi.mocked(api.getRecentListens).mockResolvedValue(initialRecentListens);
    vi.mocked(api.getTopRecords).mockResolvedValue([]);
    vi.mocked(api.scanBarcode).mockResolvedValue({
      success: true,
      message: 'Scanned',
      record: updatedRecentListens[0].record,
    });
 
    // Setup Scanner Mock to auto-scan when rendered
    mockRender.mockImplementation((_successCallback: (text: string) => void) => {
    });
  });
 
  it('completes full scan flow and updates dashboard', async () => {
    render(<Dashboard />);
 
    // 1. Initial Load - verify empty state
    await waitFor(() => {
      expect(api.getRecentListens).toHaveBeenCalledWith(
        'integration-user',
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });
    expect(screen.getByText(/No recent listens/i)).toBeInTheDocument();
 
    // 2. Open Scanner
    const scanButton = screen.getAllByRole('button', { name: /scan/i })[0];
    fireEvent.click(scanButton);
 
    // Verify Scanner is shown
    expect(screen.getByText(/Scan Vinyl Barcode/i)).toBeInTheDocument();
 
    // 3. Simulate Successful Scan
    await waitFor(() => {
      expect(mockRender).toHaveBeenCalled();
    });
    const scanCallback = mockRender.mock.calls[0][0]; // First arg of first call
    expect(scanCallback).toBeDefined();
 
    await act(async () => {
      scanCallback('123456');
    });
 
    // Verify API called
    expect(api.scanBarcode).toHaveBeenCalledWith('123456', 'integration-user');
 
    // Verify Success Message in Scanner
    expect(await screen.findByText(/Success!/i)).toBeInTheDocument();
    expect(screen.getByText(/Integration Test Album/i)).toBeInTheDocument();
 
    // 4. Close Scanner / Return to Dashboard
    // Update mock for getRecentListens to return NEW data now
    vi.mocked(api.getRecentListens).mockResolvedValue(updatedRecentListens);
 
    const backButton = screen.getByText(/Back to Dashboard/i);
    fireEvent.click(backButton);
 
    // 5. Verify Dashboard Updates
    await waitFor(() => {
      // It should be called again at least once more
      expect(api.getRecentListens).toHaveBeenCalledTimes(3);
    }, { timeout: 4000 });
 
    // Verify new data is displayed
    expect(await screen.findByText(/Integration Test Album/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Artist/i)).toBeInTheDocument();
    // "No recent listens" should be gone
    expect(screen.queryByText(/No recent listens/i)).not.toBeInTheDocument();
  });
});
