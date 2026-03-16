import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Settings from './Settings';
import * as useAuthHook from '../context/useAuth';
import { ThemeProvider } from '../context/ThemeContext';
import * as useThemeHook from '../context/useTheme';
import * as api from '../services/api';

vi.mock('../services/api');
vi.spyOn(api, 'getCollection').mockResolvedValue({
  releases: [],
  pagination: { items: 0, page: 1, pages: 1, per_page: 50, urls: {} },
});

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/useTheme', () => ({
  useTheme: vi.fn(),
}));

// Mock AuthContext
const mockUpdateDiscogs = vi.fn();
const mockUser = { id: 1, username: 'testuser', discogsUsername: 'testdiscogs' };

vi.spyOn(useAuthHook, 'useAuth').mockReturnValue({
  user: mockUser,
  login: vi.fn(),
  register: vi.fn(),
  updateDiscogs: mockUpdateDiscogs,
  logout: vi.fn(),
  isLoading: false,
  isSyncing: false,
  syncMessage: '',
  performSync: vi.fn() as any, // Cast to any to avoid type complaints about missing promise return
});

vi.spyOn(useThemeHook, 'useTheme').mockReturnValue({
  theme: 'system',
  setTheme: vi.fn(),
});

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Settings Component', () => {
  it('renders settings form with user data', () => {
    renderComponent();
    expect(screen.getByText('Profile & Settings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('testdiscogs')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Required to encrypt token')).toBeInTheDocument();
  });

  it('validates password requirement', async () => {
    renderComponent();

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'newdiscogs' },
    });
    // Don't fill password

    fireEvent.click(screen.getByRole('button', { name: /Save Connectivity/i }));

    // Since HTML5 validation blocks submission, updateDiscogs won't be called.
    // We can't easily check for the browser tooltip in jsdom, but we can verify no API call.
    await waitFor(() => {
      expect(mockUpdateDiscogs).not.toHaveBeenCalled();
    });
  });

  it('calls updateDiscogs on valid submission', async () => {
    renderComponent();

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'newdiscogs' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter only if changing'), {
      target: { value: 'newtoken' },
    });
    fireEvent.change(screen.getByPlaceholderText('Required to encrypt token'), {
      target: { value: 'password123' },
    });

    mockUpdateDiscogs.mockResolvedValueOnce({});

    fireEvent.click(screen.getByRole('button', { name: /Save Connectivity/i }));

    await waitFor(() => {
      expect(mockUpdateDiscogs).toHaveBeenCalledWith('newdiscogs', 'newtoken', 'password123');
      expect(screen.getByText('Settings updated successfully!')).toBeInTheDocument();
    });
  });

  it('displays error on update failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderComponent();

    mockUpdateDiscogs.mockRejectedValueOnce(new Error('Update failed'));

    fireEvent.change(screen.getByPlaceholderText('Required to encrypt token'), {
      target: { value: 'wrongpassword' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Connectivity/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to update settings. Check your password.')
      ).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it('calls performSync when syncing button is clicked', () => {
    const mockPerformSync = vi.fn();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      register: vi.fn(),
      updateDiscogs: mockUpdateDiscogs,
      logout: vi.fn(),
      isLoading: false,
      isSyncing: false,
      syncMessage: '',
      performSync: mockPerformSync,
    });

    renderComponent();

    const syncBtn = screen.getByRole('button', { name: /Force Sync Collection/i });
    fireEvent.click(syncBtn);

    expect(mockPerformSync).toHaveBeenCalledWith('testuser');
  });
});
