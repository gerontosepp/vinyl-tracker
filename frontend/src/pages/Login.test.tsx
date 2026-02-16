import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
vi.mock('../services/api', () => ({
  getUser: vi.fn(),
  loginUser: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
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
    (useAuth as any).mockReturnValue({ login: mockLoginContext, isLoading: false });
  });

  it('renders login form correctly', () => {
    render(<Login />);

    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('updates input value on change', () => {
    render(<Login />);

    const usernameInput = screen.getByPlaceholderText(/username/i) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(usernameInput.value).toBe('testuser');
    expect(passwordInput.value).toBe('password123');
  });

  it('handles successful login', async () => {
    mockLoginContext.mockResolvedValue(undefined); // login returns void promise

    render(<Login />);

    const usernameInput = screen.getByPlaceholderText(/username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const button = screen.getByRole('button', { name: /login/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockLoginContext).toHaveBeenCalledWith('testuser', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('handles failed login', async () => {
    mockLoginContext.mockRejectedValue(new Error('Login failed'));

    render(<Login />);

    const usernameInput = screen.getByPlaceholderText(/username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    const button = screen.getByRole('button', { name: /login/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockLoginContext).toHaveBeenCalledWith('wronguser', 'wrongpass');
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
    });
  });
});
