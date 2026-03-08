import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BottomNav from './BottomNav';
import { BrowserRouter, useLocation } from 'react-router-dom';

// Mock matchMedia for window
beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // Deprecated
            removeListener: vi.fn(), // Deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useLocation: vi.fn(),
    };
});

describe('BottomNav Component', () => {
    const mockOnScanClick = vi.fn();

    const renderNav = () => {
        return render(
            <BrowserRouter>
                <BottomNav onScanClick={mockOnScanClick} />
            </BrowserRouter>
        );
    };

    it('renders correctly', () => {
        vi.mocked(useLocation).mockReturnValue({ pathname: '/' } as any);
        const { container } = renderNav();

        // Check for the Lucide Icons rendered instead of text
        expect(container.querySelector('.lucide-house')).toBeInTheDocument();
        expect(container.querySelector('.lucide-disc')).toBeInTheDocument();
        expect(container.querySelector('.lucide-user')).toBeInTheDocument();
    });

    it('highlights the active link', () => {
        vi.mocked(useLocation).mockReturnValue({ pathname: '/collection' } as any);
        const { container } = renderNav();

        // The active icon receives a specific class 'text-indigo-600'
        const collectionIcon = container.querySelector('.lucide-disc');
        const collectionBtn = collectionIcon?.closest('button');
        expect(collectionBtn).toHaveClass('text-indigo-600');

        const homeIcon = container.querySelector('.lucide-house');
        const homeBtn = homeIcon?.closest('button');
        expect(homeBtn).not.toHaveClass('text-indigo-600');
    });

    it('calls onScanClick when scan button is clicked', () => {
        vi.mocked(useLocation).mockReturnValue({ pathname: '/' } as any);
        renderNav();

        // The scan button has an aria-label 'Scan Record' but it's an icon button, or we can find by class/tag
        const scanButton = screen.getAllByRole('button').find(b => b.className.includes('bg-indigo-500'));

        if (scanButton) {
            fireEvent.click(scanButton);
            expect(mockOnScanClick).toHaveBeenCalledTimes(1);
        } else {
            throw new Error('Scan button not found');
        }
    });
});
