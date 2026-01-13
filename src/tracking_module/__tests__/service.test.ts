import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../supabaseClient', () => {
  const select = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const maybeSingle = vi.fn();
  const from = vi.fn(() => ({ select, eq, maybeSingle }));
  return {
    supabase: { from },
  };
});

import { getTrackingSummary } from '../service';

describe('getTrackingSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not found', async () => {
    const { supabase } = await import('../../supabaseClient');
    (supabase.from('complaints').maybeSingle as any).mockResolvedValueOnce({ data: null, error: null });

    const res = await getTrackingSummary('abc');
    expect(res).toBeNull();
  });

  it('returns status varchar from complaints table', async () => {
    const { supabase } = await import('../../supabaseClient');
    (supabase.from('complaints').maybeSingle as any).mockResolvedValueOnce({
      data: { id: 'id1', status: 'For Approval' },
      error: null,
    });

    const res = await getTrackingSummary('id1');
    expect(res).toEqual({ trackingId: 'id1', status: 'For Approval' });
  });
});
