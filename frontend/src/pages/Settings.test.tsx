import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import Settings from './Settings';
import * as AuthContext from '../context/AuthContext';

// Mock AuthContext
const mockUpdateDiscogs = vi.fn();
const mockUser = { id: 1, username: 'testuser', discogsUsername: 'testdiscogs' };

vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: mockUser,
    login: vi.fn(),
    register: vi.fn(),
    updateDiscogs: mockUpdateDiscogs,
    logout: vi.fn(),
    isLoading: false,
});

const renderComponent = () => {
    return render(
        <BrowserRouter>
            <Settings />
        </BrowserRouter>
    );
};

describe('Settings Component', () => {
    it('renders settings form with user data', () => {
        renderComponent();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByDisplayValue('testdiscogs')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Required to encrypt token')).toBeInTheDocument();
    });

    it('validates password requirement', async () => {
        renderComponent();

        fireEvent.change(screen.getByRole('textbox', { name: /Discogs Username/i }), { target: { value: 'newdiscogs' } });
        // Don't fill password

        fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

        // Since HTML5 validation blocks submission, updateDiscogs won't be called.
        // We can't easily check for the browser tooltip in jsdom, but we can verify no API call.
        await waitFor(() => {
            expect(mockUpdateDiscogs).not.toHaveBeenCalled();
        });
    });

    it('calls updateDiscogs on valid submission', async () => {
        renderComponent();

        fireEvent.change(screen.getByRole('textbox', { name: /Discogs Username/i }), { target: { value: 'newdiscogs' } });
        fireEvent.change(screen.getByLabelText(/New Discogs Token/i), { target: { value: 'newtoken' } });
        fireEvent.change(screen.getByPlaceholderText('Required to encrypt token'), { target: { value: 'password123' } });

        mockUpdateDiscogs.mockResolvedValueOnce({});

        fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

        await waitFor(() => {
            expect(mockUpdateDiscogs).toHaveBeenCalledWith('newdiscogs', 'newtoken', 'password123');
            expect(screen.getByText('Settings updated successfully!')).toBeInTheDocument();
        });
    });

    it('displays error on update failure', async () => {
        renderComponent();

        mockUpdateDiscogs.mockRejectedValueOnce(new Error('Update failed'));

        fireEvent.change(screen.getByPlaceholderText('Required to encrypt token'), { target: { value: 'wrongpassword' } });

        fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

        await waitFor(() => {
            expect(screen.getByText('Failed to update settings. Check your password.')).toBeInTheDocument();
        });
    });
});
