import { renderHook, act } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from './ToastContext';
import { useAuth } from './useAuth';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as api from '../services/api';
 
// Mock dependencies
vi.mock('../services/api');
 
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <AuthProvider>{children}</AuthProvider>
  </ToastProvider>
);
 
describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getUser).mockImplementation(() => new Promise(() => {}));
  });
 
  it('provides default values', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });
 
  it('login updates user state on success', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    vi.mocked(api.loginUser).mockResolvedValue(mockUser);
 
    const { result } = renderHook(() => useAuth(), { wrapper });
 
    await act(async () => {
      await result.current.login('testuser', 'password');
    });
 
    expect(result.current.user).toEqual(mockUser);
  });
 
  it('login handles failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.loginUser).mockRejectedValue(new Error('Login failed'));
 
    const { result } = renderHook(() => useAuth(), { wrapper });
 
    await act(async () => {
      try {
        await result.current.login('testuser', 'wrongpass');
      } catch (e: any) {
        expect(e.message).toBe('Login failed');
      }
    });
 
    expect(result.current.user).toBeNull();
    consoleSpy.mockRestore();
  });
 
  it('register updates user state on success', async () => {
    const mockUser = { id: 1, username: 'newuser' };
    vi.mocked(api.registerUser).mockResolvedValue(mockUser);
 
    const { result } = renderHook(() => useAuth(), { wrapper });
 
    await act(async () => {
      await result.current.register('newuser', 'password');
    });
 
    expect(result.current.user).toEqual(mockUser);
  });
 
  it('updateDiscogs updates user state on success', async () => {
    const initialUser = { id: 1, username: 'testuser', discogsUsername: 'old' };
    const updatedUser = { id: 1, username: 'testuser', discogsUsername: 'new' };
 
    vi.mocked(api.loginUser).mockResolvedValue(initialUser);
    vi.mocked(api.updateDiscogsSettings).mockResolvedValue(updatedUser);
 
    const { result } = renderHook(() => useAuth(), { wrapper });
 
    // Set initial user
    await act(async () => {
      await result.current.login('testuser', 'password');
    });
 
    await act(async () => {
      await result.current.updateDiscogs('new', 'token', 'password');
    });
 
    expect(result.current.user).toEqual(updatedUser);
  });
 
  it('logout clears user state', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    vi.mocked(api.loginUser).mockResolvedValue(mockUser);
    vi.mocked(api.logoutUser).mockResolvedValue();
 
    const { result } = renderHook(() => useAuth(), { wrapper });
 
    await act(async () => {
      await result.current.login('testuser', 'password');
    });
 
    act(() => {
      result.current.logout();
    });
 
    expect(result.current.user).toBeNull();
    expect(api.logoutUser).toHaveBeenCalled();
  });
});
