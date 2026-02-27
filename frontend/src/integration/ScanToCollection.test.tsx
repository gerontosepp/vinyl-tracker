import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

// Mock Dependencies
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getRecentListens: vi.fn(),
  getTopRecords: vi.fn(),
  scanBarcode: vi.fn(),
  getProxiedImageUrl: vi.fn((url) => `/proxy?url=${url}`),
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

// Mock Recharts to avoid rendering issues in test environment
vi.mock('recharts', () => {
  const OriginalModule = vi.importActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 800, height: 800 }}>{children}</div>
    ),
    BarChart: () => <div>BarChart</div>,
    Bar: () => <div>Bar</div>,
    XAxis: () => <div>XAxis</div>,
    YAxis: () => <div>YAxis</div>,
    Tooltip: () => <div>Tooltip</div>,
    Cell: () => <div>Cell</div>,
  };
});

describe('Integration: Scan to Collection Flow', () => {
  const mockUser = { username: 'integration-user' };

  // Test Data
  const initialRecentListens: any[] = [];
  const updatedRecentListens = [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      record: {
        title: 'Integration Test Album',
        artist: 'Test Artist',
        thumbUrl: '/test-thumb.jpg',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockUser, logout: vi.fn() });

    // Default API behaviors
    (api.getRecentListens as any).mockResolvedValue(initialRecentListens);
    (api.getTopRecords as any).mockResolvedValue([]);
    (api.scanBarcode as any).mockResolvedValue({
      success: true,
      message: 'Scanned',
      record: updatedRecentListens[0].record,
    });

    // Setup Scanner Mock to auto-scan when rendered
    mockRender.mockImplementation((_successCallback: (text: string) => void) => {
      // Can Trigger scan manually or immediately
      // We'll trigger it manually in the test to control flow
    });
  });

  it('completes full scan flow and updates dashboard', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // 1. Initial Load - verify empty state
    await waitFor(() => {
      expect(api.getRecentListens).toHaveBeenCalledWith(
        'integration-user',
        expect.any(String),
        expect.any(String)
      );
    });
    expect(screen.getByText(/No recent listens/i)).toBeInTheDocument();

    // 2. Open Scanner
    const scanButton = screen.getAllByRole('button', { name: /scan/i })[0];
    fireEvent.click(scanButton);

    // Verify Scanner is shown
    expect(screen.getByText(/Scan Vinyl Barcode/i)).toBeInTheDocument();
    expect(screen.queryByText(/SCAN RECORD/i)).not.toBeInTheDocument(); // Button should be hidden

    // 3. Simulate Successful Scan
    // We need to trigger the successCallback passed to scanner.render
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
    (api.getRecentListens as any).mockResolvedValue(updatedRecentListens);

    const backButton = screen.getByText(/Back to Dashboard/i);
    fireEvent.click(backButton);

    // 5. Verify Dashboard Updates
    // Dashboard should reload data when scanner closes
    await waitFor(() => {
      // Should be called again (2nd time)
      expect(api.getRecentListens).toHaveBeenCalledTimes(3);
    });

    // Verify new data is displayed
    expect(await screen.findByText(/Integration Test Album/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Artist/i)).toBeInTheDocument();
    // "No records scanned yet" should be gone
    expect(screen.queryByText(/No recent listens/i)).not.toBeInTheDocument();
  });
});
