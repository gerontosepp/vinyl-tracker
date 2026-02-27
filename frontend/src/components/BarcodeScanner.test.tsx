import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BarcodeScanner from './BarcodeScanner';
import { scanBarcode } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
vi.mock('../services/api', () => ({
  scanBarcode: vi.fn(),
  getProxiedImageUrl: vi.fn((url) => `/proxy?url=${url}`),
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

    mockRender.mockImplementation((_successCallback: (text: string) => void) => {
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

  it('initializes scanner on mount', async () => {
    render(<BarcodeScanner />);
    await waitFor(() => {
      expect(mockRender).toHaveBeenCalled();
    });
  });

  it('handles successful scan', async () => {
    const mockResult = { success: true, message: 'Scanned', record: { title: 'Album' } };
    (scanBarcode as any).mockResolvedValue(mockResult);

    render(<BarcodeScanner />);

    // Wait for scanner to be rendered
    await waitFor(() => {
      expect(mockRender).toHaveBeenCalled();
    });

    // Get the success callback passed to render
    const successCallback = mockRender.mock.calls[0][0];

    // Simulate scan
    await act(async () => {
      await successCallback('123456');
    });

    expect(scanBarcode).toHaveBeenCalledWith('123456', 'testuser');
    expect(await screen.findByText(/Scanned/i)).toBeInTheDocument();
  });

  it('handles scan error', async () => {
    (scanBarcode as any).mockRejectedValue(new Error('Scan failed'));

    render(<BarcodeScanner />);

    // Wait for scanner to be rendered
    await waitFor(() => {
      expect(mockRender).toHaveBeenCalled();
    });

    // Get the success callback
    const successCallback = mockRender.mock.calls[0][0];

    // Simulate scan
    await act(async () => {
      await successCallback('error-barcode');
    });

    expect(scanBarcode).toHaveBeenCalledWith('error-barcode', 'testuser');
    expect(await screen.findByText(/Network error or backend failure/i)).toBeInTheDocument();
  });
});
