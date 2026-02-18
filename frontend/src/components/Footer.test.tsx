import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Footer from './Footer';

// Mock the global variable __APP_VERSION__
vi.stubGlobal('__APP_VERSION__', '1.2.3');

describe('Footer Component', () => {
    it('renders the footer with correct version', () => {
        render(<Footer />);

        const footerElement = screen.getByRole('contentinfo'); // footer tag has implicit role 'contentinfo'
        expect(footerElement).toBeInTheDocument();
        expect(footerElement).toHaveTextContent('v1.2.3');
    });
});
