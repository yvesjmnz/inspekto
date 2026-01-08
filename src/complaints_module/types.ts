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
  documents: File[];
}

export interface Complaint {
  id: string;
  business_name: string;
  business_address: string;
  complaint_description: string;
  reporter_email: string;
  image_urls: string[];
  document_urls: string[];
  authenticity_level: null; // Phase 1: always null
  tags: string[]; // Phase 1: always empty
  created_at: string;
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
