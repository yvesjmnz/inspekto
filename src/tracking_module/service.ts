import { supabase } from '../supabaseClient';
import type { TrackingSummary } from './types';

export async function getTrackingSummary(trackingId: string): Promise<TrackingSummary | null> {
  // Tracking ID is complaints.id
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('id, status')
      .eq('id', trackingId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      trackingId: data.id,
      status: data.status ?? '',
    };
  } catch (e) {
    console.error('getTrackingSummary error', e);
    return null;
  }
}
