import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../services/api';
import * as authContext from '../context/AuthContext';

// Mock dependencies
vi.mock('../services/api');
vi.mock('../components/BarcodeScanner', () => ({
    default: () => <div data-testid="barcode-scanner">Mock Scanner</div>,
}));
// ResizeObserver mock for Recharts
window.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('Dashboard Component', () => {
    const mockUser = { id: 1, username: 'testuser', token: 'token' };
    const mockLogout = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Default logged in user
        vi.spyOn(authContext, 'useAuth').mockReturnValue({
            user: mockUser,
            login: vi.fn(),
            register: vi.fn(),
            updateDiscogs: vi.fn(),
            logout: mockLogout,
            isLoading: false,
        });
        // Default API responses
        vi.spyOn(api, 'getTopRecords').mockResolvedValue([
            { name: 'Radiohead', count: 5 },
            { name: 'Beatles', count: 3 },
        ]);
        vi.spyOn(api, 'getRecentListens').mockResolvedValue([
            {
                id: 1,
                record: {
                    discogsId: 101, title: 'In Rainbows', artist: 'Radiohead', thumbUrl: ''
                },
                timestamp: new Date().toISOString()
            },
        ]);
    });

    it('renders dashboard with user info and data', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        expect(screen.getByText('Vinyl Tracker')).toBeInTheDocument();
        expect(screen.getByText('testuser')).toBeInTheDocument();

        // Check for SCAN RECORD button
        expect(screen.getByText('SCAN RECORD')).toBeInTheDocument();

        // specific elements should appear after data load
        await waitFor(() => {
            expect(screen.getByText('In Rainbows')).toBeInTheDocument();
        });
    });

    it('toggles scanner view', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        const scanButton = screen.getByText('SCAN RECORD');
        fireEvent.click(scanButton);

        expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();

        const backButton = screen.getByText(/Back to Dashboard/i);
        fireEvent.click(backButton);

        expect(screen.queryByTestId('barcode-scanner')).not.toBeInTheDocument();
    });

    it('handles delete scan', async () => {
        // Mock window.confirm
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const deleteScanSpy = vi.spyOn(api, 'deleteScan').mockResolvedValue();

        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        // Wait for list to load
        await waitFor(() => {
            expect(screen.getByText('In Rainbows')).toBeInTheDocument();
        });

        // Find delete button (by title or role)
        const deleteButton = screen.getByTitle('Delete Scan');
        fireEvent.click(deleteButton);

        expect(confirmSpy).toHaveBeenCalledWith('Delete this scan?');

        await waitFor(() => {
            expect(deleteScanSpy).toHaveBeenCalledWith(1, 'testuser');
        });

        // Verify item is removed from list (optimistically or via re-render logic in component)
        // The component updates state deeply, waiting might be needed
        await waitFor(() => {
            expect(screen.queryByText('In Rainbows')).not.toBeInTheDocument();
        });
    });

    it('cancels delete scan', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const deleteScanSpy = vi.spyOn(api, 'deleteScan');

        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        await waitFor(() => screen.getByText('In Rainbows'));

        const deleteButton = screen.getByTitle('Delete Scan');
        fireEvent.click(deleteButton);

        expect(confirmSpy).toHaveBeenCalled();
        expect(deleteScanSpy).not.toHaveBeenCalled();
    });
});
