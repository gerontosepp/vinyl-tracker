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
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    <AuthContext.Provider value={{ user, login, register, updateDiscogs, logout, isLoading }}>
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
