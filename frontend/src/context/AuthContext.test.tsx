import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as api from '../services/api';

// Mock dependencies
vi.mock('../services/api');

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('provides default values', () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        expect(result.current.user).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('login updates user state on success', async () => {
        const mockUser = { id: 1, username: 'testuser' };
        vi.mocked(api.loginUser).mockResolvedValue(mockUser);

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.login('testuser', 'password');
        });

        expect(result.current.user).toEqual(mockUser);
        expect(localStorage.getItem('vinyl_user')).toBe('testuser');
    });

    it('login handles failure', async () => {
        vi.mocked(api.loginUser).mockRejectedValue(new Error('Login failed'));

        const { result } = renderHook(() => useAuth(), { wrapper });

        await expect(result.current.login('testuser', 'wrongpass')).rejects.toThrow('Login failed');
        expect(result.current.user).toBeNull();
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

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.login('testuser', 'password');
        });

        act(() => {
            result.current.logout();
        });

        expect(result.current.user).toBeNull();
        expect(localStorage.getItem('vinyl_user')).toBeNull();
    });
});
