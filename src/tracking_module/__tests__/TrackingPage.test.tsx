import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TrackingPage } from '../ui/TrackingPage';
import * as service from '../service';

vi.mock('../service');

describe('TrackingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows error for empty input', async () => {
    render(<TrackingPage />);
    fireEvent.click(screen.getByRole('button', { name: /track/i }));
    expect(await screen.findByText(/please enter a tracking id/i)).toBeInTheDocument();
  });

  it('shows not found message when service returns null', async () => {
    (service.getTrackingSummary as any).mockResolvedValueOnce(null);
    render(<TrackingPage />);
    const input = screen.getByPlaceholderText(/enter tracking id/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /track/i }));
    expect(await screen.findByText(/tracking id not found/i)).toBeInTheDocument();
  });

  it('renders status when found', async () => {
    (service.getTrackingSummary as any).mockResolvedValueOnce({
      trackingId: 'abc',
      status: 'Received',
    });

    render(<TrackingPage />);
    const input = screen.getByPlaceholderText(/enter tracking id/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /track/i }));

    await waitFor(() => screen.getByText(/received/i));
    expect(screen.getByText(/received/i)).toBeInTheDocument();
  });
});
