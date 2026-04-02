import { render, screen, fireEvent, waitFor } from '../test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Settings from './Settings';
import * as useAuthHook from '../context/useAuth';
import * as useThemeHook from '../context/useTheme';
import * as api from '../services/api';
 
vi.mock('../services/api');
vi.mock('../context/useAuth');
vi.mock('../context/useTheme');
 
describe('Settings Component', () => {
  const mockUser = { id: 1, username: 'testuser', discogsUsername: 'testdiscogs' };
  const mockUpdateDiscogs = vi.fn();
  const mockPerformSync = vi.fn();
  const mockResetAllListens = vi.fn();
 
  beforeEach(() => {
    vi.clearAllMocks();
 
    vi.mocked(api.getCollection).mockResolvedValue({
      releases: [],
      pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: {} },
    });
 
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      register: vi.fn(),
      updateDiscogs: mockUpdateDiscogs,
      logout: vi.fn(),
      isLoading: false,
      isSyncing: false,
      performSync: mockPerformSync,
      resetAllListens: mockResetAllListens,
    });
 
    vi.mocked(useThemeHook.useTheme).mockReturnValue({
      theme: 'system',
      setTheme: vi.fn(),
    });
  });
 
  it('renders settings form with user data', () => {
    render(<Settings />);
    expect(screen.getByText('Profile & Settings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('testdiscogs')).toBeInTheDocument();
  });
 
  it('validates password requirement', async () => {
    render(<Settings />);
    const discogsInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(discogsInput, { target: { value: 'newdiscogs' } });
    // Submit form directly to bypass jsdom's HTML5 required-field validation,
    // so the JS handleSubmit runs and calls showToast
    const form = discogsInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockUpdateDiscogs).not.toHaveBeenCalled();
      // ToastProvider renders the toast message in the DOM
      expect(screen.getByText(/Current password is required to encrypt your token/i)).toBeInTheDocument();
    });
  });
 
  it('calls updateDiscogs on valid submission', async () => {
    render(<Settings />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'newdiscogs' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter only if changing/i), { target: { value: 'newtoken' } });
    fireEvent.change(screen.getByPlaceholderText(/Required to encrypt token/i), { target: { value: 'password123' } });
 
    mockUpdateDiscogs.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole('button', { name: /Save Connectivity/i }));
 
    await waitFor(() => {
      expect(mockUpdateDiscogs).toHaveBeenCalledWith('newdiscogs', 'newtoken', 'password123');
      expect(screen.getByText(/Settings updated successfully/i)).toBeInTheDocument();
    });
  });
 
  it('calls performSync when syncing button is clicked', () => {
    render(<Settings />);
    const syncBtn = screen.getByRole('button', { name: /Force Sync Collection/i });
    fireEvent.click(syncBtn);
    expect(mockPerformSync).toHaveBeenCalledWith('testuser');
  });
 
  it('shows reset confirmation dialog and handles reset', async () => {
    mockResetAllListens.mockResolvedValue(5);
    render(<Settings />);
 
    fireEvent.click(screen.getByRole('button', { name: /Reset All Listens/i }));
    expect(screen.getByText(/Reset All Listening Events\?/i)).toBeInTheDocument();
 
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }));
    await waitFor(() => {
      expect(mockResetAllListens).toHaveBeenCalledWith('testuser');
      expect(screen.queryByText(/Reset All Listening Events\?/i)).not.toBeInTheDocument();
    });
  });
});
