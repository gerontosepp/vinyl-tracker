import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import Dashboard from './Dashboard';
import * as api from '../services/api';
import * as useAuthHook from '../context/useAuth';
 
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
 
// Mock dependencies
vi.mock('../services/api');
vi.mock('../components/BarcodeScanner', () => ({
  default: () => <div data-testid="barcode-scanner">Mock Scanner</div>,
}));
// ResizeObserver mock for Recharts
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
 
describe('Dashboard Component', () => {
  const mockUser = { id: 1, username: 'testuser', token: 'token' };
  const mockLogout = vi.fn();
 
  beforeEach(() => {
    vi.clearAllMocks();
    // Default logged in user
    vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      register: vi.fn(),
      updateDiscogs: vi.fn(),
      logout: mockLogout,
      isLoading: false,
      isSyncing: false,
      performSync: vi.fn(),
      resetAllListens: vi.fn(),
    });
    // Default API responses
    vi.spyOn(api, 'getTopRecords').mockResolvedValue([
      { title: 'Radiohead', artist: 'Radiohead', thumbUrl: '', count: 5, recordTitle: 'Radiohead' },
      { title: 'Beatles', artist: 'Beatles', thumbUrl: '', count: 3, recordTitle: 'Beatles' },
    ]);
    vi.spyOn(api, 'getRecentListens').mockResolvedValue([
      {
        id: 1,
        record: {
          discogsId: 101,
          title: 'In Rainbows',
          artist: 'Radiohead',
          thumbUrl: '',
        },
        timestamp: new Date().toISOString(),
      },
    ]);
    vi.spyOn(api, 'getCollection').mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: {} },
    });
  });
 
  it('renders dashboard with user info and data', async () => {
    render(<Dashboard />);
 
    expect(screen.getAllByText(/Vinyl/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Tracker/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/testuser/i)[0]).toBeInTheDocument();
 
    // Check for SCAN RECORD button (updated to match new Sidebar/BottomNav)
    expect(screen.getAllByRole('button', { name: /scan/i })[0]).toBeInTheDocument();
 
    // specific elements should appear after data load
    await waitFor(() => {
      expect(screen.getByText('In Rainbows')).toBeInTheDocument();
    });
  });
 
  it('toggles scanner view', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('In Rainbows'));
 
    const scanButtons = screen.getAllByRole('button', { name: /scan/i });
    const scanButton = scanButtons[0]; // Either desktop or mobile button works
    fireEvent.click(scanButton);
 
    expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();
 
    const backButton = screen.getByText(/Back to Dashboard/i);
    fireEvent.click(backButton);
 
    await waitFor(() => {
      expect(screen.queryByTestId('barcode-scanner')).not.toBeInTheDocument();
    });
  });
 
  it('handles delete scan', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteScanSpy = vi.spyOn(api, 'deleteScan').mockResolvedValue();
 
    render(<Dashboard />);
 
    // Wait for list to load
    await waitFor(() => {
      expect(screen.getByText('In Rainbows')).toBeInTheDocument();
    });
 
    // Find delete button (by title or role)
    const deleteButton = screen.getByTitle('Delete Scan');
    fireEvent.click(deleteButton);
 
    expect(confirmSpy).toHaveBeenCalledWith('Delete this scan?');
 
    await waitFor(() => {
      expect(deleteScanSpy).toHaveBeenCalledWith(1, 'testuser');
    });
 
    // Verify item is removed from list (optimistically or via re-render logic in component)
    await waitFor(() => {
      expect(screen.queryByText('In Rainbows')).not.toBeInTheDocument();
    });
  });
 
  it('cancels delete scan', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteScanSpy = vi.spyOn(api, 'deleteScan');
 
    render(<Dashboard />);
 
    await waitFor(() => screen.getByText('In Rainbows'));
 
    const deleteButton = screen.getByTitle('Delete Scan');
    fireEvent.click(deleteButton);
 
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteScanSpy).not.toHaveBeenCalled();
  });
 
  it('handles date filtering interactions', async () => {
    vi.spyOn(api, 'getRecentListens').mockClear();
    vi.spyOn(api, 'getTopRecords').mockClear();
 
    render(<Dashboard />);
    await waitFor(() => screen.getByText('In Rainbows'));
 
    // Click All button first to clear dates
    const allBtn = screen.getByText('All');
    fireEvent.click(allBtn);
 
    await waitFor(() => {
      expect(api.getRecentListens).toHaveBeenCalledWith('testuser', '', '', expect.any(Object));
    });
 
    // Then click Today button to trigger change
    const todayBtn = screen.getByText('Today');
    fireEvent.click(todayBtn);
 
    const todayStr = getTodayString();
    await waitFor(() => {
      expect(api.getRecentListens).toHaveBeenCalledWith(
        'testuser',
        todayStr,
        todayStr,
        expect.any(Object)
      );
    });
 
    // Change input dates
    const startDateInput = screen.getByTitle('Start Date');
    const endDateInput = screen.getByTitle('End Date');
 
    fireEvent.change(startDateInput, { target: { value: '2023-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-12-31' } });
 
    await waitFor(() => {
      expect(api.getRecentListens).toHaveBeenCalledWith(
        'testuser',
        '2023-01-01',
        '2023-12-31',
        expect.any(Object)
      );
    });
  });
});
