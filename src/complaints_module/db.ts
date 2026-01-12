/**
 * Complaints Module - Database Operations
 *
 * Notes:
 * - We must create the complaint first to get a stable complaintId.
 * - Then upload files under complaintId/ in the appropriate bucket.
 * - Then persist the public URLs back to the complaint record.
 */

import { supabase } from '../supabaseClient';
import type { ComplaintFormData, Complaint, SubmitResult } from './types';

function getStorageBucket(type: 'image' | 'document') {
  return type === 'image' ? 'complaint-images' : 'complaint-documents';
}

function safeExtFromFile(file: File) {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : '';
  const fromType = file.type.includes('/') ? file.type.split('/').pop() : '';
  const ext = (fromName || fromType || '').toLowerCase();
  return ext ? `.${ext.replace(/[^a-z0-9]/g, '')}` : '';
}

function randomToken(len = 10) {
  return Math.random().toString(36).slice(2, 2 + len);
}

/**
 * Upload files to Supabase Storage and return public URLs.
 */
async function uploadFiles(params: {
  files: File[];
  type: 'image' | 'document';
  complaintId: string;
}): Promise<string[]> {
  const { files, type, complaintId } = params;
  const bucket = getStorageBucket(type);
  const urls: string[] = [];

  for (const file of files) {
    const ext = safeExtFromFile(file);
    const objectPath = `${complaintId}/${Date.now()}-${randomToken()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, {
        // Avoid silent overwrites
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      console.error(`Upload error for ${file.name}:`, uploadError);
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }

  return urls;
}

/**
 * Create complaint record first (no files), then upload files and update URLs.
 */
export async function submitComplaint(formData: ComplaintFormData): Promise<SubmitResult> {
  try {
    // 1) Create complaint record (without file URLs yet)
    const { data, error } = await supabase
      .from('complaints')
      .insert([
        {
          business_name: formData.businessName,
          business_address: formData.businessAddress,
          complaint_description: formData.complaintDescription,
          reporter_email: formData.reporterEmail,

          image_urls: [],
          document_urls: [],

          authenticity_level: null,
          tags: formData.locationVerificationTag ? [formData.locationVerificationTag] : [],
          status: 'Submitted',

          // Phase 3: Location-Based Authenticity
          business_pk: formData.businessPk ?? null,
          reporter_lat: formData.location?.latitude ?? null,
          reporter_lng: formData.location?.longitude ?? null,
          reporter_accuracy: formData.location?.accuracy ?? null,
          reporter_location_timestamp: formData.location?.timestamp
            ? new Date(formData.location.timestamp).toISOString()
            : null,

          // Optional pin support (may be null)
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
    if (!data?.id) throw new Error('Complaint insert succeeded but no id was returned');

    const complaintId = data.id as string;

    // 2) Upload files using the real complaint id
    const [imageUrls, documentUrls] = await Promise.all([
      formData.images.length > 0
        ? uploadFiles({ files: formData.images, type: 'image', complaintId })
        : Promise.resolve([]),
      formData.documents.length > 0
        ? uploadFiles({ files: formData.documents, type: 'document', complaintId })
        : Promise.resolve([]),
    ]);

    // 3) Persist URLs
    if (imageUrls.length > 0 || documentUrls.length > 0) {
      const { error: updateError } = await supabase
        .from('complaints')
        .update({
          image_urls: imageUrls,
          document_urls: documentUrls,
        })
        .eq('id', complaintId);

      if (updateError) {
        console.error('Failed to update complaint file URLs:', updateError);
        // We still return success because complaint exists; files may still have uploaded.
      }
    }

    return {
      success: true,
      message: 'Complaint submitted successfully. Thank you for reporting this issue.',
      complaintId,
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
    const { data, error } = await supabase.from('complaints').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get complaint error:', error);
    return null;
  }
}
