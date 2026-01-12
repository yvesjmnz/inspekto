/**
 * Complaints Module - Database Operations
 * Simple CRUD for Phase 1
 */

import { supabase } from '../supabaseClient';
import type { ComplaintFormData, Complaint, SubmitResult } from './types';

/**
 * Upload files to Supabase Storage
 */
async function uploadFiles(
  files: File[],
  type: 'image' | 'document',
  complaintId: string
): Promise<string[]> {
  const bucket = type === 'image' ? 'complaint-images' : 'complaint-documents';
  const urls: string[] = [];

  for (const file of files) {
    const fileName = `${complaintId}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) {
      console.error(`Upload error for ${file.name}:`, error);
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    urls.push(data.publicUrl);
  }

  return urls;
}

/**
 * Create complaint in database
 */
export async function submitComplaint(
  formData: ComplaintFormData
): Promise<SubmitResult> {
  try {
    // Upload files first
    const imageUrls = formData.images.length > 0 
      ? await uploadFiles(formData.images, 'image', 'temp')
      : [];
    
    const documentUrls = formData.documents.length > 0
      ? await uploadFiles(formData.documents, 'document', 'temp')
      : [];

    // Create complaint record
    const { data, error } = await supabase
      .from('complaints')
      .insert([
        {
          business_name: formData.businessName,
          business_address: formData.businessAddress,
          complaint_description: formData.complaintDescription,
          reporter_email: formData.reporterEmail,
          image_urls: imageUrls,
          document_urls: documentUrls,
          authenticity_level: null,
          tags: formData.locationVerificationTag ? [formData.locationVerificationTag] : [],
          status: 'Submitted',

          // Phase 3: Location-Based Authenticity (requires DB columns)
          business_pk: formData.businessPk ?? null,
          reporter_lat: formData.location?.latitude ?? null,
          reporter_lng: formData.location?.longitude ?? null,
          reporter_accuracy: formData.location?.accuracy ?? null,
          reporter_location_timestamp: formData.location?.timestamp
            ? new Date(formData.location.timestamp).toISOString()
            : null,

          // User-confirmed pin
          reporter_pin_lat: formData.pinnedLocation?.latitude ?? null,
          reporter_pin_lng: formData.pinnedLocation?.longitude ?? null,

          // Certification
          certification_accepted: formData.certificationAccepted ?? false,
          certification_accepted_at: formData.certificationAccepted ? new Date().toISOString() : null,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    // Re-upload files with proper complaint ID
    if (data.id) {
      const newImageUrls = formData.images.length > 0
        ? await uploadFiles(formData.images, 'image', data.id)
        : [];
      
      const newDocumentUrls = formData.documents.length > 0
        ? await uploadFiles(formData.documents, 'document', data.id)
        : [];

      // Update complaint with correct file URLs
      await supabase
        .from('complaints')
        .update({
          image_urls: newImageUrls,
          document_urls: newDocumentUrls,
        })
        .eq('id', data.id);
    }

    return {
      success: true,
      message: 'Complaint submitted successfully. Thank you for reporting this issue.',
      complaintId: data.id,
    };
  } catch (error) {
    console.error('Submit complaint error:', error);
    return {
      success: false,
      message: 'Failed to submit complaint. Please try again.',
    };
  }
}

/**
 * Get complaint by ID
 */
export async function getComplaint(id: string): Promise<Complaint | null> {
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get complaint error:', error);
    return null;
  }
}
