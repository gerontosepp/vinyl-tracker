import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
// import { getUser } from '../services/api'; // Login.tsx uses getUser
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
vi.mock('../services/api', () => ({
    getUser: vi.fn(),
    createUser: vi.fn(), // Login might create user if not found or handled differently
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('Login Component', () => {
    const mockNavigate = vi.fn();
    const mockLoginContext = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useNavigate as any).mockReturnValue(mockNavigate);
        (useAuth as any).mockReturnValue({ login: mockLoginContext });
    });

    it('renders login form correctly', () => {
        render(<Login />);

        expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    it('updates input value on change', () => {
        render(<Login />);

        const input = screen.getByPlaceholderText(/username/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'testuser' } });

        expect(input.value).toBe('testuser');
    });

    it('handles successful login', async () => {
        const mockUser = { id: 1, username: 'testuser' };
        mockLoginContext.mockResolvedValue(mockUser);

        render(<Login />);

        const input = screen.getByPlaceholderText(/username/i);
        fireEvent.change(input, { target: { value: 'testuser' } });

        const button = screen.getByRole('button', { name: /login/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockLoginContext).toHaveBeenCalledWith('testuser');
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    it('handles failed login', async () => {
        mockLoginContext.mockRejectedValue(new Error('User not found'));

        render(<Login />);

        const input = screen.getByPlaceholderText(/username/i);
        fireEvent.change(input, { target: { value: 'wronguser' } });

        const button = screen.getByRole('button', { name: /login/i });
        fireEvent.click(button);

        // Wait for error text - adjust string based on actual component error message
        // Based on previous test output which failed with "Login failed" not found,
        // we need to know what Login.tsx actually renders on error.
        // Assuming standard error handling for now.
        await waitFor(() => {
            expect(mockLoginContext).toHaveBeenCalledWith('wronguser');
            expect(screen.getByText(/login failed/i)).toBeInTheDocument();
        });
    });
});
