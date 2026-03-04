import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { loginUser, registerUser, updateDiscogsSettings } from '../services/api';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  updateDiscogs: (discogsUsername: string, token: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  syncMessage: string;
  performSync: (username: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const performSync = async (usernameToSync: string) => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const api = await import('../services/api');
      const result = await api.forceSyncCollection(usernameToSync);
      const added = result?.added || 0;
      const removed = result?.removed || 0;
      setSyncMessage(`Synced successfully! Added: ${added}, Removed: ${removed}`);
    } catch (error) {
      console.error('Background sync failed', error);
      setSyncMessage('Failed to synchronize collection.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000); // Clear toast after 5s
    }
  };

  useEffect(() => {
    // Attempt auto-login if token exists
    const token = localStorage.getItem('vinyl_token');
    const username = localStorage.getItem('vinyl_user');
    if (token && username) {
      import('../services/api').then((api) => {
        api
          .getUser(username)
          .then((u) => setUser(u))
          .catch(() => logout());
      });
    }
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const userData = await loginUser(username, password);
      // Wait, token is included in userData now
      if (userData.token) {
        localStorage.setItem('vinyl_token', userData.token);
      }
      setUser(userData);
      localStorage.setItem('vinyl_user', username);

      // Trigger background sync non-blocking, but only if they have Discogs integration configured
      if (userData.discogsUsername) {
        performSync(username).catch(console.error);
      }
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const userData = await registerUser(username, password);
      if (userData.token) {
        localStorage.setItem('vinyl_token', userData.token);
      }
      setUser(userData);
      localStorage.setItem('vinyl_user', username);
    } catch (error) {
      console.error('Registration failed', error);
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
      // Trigger background sync non-blocking
      performSync(updatedUser.username).catch(console.error);
    } catch (error) {
      console.error('Update settings failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vinyl_user');
    localStorage.removeItem('vinyl_token');
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
        syncMessage,
        performSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
