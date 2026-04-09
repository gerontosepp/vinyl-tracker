import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User } from '../types';
import {
  getUser,
  loginUser,
  logoutUser,
  registerUser,
  updateDiscogsSettings,
  resetAllListens as resetAllListensApi,
} from '../services/api';
import { getErrorMessage } from '../utils/error';
import { useToast } from '../context/ToastContext';
 
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  updateDiscogs: (discogsUsername: string, token: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  performSync: (username: string) => Promise<void>;
  resetAllListens: (username: string) => Promise<number>;
}
 
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
 
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();
  const syncInFlightRef = useRef<Promise<void> | null>(null);
 
  const performSync = async (usernameToSync: string) => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }
 
    const syncPromise = (async () => {
      setIsSyncing(true);
      try {
        const api = await import('../services/api');
        const result = await api.forceSyncCollection(usernameToSync);
        const added = result?.added || 0;
        const removed = result?.removed || 0;
        showToast(`Synced successfully! Added: ${added}, Removed: ${removed}`, 'success');
      } catch (error: unknown) {
        showToast(getErrorMessage(error, 'Failed to synchronize collection.'), 'error');
      } finally {
        setIsSyncing(false);
      }
    })();
 
    syncInFlightRef.current = syncPromise;
    try {
      await syncPromise;
    } finally {
      syncInFlightRef.current = null;
    }
  };
 
  const resetAllListens = async (username: string): Promise<number> => {
    setIsSyncing(true);
    try {
      const result = await resetAllListensApi(username);
      const deletedCount = result.deletedCount || 0;
      showToast(`Successfully deleted ${deletedCount} listening events`, 'success');
      return deletedCount;
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to reset listening history.'), 'error');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };
 
  useEffect(() => {
    if (typeof getUser !== 'function') {
      setIsLoading(false);
      return;
    }
    const userPromise = getUser('');
    if (userPromise && typeof userPromise.then === 'function') {
      userPromise
        .then((u) => setUser(u))
        .catch(() => setUser(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);
 
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const userData = await loginUser(username, password);
      setUser(userData);
      if (userData.discogsUsername) {
        performSync(username).catch(console.error);
      }
    } catch (error: unknown) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
 
  const register = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const userData = await registerUser(username, password);
      setUser(userData);
    } catch (error: unknown) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
 
  const updateDiscogs = async (discogsUsername: string, token: string, password: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const updatedUser = await updateDiscogsSettings(
        user.username,
        token,
        discogsUsername,
        password
      );
      setUser(updatedUser);
      performSync(updatedUser.username).catch(console.error);
    } catch (error: unknown) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
 
  const logout = () => {
    logoutUser().catch((error: unknown) => {
      console.error('Logout failed:', getErrorMessage(error, 'Unknown logout error'));
    });
    setUser(null);
  };
 
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        updateDiscogs,
        logout,
        isLoading,
        isSyncing,
        performSync,
        resetAllListens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
