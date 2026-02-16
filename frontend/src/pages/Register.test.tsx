import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import Register from './Register';
import * as AuthContext from '../context/AuthContext';

// Mock AuthContext
const mockRegister = vi.fn();

vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: null,
    login: vi.fn(),
    register: mockRegister,
    updateDiscogs: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
});

const renderComponent = () => {
    return render(
        <BrowserRouter>
            <Register />
        </BrowserRouter>
    );
};

describe('Register Component', () => {
    it('renders registration form', () => {
        renderComponent();
        expect(screen.getByRole('heading', { name: /Register/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Username/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument(); // Password input might not have role textbox
        expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    });

    it('shows error when passwords do not match', async () => {
        renderComponent();

        fireEvent.change(screen.getByRole('textbox', { name: /Username/i }), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
        fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password456' } });

        fireEvent.click(screen.getByRole('button', { name: /Register/i }));

        await waitFor(() => {
            expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
        });
        expect(mockRegister).not.toHaveBeenCalled();
    });

    it('calls register function when form is valid', async () => {
        renderComponent();

        fireEvent.change(screen.getByRole('textbox', { name: /Username/i }), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
        fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });

        mockRegister.mockResolvedValueOnce({}); // Simulate success

        fireEvent.click(screen.getByRole('button', { name: /Register/i }));

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith('newuser', 'password123');
        });
    });

    it('displays error message on registration failure', async () => {
        renderComponent();

        mockRegister.mockRejectedValueOnce(new Error('Registration failed'));

        fireEvent.change(screen.getByRole('textbox', { name: /Username/i }), { target: { value: 'existinguser' } });
        fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
        fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Register/i }));

        await waitFor(() => {
            expect(screen.getByText(/Registration failed/i)).toBeInTheDocument();
        });
    });
});
