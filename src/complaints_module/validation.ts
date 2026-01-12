/**
 * Complaints Module - Form Validation
 * Simple validation for Phase 1
 */

import type { ComplaintFormData, FormError } from './types';

const RULES = {
  businessName: { min: 2, max: 255 },
  businessAddress: { min: 5, max: 500 },
  complaintDescription: { min: 20, max: 5000 },
  reporterEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  images: { maxCount: 10, maxSize: 50 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
};

export function validateForm(data: Partial<ComplaintFormData>): FormError[] {
  const errors: FormError[] = [];

  // Business name
  if (!data.businessName?.trim()) {
    errors.push({ field: 'businessName', message: 'Business name is required' });
  } else if (data.businessName.length < RULES.businessName.min) {
    errors.push({ field: 'businessName', message: `Minimum ${RULES.businessName.min} characters` });
  } else if (data.businessName.length > RULES.businessName.max) {
    errors.push({ field: 'businessName', message: `Maximum ${RULES.businessName.max} characters` });
  }

  // Business address
  if (!data.businessAddress?.trim()) {
    errors.push({ field: 'businessAddress', message: 'Business address is required' });
  } else if (data.businessAddress.length < RULES.businessAddress.min) {
    errors.push({ field: 'businessAddress', message: `Minimum ${RULES.businessAddress.min} characters` });
  } else if (data.businessAddress.length > RULES.businessAddress.max) {
    errors.push({ field: 'businessAddress', message: `Maximum ${RULES.businessAddress.max} characters` });
  }

  // Complaint description
  if (!data.complaintDescription?.trim()) {
    errors.push({ field: 'complaintDescription', message: 'Description is required' });
  } else if (data.complaintDescription.length < RULES.complaintDescription.min) {
    errors.push({ field: 'complaintDescription', message: `Minimum ${RULES.complaintDescription.min} characters` });
  } else if (data.complaintDescription.length > RULES.complaintDescription.max) {
    errors.push({ field: 'complaintDescription', message: `Maximum ${RULES.complaintDescription.max} characters` });
  }

  // Email
  if (!data.reporterEmail?.trim()) {
    errors.push({ field: 'reporterEmail', message: 'Email is required' });
  } else if (!RULES.reporterEmail.test(data.reporterEmail)) {
    errors.push({ field: 'reporterEmail', message: 'Invalid email address' });
  }

  // Images
  if (data.images && data.images.length > 0) {
    if (data.images.length > RULES.images.maxCount) {
      errors.push({ field: 'images', message: `Maximum ${RULES.images.maxCount} images` });
    }
    for (const file of data.images) {
      if (file.size > RULES.images.maxSize) {
        errors.push({ field: 'images', message: `Image too large (max 50MB)` });
        break;
      }
      if (!RULES.images.types.includes(file.type)) {
        errors.push({ field: 'images', message: `Invalid image type` });
        break;
      }
    }
  }

  return errors;
}

export function getFieldError(errors: FormError[], field: string): string | null {
  return errors.find(e => e.field === field)?.message || null;
}
