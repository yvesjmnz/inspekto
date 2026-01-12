/**
 * Complaints Module - Core Types
 * Minimal types for Phase 1: Basic complaint submission
 */

export interface ComplaintFormData {
  businessName: string;
  businessAddress: string;
  complaintDescription: string;
  reporterEmail: string;
  images: File[];

  // Phase 3: Location-Based Authenticity
  businessPk?: number;

  // Device-captured location
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
  };

  // User-confirmed pin location (Google Maps)
  pinnedLocation?: {
    latitude: number;
    longitude: number;
  };

  locationVerificationTag?: 'Location Verified' | 'Failed Location Verification';

  // Certification (final step)
  certificationAccepted?: boolean;
}

export interface Complaint {
  id: string;
  business_name: string;
  business_address: string;
  complaint_description: string;
  reporter_email: string;
  image_urls: string[];
  authenticity_level: null; // Phase 1: always null
  tags: string[];
  created_at: string;

  // Phase 3: Location-Based Authenticity (optional until DB updated)
  business_pk?: number | null;
  reporter_lat?: number | null;
  reporter_lng?: number | null;
  reporter_accuracy?: number | null;
  reporter_location_timestamp?: string | null;

  reporter_pin_lat?: number | null;
  reporter_pin_lng?: number | null;

  certification_accepted?: boolean | null;
  certification_accepted_at?: string | null;
}

export interface FormError {
  field: string;
  message: string;
}

export interface SubmitResult {
  success: boolean;
  message: string;
  complaintId?: string;
}
