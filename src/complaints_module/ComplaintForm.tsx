/**
 * Complaints Module - Redesigned Complaint Form Component
 *
 * UX PRINCIPLES APPLIED:
 * 1. Progressive Disclosure: Show only what's needed at each step
 * 2. Cognitive Load Reduction: Group by user intent, not technical function
 * 3. Anxiety Reduction: Supportive microcopy, non-judgmental tone
 * 4. Mobile-First: Minimal scrolling, touch-friendly interactions
 * 5. Clear Hierarchy: Required vs optional fields visually distinct
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { supabase } from '../supabaseClient';
import { submitComplaint } from './db';
import { validateForm, getFieldError } from './validation';
import type { ComplaintFormData, FormError } from './types';

type FormStep = 'business-info' | 'complaint-details' | 'evidence' | 'review';

interface StepConfig {
  id: FormStep;
  title: string;
  description: string;
  icon: string;
}

const FORM_STEPS: StepConfig[] = [
  {
    id: 'business-info',
    title: 'Business Information',
    description: 'Help us identify the business',
    icon: 'building',
  },
  {
    id: 'complaint-details',
    title: 'Your Complaint',
    description: 'Confirm location, then tell us what happened',
    icon: 'document',
  },
  {
    id: 'evidence',
    title: 'Supporting Evidence',
    description: 'Add photos or documents (optional)',
    icon: 'paperclip',
  },
  {
    id: 'review',
    title: 'Review & Submit',
    description: 'Confirm your information',
    icon: 'check',
  },
];

type BusinessLookupRow = {
  business_pk: number;
  business_name: string | null;
  business_address: string | null;
};

type LocationStatus =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'captured' }
  | { kind: 'blocked'; message: string };

function computeDistanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  // Haversine formula
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

// Leaflet default marker icons are not bundled correctly by some bundlers.
// We set explicit URLs so the marker renders reliably.
const DEFAULT_MARKER_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function ComplaintFormRedesigned({
  prefillEmail,
}: {
  prefillEmail?: string;
}) {
  const [currentStep, setCurrentStep] = useState<FormStep>('business-info');

  // Business lookup
  const [businessSearch, setBusinessSearch] = useState('');
  const [isBusinessSearching, setIsBusinessSearching] = useState(false);
  const [businessResults, setBusinessResults] = useState<BusinessLookupRow[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessLookupRow | null>(null);

  // Location capture
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({ kind: 'idle' });
  const [userLocationAddress, setUserLocationAddress] = useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [reverseGeocodingError, setReverseGeocodingError] = useState<string | null>(null);

  // Map (Leaflet / OpenStreetMap)
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // User-confirmed pin
  const [pinnedLocation, setPinnedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinConfirmed, setPinConfirmed] = useState(false);

  // Verification result (device vs pin)
  const [locationVerificationTag, setLocationVerificationTag] = useState<
    'Location Verified' | 'Failed Location Verification' | null
  >(null);
  const [verificationDistanceMeters, setVerificationDistanceMeters] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<ComplaintFormData>>({
    businessName: '',
    businessAddress: '',
    complaintDescription: '',
    reporterEmail: prefillEmail ?? '',
    images: [],
    documents: [],

    businessPk: undefined,
    location: undefined,
    pinnedLocation: undefined,
    locationVerificationTag: undefined,
    certificationAccepted: false,
  });

  const [errors, setErrors] = useState<FormError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const canConfirmPin = useMemo(() => {
    return !!(formData.location && pinnedLocation);
  }, [formData.location, pinnedLocation]);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    // UX-only: helps users understand what we captured.
    setIsReverseGeocoding(true);
    setReverseGeocodingError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        latitude
      )}&lon=${encodeURIComponent(longitude)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Reverse geocoding failed (${res.status})`);
      }

      const json = (await res.json()) as { display_name?: string };
      const display = json.display_name?.trim();
      setUserLocationAddress(display && display.length > 0 ? display : null);
    } catch {
      setUserLocationAddress(null);
      setReverseGeocodingError('Unable to determine a human-readable location from your device coordinates.');
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const requestDeviceLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationStatus({ kind: 'blocked', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    setLocationStatus({ kind: 'requesting' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const captured = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          timestamp: pos.timestamp,
        };

        setFormData((prev) => ({ ...prev, location: captured }));
        setLocationStatus({ kind: 'captured' });

        // Suggest an initial pin if user hasn't placed one.
        setPinnedLocation((prev) => prev ?? { latitude: captured.latitude, longitude: captured.longitude });

        void reverseGeocode(captured.latitude, captured.longitude);
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. You can still place the pin manually on the map.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Location is unavailable. Please try again.'
              : 'Location request timed out. Please try again.';

        setLocationStatus({ kind: 'blocked', message });
        setUserLocationAddress(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Request permission on load
  useEffect(() => {
    requestDeviceLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced business lookup
  useEffect(() => {
    const term = businessSearch.trim();
    if (term.length < 2) {
      setBusinessResults([]);
      setIsBusinessSearching(false);
      return;
    }

    setIsBusinessSearching(true);

    const handle = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('business_pk,business_name,business_address')
        .ilike('business_name', `%${term}%`)
        .limit(10);

      if (!error && data) {
        setBusinessResults(data as BusinessLookupRow[]);
      } else {
        setBusinessResults([]);
      }

      setIsBusinessSearching(false);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [businessSearch]);

  // Initialize Leaflet map (progressive disclosure)
  useEffect(() => {
    if (currentStep !== 'complaint-details') return;
    if (!mapContainerRef.current) return;

    // Create only once
    if (!mapRef.current) {
      const fallbackCenter: L.LatLngExpression = [14.5995, 120.9842]; // Manila
      const startCenter: L.LatLngExpression = formData.location
        ? [formData.location.latitude, formData.location.longitude]
        : pinnedLocation
          ? [pinnedLocation.latitude, pinnedLocation.longitude]
          : fallbackCenter;

      mapRef.current = L.map(mapContainerRef.current, {
        center: startCenter,
        zoom: formData.location ? 17 : 13,
        zoomControl: true,
      });

      // OSM tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Click to place pin
      mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
        setPinnedLocation({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      });
    }

    // Create marker once
    if (!markerRef.current && mapRef.current) {
      const center = mapRef.current.getCenter();
      const startLat = pinnedLocation?.latitude ?? center.lat;
      const startLng = pinnedLocation?.longitude ?? center.lng;

      markerRef.current = L.marker([startLat, startLng], {
        draggable: true,
        icon: DEFAULT_MARKER_ICON,
      }).addTo(mapRef.current);

      markerRef.current.on('dragend', () => {
        const ll = markerRef.current?.getLatLng();
        if (!ll) return;
        setPinnedLocation({ latitude: ll.lat, longitude: ll.lng });
      });
    }

    // Workaround: Leaflet maps need invalidateSize when shown in a previously hidden container.
    window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);
  }, [currentStep, formData.location, pinnedLocation]);

  // Keep marker in sync with pinnedLocation
  useEffect(() => {
    if (!mapRef.current) return;
    if (!pinnedLocation) return;

    const ll: L.LatLngExpression = [pinnedLocation.latitude, pinnedLocation.longitude];

    if (markerRef.current) {
      markerRef.current.setLatLng(ll);
    }

    if (!pinConfirmed) {
      mapRef.current.panTo(ll);
    }
  }, [pinnedLocation, pinConfirmed]);

  // If pin changes after confirmation, invalidate verification.
  useEffect(() => {
    if (!pinConfirmed) return;
    setPinConfirmed(false);
    setLocationVerificationTag(null);
    setVerificationDistanceMeters(null);
    setFormData((prev) => ({ ...prev, locationVerificationTag: undefined }));
  }, [pinnedLocation?.latitude, pinnedLocation?.longitude]);

  const handleInputChange = (field: keyof ComplaintFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== field));

    if (field === 'businessName' || field === 'businessAddress') {
      setSelectedBusiness(null);
      setFormData((prev) => ({ ...prev, businessPk: undefined }));
    }
  };

  const handleFileChange = (type: 'images' | 'documents', files: FileList | null) => {
    if (!files) return;
    setFormData((prev) => ({
      ...prev,
      [type]: Array.from(files),
    }));
    setErrors((prev) => prev.filter((e) => e.field !== type));

    if (type === 'images' && files.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleRemoveFile = (type: 'images' | 'documents', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((_, i) => i !== index),
    }));
    if (type === 'images') {
      setImagePreview(null);
    }
  };

  const validateStep = (step: FormStep): boolean => {
    const stepErrors: FormError[] = [];

    switch (step) {
      case 'business-info':
        if (!formData.businessName?.trim()) {
          stepErrors.push({ field: 'businessName', message: 'Business name is required' });
        }
        if (!formData.businessAddress?.trim()) {
          stepErrors.push({ field: 'businessAddress', message: 'Business address is required' });
        }
        if (!formData.businessPk) {
          stepErrors.push({ field: 'businessName', message: 'Please select a business from the list.' });
        }
        break;

      case 'complaint-details':
        if (!formData.complaintDescription?.trim()) {
          stepErrors.push({ field: 'complaintDescription', message: 'Please describe your complaint' });
        } else if (formData.complaintDescription.length < 20) {
          stepErrors.push({ field: 'complaintDescription', message: 'Please provide at least 20 characters' });
        }
        if (!formData.reporterEmail?.trim()) {
          stepErrors.push({ field: 'reporterEmail', message: 'Email address is required' });
        }
        if (!formData.location) {
          stepErrors.push({ field: 'reporterEmail', message: 'Location permission is required to submit.' });
        }
        if (!pinnedLocation || !pinConfirmed) {
          stepErrors.push({ field: 'reporterEmail', message: 'Please confirm your location on the map.' });
        }
        if (!formData.locationVerificationTag) {
          stepErrors.push({ field: 'reporterEmail', message: 'Please confirm your pin to verify location.' });
        }
        break;

      case 'evidence':
        break;

      case 'review':
        {
          const allErrors = validateForm(formData);
          if (allErrors.length > 0) {
            setErrors(allErrors);
            return false;
          }
        }
        if (!formData.certificationAccepted) {
          stepErrors.push({ field: 'reporterEmail', message: 'Certification is required to submit.' });
        }
        break;
    }

    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return false;
    }

    setErrors([]);
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) return;

    const stepIndex = FORM_STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex < FORM_STEPS.length - 1) {
      setCurrentStep(FORM_STEPS[stepIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousStep = () => {
    const stepIndex = FORM_STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(FORM_STEPS[stepIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);

    if (!validateStep('review')) return;

    setIsSubmitting(true);

    try {
      const payload: ComplaintFormData = {
        businessName: formData.businessName || '',
        businessAddress: formData.businessAddress || '',
        complaintDescription: formData.complaintDescription || '',
        reporterEmail: formData.reporterEmail || '',
        images: formData.images || [],
        documents: formData.documents || [],
        businessPk: formData.businessPk,
        location: formData.location,
        pinnedLocation: pinnedLocation ?? undefined,
        locationVerificationTag: formData.locationVerificationTag,
        certificationAccepted: !!formData.certificationAccepted,
      };

      const result = await submitComplaint(payload);

      if (result.success) {
        setSubmitMessage(result.message);
        setFormData({
          businessName: '',
          businessAddress: '',
          complaintDescription: '',
          reporterEmail: '',
          images: [],
          documents: [],
          businessPk: undefined,
          location: undefined,
          pinnedLocation: undefined,
          locationVerificationTag: undefined,
          certificationAccepted: false,
        });
        setSelectedBusiness(null);
        setBusinessSearch('');
        setImagePreview(null);
        setErrors([]);
        setCurrentStep('business-info');

        setPinnedLocation(null);
        setPinConfirmed(false);
        setLocationVerificationTag(null);
        setVerificationDistanceMeters(null);
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

  const currentStepIndex = FORM_STEPS.findIndex((s) => s.id === currentStep);
  const currentStepConfig = FORM_STEPS[currentStepIndex];

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up">
      {/* Progress Indicator */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-8 py-8 border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-6">
            {FORM_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index < currentStepIndex) {
                      setCurrentStep(step.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  disabled={index > currentStepIndex}
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all duration-300 ${
                    index < currentStepIndex
                      ? 'bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700'
                      : index === currentStepIndex
                        ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                        : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>

                {index < FORM_STEPS.length - 1 && (
                  <div
                    className={`w-12 md:w-16 h-1 mx-2 rounded-full transition-all duration-300 ${
                      index < currentStepIndex ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">{currentStepConfig.title}</h2>
            <p className="text-slate-600 mt-2">{currentStepConfig.description}</p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-12 md:p-16 lg:p-20">
        {/* Success Message */}
        {submitMessage && (
          <div className="mb-8 p-6 bg-emerald-50 border-l-4 border-emerald-600 rounded-lg animate-slide-in-left shadow-md">
            <div className="flex gap-4">
              <svg className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-base font-bold text-emerald-900">Complaint submitted successfully</p>
                <p className="text-sm text-emerald-800 mt-1">{submitMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="mb-8 p-6 bg-red-50 border-l-4 border-red-600 rounded-lg animate-slide-in-left shadow-md">
            <div className="flex gap-4">
              <svg className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-base font-bold text-red-900">Submission failed</p>
                <p className="text-sm text-red-800 mt-1">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* STEP 1: Business Information */}
          {currentStep === 'business-info' && (
            <div className="space-y-8 animate-fade-in-up">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-blue-900">Select the business first. Next, you will confirm your location on a map.</p>

                <div className="text-sm text-blue-900">
                  <span className="font-semibold">Captured by your device:</span>{' '}
                  {locationStatus.kind === 'requesting' && 'Requesting permission...'}
                  {locationStatus.kind === 'blocked' && 'Unavailable (permission denied or unsupported).'}
                  {locationStatus.kind === 'captured' && (
                    isReverseGeocoding
                      ? 'Resolving address...'
                      : userLocationAddress
                        ? userLocationAddress
                        : 'Location captured'
                  )}
                </div>

                {reverseGeocodingError && <div className="text-sm text-red-700 font-semibold">{reverseGeocodingError}</div>}

                {formData.location?.accuracy != null && (
                  <div className="text-xs text-blue-900">Accuracy radius: about {Math.round(formData.location.accuracy)} meters</div>
                )}
              </div>

              {/* Business Lookup */}
              <div className="relative">
                <label htmlFor="businessLookup" className="block text-base font-bold text-slate-900 mb-2 leading-relaxed">
                  Business Lookup <span className="text-red-600">*</span>
                </label>
                <input
                  id="businessLookup"
                  type="text"
                  value={businessSearch}
                  onChange={(e) => setBusinessSearch(e.target.value)}
                  placeholder="Search business name"
                  className={`w-full px-6 py-4 border-2 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-300 font-medium ${
                    businessNameError
                      ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 bg-white focus:ring-amber-500 focus:border-amber-500 hover:border-slate-400'
                  }`}
                />

                {(isBusinessSearching || businessResults.length > 0) && (
                  <div className="absolute z-10 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                    {isBusinessSearching ? (
                      <div className="p-4 text-sm text-slate-600">Searching...</div>
                    ) : (
                      <ul className="max-h-72 overflow-auto">
                        {businessResults.map((b) => (
                          <li key={b.business_pk}>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition"
                              onClick={() => {
                                setSelectedBusiness(b);
                                setBusinessSearch(b.business_name || '');
                                setBusinessResults([]);
                                setFormData((prev) => ({
                                  ...prev,
                                  businessPk: b.business_pk,
                                  businessName: b.business_name || '',
                                  businessAddress: b.business_address || '',
                                }));

                                setPinConfirmed(false);
                                setLocationVerificationTag(null);
                                setVerificationDistanceMeters(null);
                                setFormData((prev) => ({ ...prev, locationVerificationTag: undefined }));
                              }}
                            >
                              <div className="text-sm font-semibold text-slate-900">{b.business_name || 'Unnamed business'}</div>
                              <div className="text-xs text-slate-600 mt-1">{b.business_address || 'No address on file'}</div>
                            </button>
                          </li>
                        ))}
                        {businessResults.length === 0 && <li className="p-4 text-sm text-slate-600">No matches found.</li>}
                      </ul>
                    )}
                  </div>
                )}

                {selectedBusiness && (
                  <div className="mt-3 text-sm text-slate-700">
                    Selected: <span className="font-semibold">{selectedBusiness.business_name}</span>
                  </div>
                )}

                {businessNameError && (
                  <p className="mt-3 text-sm text-red-700 flex items-center font-semibold animate-shake">
                    <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {businessNameError}
                  </p>
                )}
              </div>

              {/* Business Address */}
              <div>
                <label htmlFor="businessAddress" className="block text-base font-bold text-slate-900 mb-2 leading-relaxed">
                  Business Address <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="businessAddress"
                  value={formData.businessAddress || ''}
                  onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                  rows={3}
                  className={`w-full px-6 py-4 border-2 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-300 font-medium resize-none ${
                    businessAddressError
                      ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 bg-white focus:ring-amber-500 focus:border-amber-500 hover:border-slate-400'
                  }`}
                />
                {businessAddressError && (
                  <p className="mt-3 text-sm text-red-700 flex items-center font-semibold animate-shake">
                    <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {businessAddressError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Complaint Details (includes location confirmation) */}
          {currentStep === 'complaint-details' && (
            <div className="space-y-8 animate-fade-in-up">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Confirm your location by placing the pin on the map. After you confirm, we compare the pin with your device location.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
                {/* Captured */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">Captured by your device</div>
                    {locationStatus.kind === 'requesting' && <div className="mt-1">Requesting location permission...</div>}
                    {locationStatus.kind === 'captured' && (
                      <div className="mt-1">
                        {userLocationAddress ? (
                          <>Approximate location: <span className="font-semibold">{userLocationAddress}</span></>
                        ) : (
                          <>Coordinates: {formData.location?.latitude.toFixed(6)}, {formData.location?.longitude.toFixed(6)}</>
                        )}
                      </div>
                    )}
                    {locationStatus.kind === 'blocked' && (
                      <div className="mt-1 text-red-700 font-semibold">{locationStatus.message}</div>
                    )}
                    {formData.location?.accuracy != null && (
                      <div className="mt-2 text-xs text-slate-600">Accuracy radius: about {Math.round(formData.location.accuracy)} meters</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="mt-3 px-4 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold hover:bg-white transition"
                  >
                    Refresh device location
                  </button>

                  {reverseGeocodingError && <div className="mt-2 text-sm text-red-700 font-semibold">{reverseGeocodingError}</div>}
                </div>

                {/* Confirmed */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">Confirmed by you (map pin)</div>
                    <div className="mt-1 text-slate-600">Tap on the map to place the pin, or drag it to adjust.</div>

                    <div className="mt-3">
                      <div
                        ref={mapContainerRef}
                        className="w-full rounded-lg border border-slate-200 overflow-hidden"
                        style={{ height: 320 }}
                      />
                    </div>

                    {pinnedLocation && (
                      <div className="mt-3 text-sm text-slate-700">
                        Pin: {pinnedLocation.latitude.toFixed(6)}, {pinnedLocation.longitude.toFixed(6)}
                      </div>
                    )}

                    <div className="mt-4 flex flex-col md:flex-row gap-3">
                      <button
                        type="button"
                        disabled={!formData.location}
                        onClick={() => {
                          if (!formData.location) return;
                          setPinnedLocation({ latitude: formData.location.latitude, longitude: formData.location.longitude });
                          setPinConfirmed(false);
                        }}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Use my device location as pin
                      </button>

                      <button
                        type="button"
                        disabled={!canConfirmPin}
                        onClick={() => {
                          if (!formData.location || !pinnedLocation) return;

                          const distance = computeDistanceMeters(
                            { latitude: formData.location.latitude, longitude: formData.location.longitude },
                            { latitude: pinnedLocation.latitude, longitude: pinnedLocation.longitude }
                          );

                          const tag = distance <= 200 ? 'Location Verified' : 'Failed Location Verification';

                          setVerificationDistanceMeters(distance);
                          setLocationVerificationTag(tag);
                          setPinConfirmed(true);

                          setFormData((prev) => ({
                            ...prev,
                            pinnedLocation,
                            locationVerificationTag: tag,
                          }));
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Confirm pin
                      </button>
                    </div>

                    {pinConfirmed && locationVerificationTag && (
                      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="text-sm text-slate-900 font-semibold">
                          Verification result: {locationVerificationTag}
                          {typeof verificationDistanceMeters === 'number' && (
                            <span className="font-normal text-slate-700"> (distance: {Math.round(verificationDistanceMeters)}m)</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">If you move the pin, please confirm again.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Complaint Description */}
              <div>
                <label htmlFor="complaintDescription" className="block text-base font-bold text-slate-900 mb-2 leading-relaxed">
                  What is your complaint? <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="complaintDescription"
                  value={formData.complaintDescription || ''}
                  onChange={(e) => handleInputChange('complaintDescription', e.target.value)}
                  placeholder="Describe what happened"
                  rows={8}
                  className={`w-full px-6 py-4 border-2 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-300 font-medium resize-none ${
                    complaintDescriptionError
                      ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 bg-white focus:ring-amber-500 focus:border-amber-500 hover:border-slate-400'
                  }`}
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {formData.complaintDescription?.length || 0} / 5000 characters
                  </p>
                  {complaintDescriptionError && (
                    <p className="text-sm text-red-700 flex items-center font-semibold animate-shake">
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {complaintDescriptionError}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reporterEmail" className="block text-base font-bold text-slate-900 mb-2 leading-relaxed">
                  Your Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="reporterEmail"
                  type="email"
                  value={formData.reporterEmail || ''}
                  onChange={(e) => handleInputChange('reporterEmail', e.target.value)}
                  placeholder="name@example.com"
                  className={`w-full px-6 py-4 border-2 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition duration-300 font-medium ${
                    reporterEmailError
                      ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500'
                      : 'border-slate-300 bg-white focus:ring-amber-500 focus:border-amber-500 hover:border-slate-400'
                  }`}
                />
                {reporterEmailError && (
                  <p className="mt-3 text-sm text-red-700 flex items-center font-semibold animate-shake">
                    <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {reporterEmailError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Evidence */}
          {currentStep === 'evidence' && (
            <div className="space-y-8 animate-fade-in-up">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Photos and documents help us understand your complaint better. You can add them now or skip this step if you don't have any.
                </p>
              </div>

              {/* Image Preview */}
              {imagePreview && (
                <div className="animate-fade-in-up">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Image Preview</h3>
                  <div className="relative bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-md">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                    <div className="absolute top-3 right-3 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow-md">
                      {formData.images?.length || 0} photo{formData.images?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Images */}
              <div>
                <label htmlFor="images" className="block text-base font-bold text-slate-900 mb-2 leading-relaxed">
                  Photos <span className="text-slate-500 font-normal text-sm">(Optional)</span>
                </label>
                <div
                  className={`relative flex justify-center px-6 py-8 border-2 border-dashed rounded-lg transition duration-200 ${
                    imagesError
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <div className="space-y-2 text-center">
                    <svg className="mx-auto h-8 w-8 text-slate-400 animate-float" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-12l-3.172-3.172a4 4 0 00-5.656 0L28 20M9 20l3.172-3.172a4 4 0 015.656 0L28 20"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex flex-col text-sm text-slate-600">
                      <label htmlFor="images" className="relative cursor-pointer font-semibold text-blue-600 hover:text-blue-700 transition">
                        <span>Click to upload</span>
                        <input
                          id="images"
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleFileChange('images', e.target.files)}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-slate-600">or drag and drop</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">JPG, PNG, WebP up to 50MB total</p>
                  </div>
                </div>
                {imagesError && <p className="mt-2 text-sm text-red-600 font-medium animate-shake">{imagesError}</p>}
                {formData.images && formData.images.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.images.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm hover:bg-slate-100 transition animate-slide-in-left"
                      >
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
              <div>
                <label htmlFor="documents" className="block text-base font-bold text-slate-900 mb-2 leading-relaxed">
                  Documents <span className="text-slate-500 font-normal text-sm">(Optional)</span>
                </label>
                <div
                  className={`relative flex justify-center px-6 py-8 border-2 border-dashed rounded-lg transition duration-200 ${
                    documentsError
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <div className="space-y-2 text-center">
                    <svg className="mx-auto h-8 w-8 text-slate-400 animate-float" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path
                        d="M8 14v20c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4V14m-4-6H12c-2.2 0-4 1.8-4 4v2h32V12c0-2.2-1.8-4-4-4z"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex flex-col text-sm text-slate-600">
                      <label htmlFor="documents" className="relative cursor-pointer font-semibold text-blue-600 hover:text-blue-700 transition">
                        <span>Click to upload</span>
                        <input
                          id="documents"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileChange('documents', e.target.files)}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-slate-600">or drag and drop</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">PDF, DOC, DOCX up to 100MB total</p>
                  </div>
                </div>
                {documentsError && <p className="mt-2 text-sm text-red-600 font-medium animate-shake">{documentsError}</p>}
                {formData.documents && formData.documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.documents.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm hover:bg-slate-100 transition animate-slide-in-left"
                      >
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
          )}

          {/* STEP 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-8 animate-fade-in-up">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">Please review your information before submitting.</p>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Business Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Business Name</p>
                      <p className="text-base text-slate-900 font-medium mt-1">{formData.businessName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Address</p>
                      <p className="text-base text-slate-900 font-medium mt-1 whitespace-pre-wrap">{formData.businessAddress}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('business-info')}
                    className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Edit
                  </button>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Complaint Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Description</p>
                      <p className="text-base text-slate-900 font-medium mt-1 whitespace-pre-wrap">{formData.complaintDescription}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Your Email</p>
                      <p className="text-base text-slate-900 font-medium mt-1">{formData.reporterEmail}</p>
                    </div>
                    {locationVerificationTag && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Location Verification</p>
                        <p className="text-base text-slate-900 font-medium mt-1">
                          {locationVerificationTag}
                          {typeof verificationDistanceMeters === 'number' && (
                            <span className="text-slate-700 font-normal"> (distance: {Math.round(verificationDistanceMeters)}m)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('complaint-details')}
                    className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Edit
                  </button>
                </div>

                {/* Certification */}
                <div className="bg-white rounded-lg p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Certification</h3>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!formData.certificationAccepted}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => ({ ...prev, certificationAccepted: checked }));
                        setErrors((prev) => prev.filter((err) => err.field !== 'reporterEmail'));
                      }}
                      className="mt-1 h-5 w-5"
                    />
                    <span className="text-sm text-slate-800 leading-relaxed">
                      I certify that all the information I entered is true and the falsification may result in the non-acceptance of the complaint.
                    </span>
                  </label>
                  {!formData.certificationAccepted && (
                    <p className="mt-3 text-sm text-slate-600">You must certify before submitting.</p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">Your information will be kept confidential and used only to investigate your complaint.</p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 pt-8 border-t border-slate-200">
            <button
              type="button"
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-900 font-bold rounded-lg transition duration-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentStep === 'review' ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Submit Complaint
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-1 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                Next
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
