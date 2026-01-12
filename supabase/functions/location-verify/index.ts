// supabase/functions/location-verify/index.ts
// Phase 3: Location-Based Authenticity
//
// Responsibility:
// - Fetch registered business coordinates (lat/lng) from public.businesses
// - Compute distance from reporter-confirmed coordinates
// - Return location tag + distance + business coordinates
//
// This avoids geocoding unreliable free-text addresses.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type VerifyRequest = {
  reporter: {
    latitude: number;
    longitude: number;
  };
  business: {
    business_pk: number;
  };
  thresholdMeters?: number;
};

type VerifyResponse =
  | {
      ok: true;
      tag: 'Location Verified' | 'Failed Location Verification';
      distance_meters: number;
      threshold_meters: number;
      business_coords: { lat: number; lng: number };
    }
  | {
      ok: false;
      error: string;
    };

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function getSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  // Use service role so this function can always read business coordinates,
  // regardless of RLS.
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
      },
    },
  });
}

serve(async (req) => {
  // Basic CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      const res: VerifyResponse = { ok: false, error: 'Method not allowed' };
      return new Response(JSON.stringify(res), {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    const body = (await req.json()) as Partial<VerifyRequest>;
    const threshold = typeof body.thresholdMeters === 'number' ? body.thresholdMeters : 200;

    const reporterLat = body.reporter?.latitude;
    const reporterLng = body.reporter?.longitude;
    const businessPk = body.business?.business_pk;

    if (typeof reporterLat !== 'number' || typeof reporterLng !== 'number') {
      const res: VerifyResponse = { ok: false, error: 'Missing reporter coordinates' };
      return new Response(JSON.stringify(res), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    if (typeof businessPk !== 'number') {
      const res: VerifyResponse = { ok: false, error: 'Missing business_pk' };
      return new Response(JSON.stringify(res), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    const supabase = getSupabaseClient(req);
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('lat,lng')
      .eq('business_pk', businessPk)
      .single();

    if (businessError) {
      const res: VerifyResponse = { ok: false, error: 'Unable to load business coordinates' };
      return new Response(JSON.stringify(res), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    const businessLat = business?.lat;
    const businessLng = business?.lng;

    if (typeof businessLat !== 'number' || typeof businessLng !== 'number') {
      const res: VerifyResponse = { ok: false, error: 'Business has no registered coordinates' };
      return new Response(JSON.stringify(res), {
        status: 422,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    const distance = haversineMeters(
      { latitude: reporterLat, longitude: reporterLng },
      { latitude: businessLat, longitude: businessLng }
    );

    const tag: VerifyResponse & { ok: true }['tag'] =
      distance <= threshold ? 'Location Verified' : 'Failed Location Verification';

    const res: VerifyResponse = {
      ok: true,
      tag,
      distance_meters: distance,
      threshold_meters: threshold,
      business_coords: { lat: businessLat, lng: businessLng },
    };

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    const res: VerifyResponse = { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    return new Response(JSON.stringify(res), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });
  }
});
