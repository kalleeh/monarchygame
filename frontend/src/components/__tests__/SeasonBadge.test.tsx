import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonBadge } from '../ui/SeasonBadge';

describe('SeasonBadge', () => {
  it('shows season number and age', () => {
    const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
    render(<SeasonBadge seasonNumber={1} currentAge="early" startDate={startDate} />);
    expect(screen.getByText(/Season 1/)).toBeInTheDocument();
    expect(screen.getByText(/Early/)).toBeInTheDocument();
  });

  it('shows days remaining when > 0', () => {
    const startDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago (6 days left in early)
    render(<SeasonBadge seasonNumber={2} currentAge="early" startDate={startDate} />);
    expect(screen.getByText(/left/)).toBeInTheDocument();
  });
});
