import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BarcodeScanner from './BarcodeScanner';
import { scanBarcode } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
vi.mock('../services/api', () => ({
    scanBarcode: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Mock html5-qrcode
const mockRender = vi.fn();
const mockClear = vi.fn().mockResolvedValue(undefined);

vi.mock('html5-qrcode', () => {
    return {
        Html5QrcodeScanner: vi.fn().mockImplementation(function () {
            return {
                render: mockRender,
                clear: mockClear,
            };
        }),
    };
});

describe('BarcodeScanner Component', () => {
    const mockUser = { username: 'testuser' };

    beforeEach(async () => {
        vi.clearAllMocks();
        (useAuth as any).mockReturnValue({ user: mockUser });

        mockRender.mockImplementation((successCallback: (text: string) => void) => {
            // Default implementation
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders scanner container', () => {
        render(<BarcodeScanner />);
        expect(screen.getByText(/scan vinyl barcode/i)).toBeInTheDocument();
        expect(document.getElementById('reader')).toBeInTheDocument();
    });

    it('initializes scanner on mount', () => {
        render(<BarcodeScanner />);
        expect(mockRender).toHaveBeenCalled();
    });

    it('handles successful scan', async () => {
        const mockResult = { success: true, message: 'Scanned', record: { title: 'Album' } };
        (scanBarcode as any).mockResolvedValue(mockResult);

        // Setup mock to call success callback immediately
        mockRender.mockImplementation((successCallback: (text: string) => void) => {
            successCallback('123456');
        });

        render(<BarcodeScanner />);

        await act(async () => {
            // Wait for async operations in useEffect/callbacks
        });

        expect(scanBarcode).toHaveBeenCalledWith('123456', 'testuser');
        expect(await screen.findByText(/Scanned/i)).toBeInTheDocument();
    });

    it('handles scan error', async () => {
        (scanBarcode as any).mockRejectedValue(new Error('Scan failed'));

        mockRender.mockImplementation((successCallback: (text: string) => void) => {
            successCallback('error-barcode');
        });

        render(<BarcodeScanner />);

        await act(async () => {
            // Wait for async operations
        });

        expect(scanBarcode).toHaveBeenCalledWith('error-barcode', 'testuser');
        expect(await screen.findByText(/Network error or backend failure/i)).toBeInTheDocument();
    });
});
