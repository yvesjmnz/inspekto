/**
 * Complaints Module - Complaint Form (Polished)
 *
 * This revision restores the full multi-step form while:
 * - keeping the improved camera readiness flow
 * - keeping the UI kit (Button/Panel/Field/Alert/StepHeader)
 * - keeping consistent animations via Tailwind config
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { submitComplaint } from './db';
import { validateForm, getFieldError } from './validation';
import type { ComplaintFormData, FormError } from './types';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';
import { Field } from './ui/Field';
import { Alert } from './ui/Alert';
import { StepHeader } from './ui/StepHeader';

type FormStep = 'business-info' | 'verify-location' | 'complaint-details' | 'evidence' | 'review';

const FORM_STEPS: Array<{ id: FormStep; title: string; description: string }> = [
  { id: 'business-info', title: 'Business', description: 'Select the establishment you are reporting.' },
  { id: 'verify-location', title: 'Photo & Location', description: 'Capture a photo and verify you are near the business.' },
  { id: 'complaint-details', title: 'Details', description: 'Describe what happened and provide your email.' },
  { id: 'evidence', title: 'Evidence', description: 'Optional: upload additional files to support your complaint.' },
  { id: 'review', title: 'Review', description: 'Confirm the details before submitting.' },
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

type CameraState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'open' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isLocalhost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 5000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return;

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for camera stream'));
    }, timeoutMs);

    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
  });
}

export default function ComplaintFormRedesigned({ prefillEmail }: { prefillEmail?: string }) {
  const [currentStep, setCurrentStep] = useState<FormStep>('business-info');
  const currentStepIndex = FORM_STEPS.findIndex((s) => s.id === currentStep);
  const stepMeta = useMemo(() => FORM_STEPS[currentStepIndex], [currentStepIndex]);

  // Business lookup
  const [businessSearch, setBusinessSearch] = useState('');
  const [isBusinessSearching, setIsBusinessSearching] = useState(false);
  const [businessResults, setBusinessResults] = useState<BusinessLookupRow[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessLookupRow | null>(null);

  // Location
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({ kind: 'idle' });
  const [locationError, setLocationError] = useState<string | null>(null);

  // Verification
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationDistanceMeters, setVerificationDistanceMeters] = useState<number | null>(null);

  // Camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>({ kind: 'idle' });
  const [preferredVideoDeviceId, setPreferredVideoDeviceId] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState<Partial<ComplaintFormData>>({
    businessName: '',
    businessAddress: '',
    complaintDescription: '',
    reporterEmail: prefillEmail ?? '',
    images: [],
    documents: [],
    businessPk: undefined,
    location: undefined,
    locationVerificationTag: undefined,
    certificationAccepted: false,
  });

  const [errors, setErrors] = useState<FormError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const businessNameError = getFieldError(errors, 'businessName');
  const businessAddressError = getFieldError(errors, 'businessAddress');
  const complaintDescriptionError = getFieldError(errors, 'complaintDescription');
  const reporterEmailError = getFieldError(errors, 'reporterEmail');
  const imagesError = getFieldError(errors, 'images');
  const documentsError = getFieldError(errors, 'documents');

  const requestDeviceLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationStatus({ kind: 'blocked', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    setLocationStatus({ kind: 'requesting' });
    setLocationError(null);

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
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Please enable it in your browser settings.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Location is unavailable. Please try again.'
              : 'Location request timed out. Please try again.';

        setLocationStatus({ kind: 'blocked', message });
        setLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestDeviceLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Business lookup (debounced)
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

      setBusinessResults(!error && data ? (data as BusinessLookupRow[]) : []);
      setIsBusinessSearching(false);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [businessSearch]);

  const setSinglePhoto = (file: File | null) => {
    if (!file) {
      setFormData((prev) => ({ ...prev, images: [] }));
      setImagePreview(null);
      return;
    }

    setFormData((prev) => ({ ...prev, images: [file] }));

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      for (const t of mediaStreamRef.current.getTracks()) t.stop();
      mediaStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState({ kind: 'idle' });
  };

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensurePreferredDeviceId = async (): Promise<string | null> => {
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices?.();
      const videos = (devices || []).filter((d) => d.kind === 'videoinput');
      return videos.length > 0 ? videos[0].deviceId : null;
    } catch {
      return null;
    }
  };

  const openCamera = async () => {
    setCameraState({ kind: 'starting' });

    if (!window.isSecureContext && !isLocalhost()) {
      setCameraState({
        kind: 'error',
        message: 'Camera requires HTTPS. Open this page over HTTPS (or use localhost during development).',
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState({ kind: 'error', message: 'Camera is not supported by this browser.' });
      return;
    }

    try {
      stopCamera();

      const deviceId = preferredVideoDeviceId ?? (await ensurePreferredDeviceId());
      if (deviceId && !preferredVideoDeviceId) setPreferredVideoDeviceId(deviceId);

      const tryConstraints: MediaStreamConstraints[] = [
        deviceId
          ? { video: { deviceId: { exact: deviceId } }, audio: false }
          : { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;

      for (const c of tryConstraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!stream) {
        const msg = lastErr instanceof Error ? lastErr.message : 'Unable to access camera';
        setCameraState({
          kind: 'error',
          message:
            `Unable to access camera. Check browser site permissions and OS camera privacy settings. Details: ${msg}`,
        });
        return;
      }

      mediaStreamRef.current = stream;

      // Set state to 'open' to render the video element
      setCameraState({ kind: 'open' });

      // Wait multiple render cycles to ensure video element is in DOM
      await new Promise(resolve => setTimeout(resolve, 50));
      await new Promise(resolve => setTimeout(resolve, 50));

      const video = videoRef.current;
      if (!video) {
        stopCamera();
        setCameraState({ kind: 'error', message: 'Camera element was not found.' });
        return;
      }

      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;

      try {
        await video.play();
      } catch (playErr) {
        stopCamera();
        const msg = playErr instanceof Error ? playErr.message : 'Failed to play video';
        setCameraState({
          kind: 'error',
          message: `Failed to start video playback. Details: ${msg}`,
        });
        return;
      }

      try {
        await waitForVideoReady(video, 6000);
        setCameraState({ kind: 'ready' });
      } catch (readyErr) {
        stopCamera();
        const msg = readyErr instanceof Error ? readyErr.message : 'Camera stream timeout';
        setCameraState({
          kind: 'error',
          message: `Camera stream did not initialize. Details: ${msg}`,
        });
      }
    } catch (e) {
      stopCamera();
      const msg = e instanceof Error ? e.message : 'Unable to access camera';
      setCameraState({
        kind: 'error',
        message:
          `Unable to access camera. Check browser site permissions and OS camera privacy settings. Details: ${msg}`,
      });
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSinglePhoto(file);
        stopCamera();
        setErrors((prev) => prev.filter((e) => e.field !== 'images'));
      },
      'image/jpeg',
      0.92
    );
  };

  const verifyBusinessProximity = async () => {
    if (!formData.location) {
      setVerificationMessage('Device location is not available. Please refresh and try again.');
      setFormData((prev) => ({ ...prev, locationVerificationTag: 'Failed Location Verification' }));
      return;
    }

    if (!selectedBusiness?.business_pk) {
      setVerificationMessage('Please select a business first.');
      setFormData((prev) => ({ ...prev, locationVerificationTag: 'Failed Location Verification' }));
      return;
    }

    setIsVerifying(true);
    setVerificationMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-business-proximity', {
        body: {
          business_pk: selectedBusiness.business_pk,
          reporter_lat: formData.location.latitude,
          reporter_lng: formData.location.longitude,
          threshold_meters: 200,
        },
      });

      if (error || !data?.ok) {
        setVerificationMessage('We could not verify proximity. You may continue, but the complaint will be flagged.');
        setVerificationDistanceMeters(null);
        setFormData((prev) => ({ ...prev, locationVerificationTag: 'Failed Location Verification' }));
        return;
      }

      const distance = typeof data.distance_meters === 'number' ? data.distance_meters : null;
      const tag = data.tag as 'Location Verified' | 'Failed Location Verification';

      setVerificationDistanceMeters(distance);
      setFormData((prev) => ({ ...prev, locationVerificationTag: tag }));

      if (tag === 'Location Verified') {
        setVerificationMessage(distance != null ? `Verified. Estimated distance: ${Math.round(distance)}m.` : 'Verified.');
      } else {
        setVerificationMessage(
          distance != null
            ? `Location may be far. Estimated distance: ${Math.round(distance)}m. You may continue, but it will be flagged.`
            : 'Location may be far. You may continue, but it will be flagged.'
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const validateStep = (step: FormStep): boolean => {
    const stepErrors: FormError[] = [];

    switch (step) {
      case 'business-info':
        if (!formData.businessName?.trim()) stepErrors.push({ field: 'businessName', message: 'Business name is required' });
        if (!formData.businessAddress?.trim()) stepErrors.push({ field: 'businessAddress', message: 'Business address is required' });
        if (!formData.businessPk) stepErrors.push({ field: 'businessName', message: 'Please select a business from the list.' });
        break;

      case 'verify-location':
        if (!formData.location) stepErrors.push({ field: 'reporterEmail', message: 'Location is required. Please allow location access.' });
        if (!formData.images || formData.images.length === 0) stepErrors.push({ field: 'images', message: 'Please take a photo.' });
        if (!formData.locationVerificationTag) stepErrors.push({ field: 'reporterEmail', message: 'Please run location verification before continuing.' });
        break;

      case 'complaint-details':
        if (!formData.complaintDescription?.trim()) stepErrors.push({ field: 'complaintDescription', message: 'Please describe your complaint' });
        else if (formData.complaintDescription.length < 20) stepErrors.push({ field: 'complaintDescription', message: 'Please provide at least 20 characters' });
        if (!formData.reporterEmail?.trim()) stepErrors.push({ field: 'reporterEmail', message: 'Email address is required' });
        break;

      case 'evidence':
        break;

      case 'review': {
        const allErrors = validateForm(formData);
        if (allErrors.length > 0) {
          setErrors(allErrors);
          return false;
        }
        if (!formData.certificationAccepted) stepErrors.push({ field: 'reporterEmail', message: 'Certification is required to submit.' });
        break;
      }
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

    const idx = FORM_STEPS.findIndex((s) => s.id === currentStep);
    if (idx < FORM_STEPS.length - 1) {
      setCurrentStep(FORM_STEPS[idx + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousStep = () => {
    const idx = FORM_STEPS.findIndex((s) => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(FORM_STEPS[idx - 1].id);
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
        locationVerificationTag: formData.locationVerificationTag,
        certificationAccepted: !!formData.certificationAccepted,
      };

      const result = await submitComplaint(payload);

      if (result.success) {
        setSubmitMessage(result.message);
        setSubmitError(null);

        setFormData({
          businessName: '',
          businessAddress: '',
          complaintDescription: '',
          reporterEmail: '',
          images: [],
          documents: [],
          businessPk: undefined,
          location: undefined,
          locationVerificationTag: undefined,
          certificationAccepted: false,
        });

        setSelectedBusiness(null);
        setBusinessSearch('');
        setImagePreview(null);
        setVerificationMessage(null);
        setVerificationDistanceMeters(null);
        setErrors([]);
        setCurrentStep('business-info');
      } else {
        setSubmitError(result.message);
      }
    } catch (err) {
      setSubmitError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvidenceFiles = (type: 'documents' | 'images', files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);

    setFormData((prev) => ({
      ...prev,
      [type]: type === 'images' ? [...(prev.images || []), ...list] : list,
    }));

    setErrors((prev) => prev.filter((e) => e.field !== type));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        <div className="space-y-6 animate-fade-in">
          <StepHeader stepIndex={currentStepIndex} stepCount={FORM_STEPS.length} title={stepMeta.title} description={stepMeta.description} />

          {submitMessage && <Alert kind="success" title="Submitted" message={submitMessage} />}
          {submitError && <Alert kind="error" title="Submission failed" message={submitError} />}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Business */}
            {currentStep === 'business-info' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Select business" subtitle="Search and choose the establishment you are reporting.">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7">
                      <Field label="Business name" hint="Type at least 2 characters" error={businessNameError}>
                        <input
                          value={businessSearch}
                          onChange={(e) => setBusinessSearch(e.target.value)}
                          placeholder="Search business name"
                          className={cx(
                            'w-full rounded-xl border px-4 py-3 text-base outline-none transition',
                            businessNameError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                            'focus:ring-4 focus:ring-slate-100 focus:border-slate-400'
                          )}
                        />
                      </Field>

                      {(isBusinessSearching || businessResults.length > 0) && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                          {isBusinessSearching ? (
                            <div className="p-4 text-sm text-slate-600">Searching…</div>
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
                                        locationVerificationTag: undefined,
                                      }));
                                      setVerificationMessage(null);
                                      setVerificationDistanceMeters(null);
                                      setErrors((prev) => prev.filter((e) => e.field !== 'businessName'));
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
                    </div>

                    <div className="lg:col-span-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="text-xs font-semibold text-slate-600 uppercase">Selected business</div>
                        <div className="mt-2 text-base font-semibold text-slate-900">
                          {selectedBusiness?.business_name || 'None selected'}
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-semibold text-slate-600 uppercase">Business address (read-only)</div>
                          <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">
                            {formData.businessAddress || 'Select a business to view its registered address.'}
                          </div>
                          {businessAddressError && <div className="mt-2 text-sm text-red-700 font-semibold">{businessAddressError}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <div className="flex justify-between">
                  <div />
                  <Button type="button" size="lg" onClick={handleNextStep}>Continue</Button>
                </div>
              </div>
            )}

            {/* Step 2: Photo & Location */}
            {currentStep === 'verify-location' && (
              <div className="space-y-6 animate-slide-up">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7">
                    <Panel
                      title="Step 1: Take a photo"
                      subtitle="This supports authenticity checks. Please capture a clear photo at the location."
                    >
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button type="button" size="lg" onClick={() => void openCamera()} disabled={cameraState.kind === 'starting'}>
                            {cameraState.kind === 'starting'
                              ? 'Starting camera…'
                              : cameraState.kind === 'ready'
                                ? 'Camera ready'
                                : cameraState.kind === 'open'
                                  ? 'Connecting…'
                                  : 'Open camera'}
                          </Button>

                          {(cameraState.kind === 'open' || cameraState.kind === 'ready') && (
                            <Button type="button" variant="secondary" size="lg" onClick={stopCamera}>
                              Close camera
                            </Button>
                          )}

                          {imagePreview && (
                            <Button type="button" variant="secondary" size="lg" onClick={() => setSinglePhoto(null)}>
                              Remove photo
                            </Button>
                          )}
                        </div>

                        <div className="text-xs text-slate-600">
                          Status: <span className="font-semibold">{cameraState.kind}</span>
                        </div>

                        {cameraState.kind === 'error' && (
                          <Alert kind="error" title="Camera could not start" message={cameraState.message} />
                        )}

                        {(cameraState.kind === 'open' || cameraState.kind === 'ready') && (
                          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-black/95 animate-scale-in">
                            <video ref={videoRef} className="w-full h-80 object-contain" playsInline muted autoPlay />
                          </div>
                        )}

                        <canvas ref={canvasRef} className="hidden" />

                        {(cameraState.kind === 'open' || cameraState.kind === 'ready') && (
                          <div className="flex flex-wrap gap-3">
                            <Button type="button" size="lg" onClick={capturePhoto} disabled={cameraState.kind !== 'ready'}>
                              Take photo
                            </Button>
                            <Button type="button" variant="secondary" size="lg" onClick={stopCamera}>
                              Stop
                            </Button>
                          </div>
                        )}

                        {imagesError && <div className="text-sm text-red-700 font-semibold">{imagesError}</div>}

                        {imagePreview && (
                          <div className="rounded-2xl border border-slate-200 overflow-hidden animate-scale-in">
                            <img src={imagePreview} alt="Captured" className="w-full h-80 object-cover" />
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>

                  <div className="lg:col-span-5">
                    <Panel title="Step 2: Verify location" subtitle="We compare your device location with the business address.">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="text-sm text-slate-700">
                            <div className="font-semibold text-slate-900">Device location</div>
                            {locationStatus.kind === 'requesting' && <div className="mt-1">Requesting permission…</div>}
                            {locationStatus.kind === 'captured' && (
                              <div className="mt-1">
                                {formData.location?.latitude.toFixed(6)}, {formData.location?.longitude.toFixed(6)}
                                {formData.location?.accuracy != null && (
                                  <span className="text-slate-500"> (±{Math.round(formData.location.accuracy)}m)</span>
                                )}
                              </div>
                            )}
                            {locationStatus.kind === 'blocked' && (
                              <div className="mt-1 text-red-700 font-semibold">{locationStatus.message}</div>
                            )}
                            {locationError && <div className="mt-1 text-red-700 font-semibold">{locationError}</div>}
                          </div>

                          <Button type="button" variant="secondary" onClick={requestDeviceLocation}>
                            Refresh
                          </Button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button type="button" size="lg" disabled={isVerifying || !selectedBusiness?.business_pk || !formData.location} onClick={verifyBusinessProximity}>
                            {isVerifying ? 'Verifying…' : 'Run verification'}
                          </Button>

                          <Button type="button" variant="secondary" size="lg" disabled={!formData.locationVerificationTag} onClick={handleNextStep}>
                            Continue
                          </Button>
                        </div>

                        {!formData.locationVerificationTag && (
                          <div className="text-xs text-slate-600">Run verification once before continuing.</div>
                        )}

                        {verificationMessage && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 animate-slide-up">
                            <div className="text-sm font-semibold text-slate-900">Result</div>
                            <div className="mt-1 text-sm text-slate-800 leading-relaxed">{verificationMessage}</div>
                            {typeof verificationDistanceMeters === 'number' && (
                              <div className="mt-1 text-sm text-slate-700">Distance: {Math.round(verificationDistanceMeters)}m</div>
                            )}
                            {formData.locationVerificationTag && (
                              <div className="mt-1 text-sm text-slate-700">
                                Tag: <span className="font-semibold">{formData.locationVerificationTag}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {formData.locationVerificationTag === 'Failed Location Verification' && (
                          <Alert kind="warning" title="Flagged" message="You may continue, but your complaint will be flagged for review." />
                        )}
                      </div>
                    </Panel>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" size="lg" onClick={handlePreviousStep}>Back</Button>
                  <Button type="button" variant="secondary" size="lg" disabled={!formData.locationVerificationTag} onClick={handleNextStep}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Complaint details */}
            {currentStep === 'complaint-details' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Complaint details" subtitle="Describe what happened in your own words.">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7">
                      <Field label="What happened?" hint="Minimum 20 characters" error={complaintDescriptionError}>
                        <textarea
                          value={formData.complaintDescription || ''}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, complaintDescription: e.target.value }));
                            setErrors((prev) => prev.filter((err) => err.field !== 'complaintDescription'));
                          }}
                          rows={8}
                          placeholder="Describe what happened"
                          className={cx(
                            'w-full rounded-xl border px-4 py-3 text-base outline-none resize-none transition',
                            complaintDescriptionError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                            'focus:ring-4 focus:ring-slate-100 focus:border-slate-400'
                          )}
                        />
                      </Field>
                    </div>

                    <div className="lg:col-span-5 space-y-5">
                      <Field label="Your email" error={reporterEmailError}>
                        <input
                          type="email"
                          value={formData.reporterEmail || ''}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, reporterEmail: e.target.value }));
                            setErrors((prev) => prev.filter((err) => err.field !== 'reporterEmail'));
                          }}
                          placeholder="name@example.com"
                          className={cx(
                            'w-full rounded-xl border px-4 py-3 text-base outline-none transition',
                            reporterEmailError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                            'focus:ring-4 focus:ring-slate-100 focus:border-slate-400'
                          )}
                        />
                      </Field>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 animate-scale-in">
                        <div className="text-xs font-semibold text-slate-600 uppercase">Privacy</div>
                        <div className="mt-2 text-sm text-slate-800 leading-relaxed">
                          Your email is used to verify your complaint submission and for updates related to this report.
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" size="lg" onClick={handlePreviousStep}>Back</Button>
                  <Button type="button" size="lg" onClick={handleNextStep}>Continue</Button>
                </div>
              </div>
            )}

            {/* Step 4: Evidence */}
            {currentStep === 'evidence' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Optional supporting files" subtitle="Add more photos or documents if you have them.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="More photos (optional)" error={imagesError}>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleEvidenceFiles('images', e.target.files)}
                        className="block w-full text-sm text-slate-700"
                      />
                    </Field>

                    <Field label="Documents (optional)" error={documentsError}>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleEvidenceFiles('documents', e.target.files)}
                        className="block w-full text-sm text-slate-700"
                      />
                    </Field>
                  </div>
                </Panel>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" size="lg" onClick={handlePreviousStep}>Back</Button>
                  <Button type="button" size="lg" onClick={handleNextStep}>Continue</Button>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 'review' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Review" subtitle="Please confirm the information below.">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 animate-scale-in">
                      <div className="text-xs font-semibold text-slate-600 uppercase">Business</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{formData.businessName}</div>
                      <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{formData.businessAddress}</div>
                      <div className="mt-3 text-sm text-slate-700">
                        Location tag: <span className="font-semibold">{formData.locationVerificationTag || 'Not available'}</span>
                      </div>
                    </div>

                    <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 animate-scale-in">
                      <div className="text-xs font-semibold text-slate-600 uppercase">Complaint</div>
                      <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{formData.complaintDescription}</div>
                      <div className="mt-3 text-sm text-slate-700">
                        Email: <span className="font-semibold">{formData.reporterEmail}</span>
                      </div>
                    </div>

                    <div className="lg:col-span-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 animate-scale-in">
                      <div className="text-xs font-semibold text-slate-600 uppercase">Certification</div>
                      <label className="mt-3 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={!!formData.certificationAccepted}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, certificationAccepted: e.target.checked }));
                            setErrors((prev) => prev.filter((err) => err.field !== 'reporterEmail'));
                          }}
                          className="mt-1 h-5 w-5"
                        />
                        <span className="text-sm text-slate-800 leading-relaxed">
                          I certify that all the information I entered is true and the falsification may result in the non-acceptance of the complaint.
                        </span>
                      </label>
                      {!formData.certificationAccepted && (
                        <div className="mt-2 text-sm text-slate-600">You must certify before submitting.</div>
                      )}
                    </div>
                  </div>
                </Panel>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" size="lg" onClick={handlePreviousStep}>Back</Button>
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting…' : 'Submit'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
