/**
 * Complaints Module - Main Export
 */

export { default as ComplaintForm } from './ComplaintForm';
export { submitComplaint, getComplaint } from './db';
export { validateForm, getFieldError } from './validation';
export type { ComplaintFormData, Complaint, FormError, SubmitResult } from './types';
