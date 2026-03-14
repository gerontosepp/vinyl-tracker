import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RecentListens from './RecentListens';

describe('RecentListens Component', () => {
  const mockData: any[] = [
    {
      id: 1,
      timestamp: '2023-10-27T10:00:00Z',
      record: {
        title: 'Recent Album',
        artist: 'Recent Artist',
        thumbUrl: 'thumb.jpg',
      },
    },
    {
      id: 2,
      timestamp: '2023-10-27T11:00:00Z',
      record: {
        title: 'Another Album',
        artist: 'Another Artist',
        thumbUrl: '',
      },
    },
  ];

  it('renders correctly with data', () => {
    render(<RecentListens listens={mockData} onDelete={vi.fn()} />);

    expect(screen.getByText('Recent Listens')).toBeInTheDocument();
    expect(screen.getByText('Recent Album')).toBeInTheDocument();
    expect(screen.getByText('Recent Artist')).toBeInTheDocument();
    expect(screen.getByText('Another Album')).toBeInTheDocument();
    const images = screen.getAllByRole('img');
    expect(images.some((img) => img.getAttribute('src') === '/placeholder.png')).toBe(true);
  });

  it('renders correct empty state', () => {
    render(<RecentListens listens={[]} onDelete={vi.fn()} />);

    expect(screen.getByText('No Recent Listens')).toBeInTheDocument();
    expect(
      screen.getByText('Scan a record to start building your history of recently played albums.')
    ).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDeleteMock = vi.fn();
    render(<RecentListens listens={[mockData[0]]} onDelete={onDeleteMock} />);

    // Since button uses Lucide Trash2 icon, test by title/aria or just class if strictly needed
    // Usually a tooltip or accessible name is better, but button exists
    const deleteBtn = screen.getByRole('button');
    fireEvent.click(deleteBtn);

    expect(onDeleteMock).toHaveBeenCalledWith(1);
    expect(onDeleteMock).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <RecentListens listens={[]} onDelete={vi.fn()} className="test-class" />
    );
    expect(container.firstChild).toHaveClass('test-class');
  });
});
