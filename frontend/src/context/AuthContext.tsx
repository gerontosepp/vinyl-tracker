import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { getUser, createUser } from '../services/api';

interface AuthContextType {
    user: User | null;
    login: (username: string, token?: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const savedUsername = localStorage.getItem('vinyl_user');
        if (savedUsername) {
            login(savedUsername, '');
        }
    }, []);

    const login = async (username: string, token: string = '') => {
        setIsLoading(true);
        try {
            let userData: User;
            if (token) {
                // If token provided, try to create/update user
                // Assuming username is same as discogsUsername for now as per README
                userData = await createUser(username, token, username);
            } else {
                userData = await getUser(username);
            }
            setUser(userData);
            localStorage.setItem('vinyl_user', username);
        } catch (error) {
            console.error("Login failed", error);
            // Propagate error to show in UI
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('vinyl_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
