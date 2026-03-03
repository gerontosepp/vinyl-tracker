import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Profile from './Profile';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Profile Component', () => {
  const mockLogout = vi.fn();
  const mockUser = {
    id: 1,
    username: 'TestUser',
    discogsUsername: 'TestDiscogs',
    token: 'token',
  };

  const renderProfile = (user: any = mockUser) => {
    render(
      <AuthContext.Provider
        value={{
          user,
          login: vi.fn(),
          logout: mockLogout,
          register: vi.fn(),
          updateDiscogs: vi.fn(),
          isLoading: false,
          isSyncing: false,
          syncMessage: '',
          performSync: vi.fn(),
        }}
      >
        <BrowserRouter>
          <Profile />
        </BrowserRouter>
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user information correcty', () => {
    renderProfile();

    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    // Check for the first letter avatar
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('navigates to settings when Settings button is clicked', () => {
    renderProfile();

    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('calls logout when Sign Out button is clicked', () => {
    renderProfile();

    const signOutButton = screen.getByText('Sign Out');
    fireEvent.click(signOutButton);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('renders correctly even if user is null (edge case handling)', () => {
    renderProfile(null);
    // Should not crash, might display empty user info or nothing specific depending on implementation
    // Based on code: {user?.username} -> empty
    // {user?.username?.charAt(0)} -> undefined

    // Asserting it renders the layout at least
    expect(screen.getByText('Member')).toBeInTheDocument();
  });
});
