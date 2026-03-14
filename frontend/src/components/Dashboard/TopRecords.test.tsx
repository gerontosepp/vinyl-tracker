import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TopRecords from './TopRecords';
import type { AnalyticsTopRecord } from '../../types';

describe('TopRecords Component', () => {
  const mockData: AnalyticsTopRecord[] = [
    {
      recordTitle: 'Record One',
      title: 'Record One',
      artist: 'Artist A',
      count: 10,
      thumbUrl: 'thumb1.jpg',
    },
    {
      recordTitle: 'Record Two',
      title: 'Album Two', // Testing the fallback
      artist: 'Artist B',
      count: 5,
      thumbUrl: '',
    },
  ];

  it('renders correctly with data', () => {
    render(<TopRecords data={mockData} />);

    expect(screen.getByText('Top Records')).toBeInTheDocument();
    expect(screen.getByText('Record One')).toBeInTheDocument();
    expect(screen.getByText('Artist A')).toBeInTheDocument();
    expect(screen.getByText('10 plays')).toBeInTheDocument();

    expect(screen.getByText('Album Two')).toBeInTheDocument();
    expect(screen.getByText('5 plays')).toBeInTheDocument();
  });

  it('renders correct empty state', () => {
    render(<TopRecords data={[]} />);

    expect(screen.getByText('No Top Records')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start listening to some music and your most played records will appear here over time.'
      )
    ).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TopRecords data={[]} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders correctly without cover image', () => {
    render(<TopRecords data={[mockData[1]]} />);
    expect(screen.getByText('No Cover')).toBeInTheDocument();
  });
});
