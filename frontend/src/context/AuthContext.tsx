import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { getUser } from '../services/api';

interface AuthContextType {
    user: User | null;
    login: (username: string) => Promise<void>;
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
            login(savedUsername);
        }
    }, []);

    const login = async (username: string) => {
        setIsLoading(true);
        try {
            const userData = await getUser(username);
            setUser(userData);
            localStorage.setItem('vinyl_user', username);
        } catch (error) {
            console.error("Login failed", error);
            // For MVP, if user not found, we might redirect to register page, 
            // but here we just fail silenty or clear storage
            localStorage.removeItem('vinyl_user');
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
