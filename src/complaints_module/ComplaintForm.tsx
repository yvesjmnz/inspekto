/**
 * Complaints Module - Complaint Form Component
 * Professional complaint submission form with modern design
 */

import { useState } from 'react';
import { submitComplaint } from './db';
import { validateForm, getFieldError } from './validation';
import type { ComplaintFormData, FormError } from './types';

export default function ComplaintForm() {
  const [formData, setFormData] = useState<Partial<ComplaintFormData>>({
    businessName: '',
    businessAddress: '',
    complaintDescription: '',
    reporterEmail: '',
    images: [],
    documents: [],
  });

  const [errors, setErrors] = useState<FormError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleInputChange = (field: keyof ComplaintFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => prev.filter(e => e.field !== field));
  };

  const handleFileChange = (type: 'images' | 'documents', files: FileList | null) => {
    if (!files) return;
    setFormData(prev => ({
      ...prev,
      [type]: Array.from(files),
    }));
    setErrors(prev => prev.filter(e => e.field !== type));
    
    if (type === 'images' && files.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleRemoveFile = (type: 'images' | 'documents', index: number) => {
    setFormData(prev => ({
      ...prev,
      [type]: (prev[type] || []).filter((_, i) => i !== index),
    }));
    if (type === 'images') {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);

    const validationErrors = validateForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitComplaint(formData as ComplaintFormData);
      
      if (result.success) {
        setSubmitMessage(result.message);
        setFormData({
          businessName: '',
          businessAddress: '',
          complaintDescription: '',
          reporterEmail: '',
          images: [],
          documents: [],
        });
        setImagePreview(null);
        setErrors([]);
      } else {
        setSubmitError(result.message);
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred. Please try again.');
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const businessNameError = getFieldError(errors, 'businessName');
  const businessAddressError = getFieldError(errors, 'businessAddress');
  const complaintDescriptionError = getFieldError(errors, 'complaintDescription');
  const reporterEmailError = getFieldError(errors, 'reporterEmail');
  const imagesError = getFieldError(errors, 'images');
  const documentsError = getFieldError(errors, 'documents');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 border-b-4 border-blue-500 shadow-2xl animate-fade-in sticky top-0 z-50">
        <div className="w-full px-16 py-12 flex items-center gap-10">
          <img 
            src="/logo.png" 
            alt="Inspekto Logo" 
            className="h-32 w-32 object-contain animate-fade-in drop-shadow-lg flex-shrink-0"
            style={{ animationDelay: '0.1s' }}
          />
          <div>
            <h1 className="text-6xl font-bold text-white tracking-tight drop-shadow-lg">Inspekto</h1>
            <p className="mt-3 text-blue-100 text-xl font-light">Submit and manage your complaints</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-8 py-16 flex justify-center">
        <div className="w-full max-w-3xl">
          {/* Main Form */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-14">
              {/* Success Message */}
              {submitMessage && (
                <div className="mb-8 p-5 bg-emerald-50 border border-emerald-200 rounded-lg animate-slide-in-left">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-base font-medium text-emerald-800">{submitMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <div className="mb-8 p-5 bg-red-50 border border-red-200 rounded-lg animate-slide-in-left">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-base font-medium text-red-800">{submitError}</p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-10">
                {/* Business Name */}
                <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <label htmlFor="businessName" className="block text-lg font-semibold text-slate-900 mb-3.5">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    value={formData.businessName || ''}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    placeholder="Enter business name"
                    className={`w-full px-6 py-4 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-200 font-medium ${
                      businessNameError 
                        ? 'border-red-300 bg-red-50 focus:ring-red-400' 
                        : 'border-slate-300 bg-white focus:ring-blue-400 focus:border-blue-400 hover:border-slate-400'
                    }`}
                  />
                  {businessNameError && (
                    <p className="mt-3 text-base text-red-600 flex items-center font-medium animate-shake">
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {businessNameError}
                    </p>
                  )}
                </div>

                {/* Business Address */}
                <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <label htmlFor="businessAddress" className="block text-lg font-semibold text-slate-900 mb-3.5">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="businessAddress"
                    value={formData.businessAddress || ''}
                    onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                    placeholder="Street, City, Province"
                    rows={4}
                    className={`w-full px-6 py-4 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-200 font-medium resize-none ${
                      businessAddressError 
                        ? 'border-red-300 bg-red-50 focus:ring-red-400' 
                        : 'border-slate-300 bg-white focus:ring-blue-400 focus:border-blue-400 hover:border-slate-400'
                    }`}
                  />
                  {businessAddressError && (
                    <p className="mt-3 text-base text-red-600 flex items-center font-medium animate-shake">
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {businessAddressError}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <label htmlFor="reporterEmail" className="block text-lg font-semibold text-slate-900 mb-3.5">
                    Your Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reporterEmail"
                    type="email"
                    value={formData.reporterEmail || ''}
                    onChange={(e) => handleInputChange('reporterEmail', e.target.value)}
                    placeholder="your.email@example.com"
                    className={`w-full px-6 py-4 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-200 font-medium ${
                      reporterEmailError 
                        ? 'border-red-300 bg-red-50 focus:ring-red-400' 
                        : 'border-slate-300 bg-white focus:ring-blue-400 focus:border-blue-400 hover:border-slate-400'
                    }`}
                  />
                  {reporterEmailError && (
                    <p className="mt-3 text-base text-red-600 flex items-center font-medium animate-shake">
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {reporterEmailError}
                    </p>
                  )}
                </div>

                {/* Complaint Description */}
                <div className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                  <label htmlFor="complaintDescription" className="block text-lg font-semibold text-slate-900 mb-3.5">
                    Description of Complaint <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="complaintDescription"
                    value={formData.complaintDescription || ''}
                    onChange={(e) => handleInputChange('complaintDescription', e.target.value)}
                    placeholder="Please provide detailed information about the complaint..."
                    rows={12}
                    className={`w-full px-6 py-4 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-200 font-medium resize-none ${
                      complaintDescriptionError 
                        ? 'border-red-300 bg-red-50 focus:ring-red-400' 
                        : 'border-slate-300 bg-white focus:ring-blue-400 focus:border-blue-400 hover:border-slate-400'
                    }`}
                  />
                  {complaintDescriptionError && (
                    <p className="mt-3 text-base text-red-600 flex items-center font-medium animate-shake">
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {complaintDescriptionError}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-slate-500 font-medium">Minimum 20 characters, maximum 5000</p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg text-lg transition duration-200 flex items-center justify-center shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95 animate-fade-in-up" style={{ animationDelay: '0.6s' }}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Submit Complaint'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="mt-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Supporting Materials</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Image Preview */}
              {imagePreview && (
                <div className="md:col-span-2 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Image Preview</h3>
                  <div className="relative bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-md transform hover:scale-102 transition">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow-md">
                      {formData.images?.length || 0} image{formData.images?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Images */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <label htmlFor="images" className="block text-sm font-semibold text-slate-900 mb-3">
                  Photos <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className={`relative flex justify-center px-6 py-8 border-2 border-dashed rounded-lg transition duration-200 transform hover:scale-102 ${
                  imagesError 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                }`}>
                  <div className="space-y-2 text-center">
                    <svg className="mx-auto h-8 w-8 text-slate-400 animate-float" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-12l-3.172-3.172a4 4 0 00-5.656 0L28 20M9 20l3.172-3.172a4 4 0 015.656 0L28 20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex flex-col text-sm text-slate-600">
                      <label htmlFor="images" className="relative cursor-pointer font-semibold text-blue-600 hover:text-blue-700 transition">
                        <span>Upload</span>
                        <input
                          id="images"
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleFileChange('images', e.target.files)}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-slate-600">or drag</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">50MB max</p>
                  </div>
                </div>
                {imagesError && (
                  <p className="mt-2 text-sm text-red-600 font-medium animate-shake">{imagesError}</p>
                )}
                {formData.images && formData.images.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.images.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm hover:bg-slate-100 transition animate-slide-in-left">
                        <span className="text-slate-700 truncate flex-1 font-medium">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('images', idx)}
                          className="text-red-600 hover:text-red-700 font-semibold ml-2 flex-shrink-0 transform hover:scale-110 transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                <label htmlFor="documents" className="block text-sm font-semibold text-slate-900 mb-3">
                  Documents <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className={`relative flex justify-center px-6 py-8 border-2 border-dashed rounded-lg transition duration-200 transform hover:scale-102 ${
                  documentsError 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                }`}>
                  <div className="space-y-2 text-center">
                    <svg className="mx-auto h-8 w-8 text-slate-400 animate-float" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M8 14v20c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4V14m-4-6H12c-2.2 0-4 1.8-4 4v2h32V12c0-2.2-1.8-4-4-4z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex flex-col text-sm text-slate-600">
                      <label htmlFor="documents" className="relative cursor-pointer font-semibold text-blue-600 hover:text-blue-700 transition">
                        <span>Upload</span>
                        <input
                          id="documents"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileChange('documents', e.target.files)}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-slate-600">or drag</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">100MB max</p>
                  </div>
                </div>
                {documentsError && (
                  <p className="mt-2 text-sm text-red-600 font-medium animate-shake">{documentsError}</p>
                )}
                {formData.documents && formData.documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.documents.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm hover:bg-slate-100 transition animate-slide-in-left">
                        <span className="text-slate-700 truncate flex-1 font-medium">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('documents', idx)}
                          className="text-red-600 hover:text-red-700 font-semibold ml-2 flex-shrink-0 transform hover:scale-110 transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 animate-fade-in w-full" style={{ animationDelay: '0.7s' }}>
        <div className="w-full px-12 py-8">
          <p className="text-center text-sm text-slate-600 font-medium">
            Your complaint will be reviewed and stored securely.
          </p>
        </div>
      </footer>
    </div>
  );
}
