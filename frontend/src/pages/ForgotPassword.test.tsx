import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ForgotPassword from './ForgotPassword';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

// Mock dependencies
vi.mock('../services/api', () => ({
  resetPassword: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ForgotPassword Component', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  it('renders form correctly', () => {
    render(<ForgotPassword />);

    expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Re-enter your Discogs Token/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
  });

  it('validates password mismatch', async () => {
    render(<ForgotPassword />);

    const newPass = screen.getByLabelText(/^New Password$/i);
    const confirmPass = screen.getByLabelText(/^Confirm New Password$/i);
    const username = screen.getByLabelText(/^Username$/i);
    const token = screen.getByPlaceholderText(/Re-enter your Discogs Token/i);
    const button = screen.getByRole('button', { name: /Reset Password/i });

    fireEvent.change(username, { target: { value: 'testuser' } });
    fireEvent.change(token, { target: { value: 'token' } });
    fireEvent.change(newPass, { target: { value: 'password123' } });
    fireEvent.change(confirmPass, { target: { value: 'mismatch' } });
    fireEvent.click(button);

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('submits form successfully', async () => {
    (api.resetPassword as any).mockResolvedValue({});

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password$/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter your Discogs Token/i), {
      target: { value: 'token123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(api.resetPassword).toHaveBeenCalledWith('testuser', 'password123', 'token123');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('handles api error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (api.resetPassword as any).mockRejectedValue(new Error('Failed'));

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password$/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter your Discogs Token/i), {
      target: { value: 'token123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to reset password/i)).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });
});
