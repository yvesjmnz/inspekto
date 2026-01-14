import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { submitComplaint } from './db';
import { validateForm, getFieldError } from './validation';
import type { ComplaintFormData, FormError } from './types';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';
import { Field } from './ui/Field';
import { Alert } from './ui/Alert';
import { StepHeader } from './ui/StepHeader';
import { HelpText } from './ui/HelpText';

function formatGeo(value: number | undefined | null, digits = 6): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function formatAccuracyMeters(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `±${Math.round(value)}m`;
}

function formatDistanceMeters(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}m`;
}

type FormStep = 'business-info' | 'photo' | 'location' | 'complaint-details' | 'evidence' | 'review';

const FORM_STEPS: Array<{ id: FormStep; title: string; description: string }> = [
  { id: 'business-info', title: 'Business', description: 'Select the business.' },
  { id: 'photo', title: 'Photo', description: 'Take one photo.' },
  { id: 'location', title: 'Location', description: 'Confirm and verify location.' },
  { id: 'complaint-details', title: 'Details', description: 'Describe what happened.' },
  { id: 'evidence', title: 'Evidence', description: 'Optional uploads.' },
  { id: 'review', title: 'Review', description: 'Submit your complaint.' },
];

type BusinessLookupRow = {
  business_pk: number;
  business_name: string | null;
  business_address: string | null;
  business_lat: number | null;
  business_lng: number | null;
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

function getCameraStatusLabel(state: CameraState): string {
  switch (state.kind) {
    case 'idle':
      return 'Ready to open camera';
    case 'starting':
      return 'Starting camera...';
    case 'open':
      return 'Connecting to camera...';
    case 'ready':
      return 'Camera is ready';
    case 'error':
      return 'Camera error';
  }
}

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

export default function ComplaintForm({ prefillEmail }: { prefillEmail?: string }) {
  const navigate = useNavigate();
  const formTopRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    setFormData((prev) => ({ ...prev, reporterEmail: prefillEmail ?? prev.reporterEmail ?? '' }));
  }, [prefillEmail]);

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
        .select('business_pk,business_name,business_address,business_lat,business_lng')
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
      setVerificationMessage('Location not available. Refresh and try again.');
      setFormData((prev) => ({ ...prev, locationVerificationTag: 'Failed Location Verification' }));
      return;
    }

    if (!selectedBusiness?.business_pk) {
      setVerificationMessage('Select a business first.');
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

      // If the function returned resolved business coords, store them locally for map preview.
      if (data?.business_coords && typeof data.business_coords.lat === 'number' && typeof data.business_coords.lng === 'number') {
        setSelectedBusiness((prev) =>
          prev
            ? { ...prev, business_lat: data.business_coords.lat, business_lng: data.business_coords.lng }
            : prev
        );
      }

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

  const focusFirstInvalidField = (stepErrors: FormError[]) => {
    const fields: Array<FormError['field']> = stepErrors.map((e) => e.field);

    const focusable: Array<FormError['field']> = [
      'businessName',
      'images',
      'complaintDescription',
      'reporterEmail',
    ];

    const first = focusable.find((f) => fields.includes(f));
    if (!first) {
      formTopRef.current?.focus?.();
      return;
    }

    const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
    el?.focus?.();
  };

  const validateStep = (step: FormStep): boolean => {
    const stepErrors: FormError[] = [];

    switch (step) {
      case 'business-info':
        if (!formData.businessName?.trim()) stepErrors.push({ field: 'businessName', message: 'Select a business.' });
        if (!formData.businessAddress?.trim()) stepErrors.push({ field: 'businessAddress', message: 'Business address is required.' });
        if (!formData.businessPk) stepErrors.push({ field: 'businessName', message: 'Select from the list.' });
        break;

      case 'photo':
        if (!formData.images || formData.images.length === 0) stepErrors.push({ field: 'images', message: 'Photo required.' });
        break;

      case 'location':
        if (!formData.location) stepErrors.push({ field: 'reporterEmail', message: 'Location required.' });
        if (!formData.locationVerificationTag) stepErrors.push({ field: 'reporterEmail', message: 'Run verification.' });
        break;

      case 'complaint-details':
        if (!formData.complaintDescription?.trim()) stepErrors.push({ field: 'complaintDescription', message: 'Add details.' });
        else if (formData.complaintDescription.length < 20) stepErrors.push({ field: 'complaintDescription', message: 'At least 20 characters.' });
        if (!formData.reporterEmail?.trim()) stepErrors.push({ field: 'reporterEmail', message: 'Email required.' });
        break;

      case 'evidence':
        break;

      case 'review': {
        const allErrors = validateForm(formData);
        if (allErrors.length > 0) {
          setErrors(allErrors);
          return false;
        }
        if (!formData.certificationAccepted) stepErrors.push({ field: 'reporterEmail', message: 'Certification required.' });
        break;
      }
    }

    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      window.setTimeout(() => focusFirstInvalidField(stepErrors), 0);
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
      formTopRef.current?.focus?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousStep = () => {
    const idx = FORM_STEPS.findIndex((s) => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(FORM_STEPS[idx - 1].id);
      formTopRef.current?.focus?.();
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
        businessPk: formData.businessPk,
        location: formData.location,
        locationVerificationTag: formData.locationVerificationTag,
        certificationAccepted: !!formData.certificationAccepted,
      };

      const result = await submitComplaint(payload);

      if (result.success && result.complaintId) {
        const emailToUse = (formData.reporterEmail || '').trim();

        // Send confirmation email with complaint ID
        try {
          await supabase.functions.invoke('send-complaint-confirmation', {
            body: {
              email: emailToUse,
              complaintId: result.complaintId,
            },
          });
        } catch (emailErr) {
          console.error('Failed to send confirmation email:', emailErr);
          // Continue anyway - complaint was submitted successfully
        }

        // Clear local form state (user can start a new submission from the submit page)
        setSubmitMessage(null);
        setSubmitError(null);

        setFormData({
          businessName: '',
          businessAddress: '',
          complaintDescription: '',
          reporterEmail: '',
          images: [],
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

        navigate('/complaints/confirmation', {
          state: {
            complaintId: result.complaintId,
            email: emailToUse,
          },
        });
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

  const handleEvidenceFiles = (type: 'images', files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);

    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...list],
    }));

    setErrors((prev) => prev.filter((e) => e.field !== type));
  };

  return (
    <div
      ref={formTopRef}
      tabIndex={-1}
      className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-white focus:outline-none"
    >
      <div className="mx-auto w-full max-w-[1600px] px-16 py-16">
        <div className="space-y-10 animate-fade-in-slow">
          <div className="rounded-3xl border border-slate-200 bg-white/95 backdrop-blur-sm p-10 shadow-lg-glow transition-all duration-500 ease-out hover:shadow-lg-glow animate-bounce-in">
            <StepHeader stepIndex={currentStepIndex} stepCount={FORM_STEPS.length} title={stepMeta.title} description={stepMeta.description} />
          </div>

          {submitError && <Alert kind="error" title="Submission failed" message={submitError} />}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Business */}
            {currentStep === 'business-info' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Select business" subtitle="Search and choose the establishment you are reporting.">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-7">
                      <Field label="Business name" hint="Type at least 2 characters" error={businessNameError}>
                        <input
                          data-field="businessName"
                          value={businessSearch}
                          onChange={(e) => setBusinessSearch(e.target.value)}
                          placeholder="Search business name"
                          autoComplete="off"
                          className={cx(
                            'w-full rounded-xl border px-5 py-4 text-lg outline-none transition',
                            businessNameError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                            'focus:ring-4 focus:ring-slate-100 focus:border-slate-400'
                          )}
                        />
                      </Field>

                      {(isBusinessSearching || businessResults.length > 0) && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                          {isBusinessSearching ? (
                            <div className="p-4 text-sm text-slate-600">Searching…</div>
                          ) : (
                            <ul className="max-h-72 overflow-auto">
                              {businessResults.map((b) => (
                                <li key={b.business_pk}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition focus:outline-none focus:bg-slate-50"
                                    onClick={() => {
                                      setSelectedBusiness(b)
                                      setBusinessSearch(b.business_name || '')
                                      setBusinessResults([])
                                      setFormData((prev) => ({
                                        ...prev,
                                        businessPk: b.business_pk,
                                        businessName: b.business_name || '',
                                        businessAddress: b.business_address || '',
                                        locationVerificationTag: undefined,
                                      }))
                                      setVerificationMessage(null)
                                      setVerificationDistanceMeters(null)
                                      setErrors((prev) => prev.filter((e) => e.field !== 'businessName'))
                                    }}
                                  >
                                    <div className="text-sm font-semibold text-slate-900">{b.business_name || 'Unnamed business'}</div>
                                    <div className="text-xs text-slate-600 mt-1">{b.business_address || 'No address on file'}</div>
                                  </button>
                                </li>
                              ))}
                              {businessResults.length === 0 && (
                                <li className="p-4 text-sm text-slate-600">No matches found.</li>
                              )}
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Before you continue</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
                    <li>Select a business from the list so we capture the correct address.</li>
                  </ul>
                </div>

                <div className="flex justify-between">
                  <div />
                  <Button type="button" size="lg" onClick={handleNextStep}>Continue</Button>
                </div>
              </div>
            )}

            {/* Step 2: Photo */}
            {currentStep === 'photo' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Take a photo" subtitle="One clear photo is required.">
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
                          Close
                        </Button>
                      )}

                      {imagePreview && (
                        <Button type="button" variant="secondary" size="lg" onClick={() => setSinglePhoto(null)}>
                          Remove
                        </Button>
                      )}
                    </div>

                    {cameraState.kind === 'error' && (
                      <Alert kind="error" title="Camera" message={cameraState.message} />
                    )}

                    {(cameraState.kind === 'open' || cameraState.kind === 'ready') && (
                      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-black/95">
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
                      <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <img src={imagePreview} alt="Uploaded evidence" className="w-full h-80 object-cover" />
                      </div>
                    )}
                  </div>
                </Panel>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" size="lg" onClick={handlePreviousStep}>Back</Button>
                  <Button type="button" size="lg" onClick={handleNextStep} disabled={!formData.images || formData.images.length === 0}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {currentStep === 'location' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Location" subtitle="Confirm and verify.">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      <div className="lg:col-span-7">
                        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                        {formData.location ? (
                          <img
                            alt="Map preview"
                            className="w-full h-80 object-cover"
                            src={(() => {
                              const userLat = formData.location?.latitude;
                              const userLng = formData.location?.longitude;
                              const bizLat = selectedBusiness?.business_lat;
                              const bizLng = selectedBusiness?.business_lng;

                              // Use a free static OSM preview with multiple markers.
                              // Note: business marker appears once coords are available.
                              const base = 'https://staticmap.openstreetmap.de/staticmap.php';
                              const size = '800x420';

                              const markers: string[] = [];
                              markers.push(`markers=${encodeURIComponent(`${userLat},${userLng},blue-pushpin`)}`);
                              if (typeof bizLat === 'number' && typeof bizLng === 'number') {
                                markers.push(`markers=${encodeURIComponent(`${bizLat},${bizLng},red-pushpin`)}`);
                              }

                              return `${base}?size=${size}&maptype=mapnik&zoom=15&${markers.join('&')}`;
                            })()}
                          />
                        ) : (
                          <div className="p-6 text-slate-700">Location not available.</div>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        Blue: you. Red: business.
                      </div>
                      </div>

                      <div className="lg:col-span-5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="text-sm text-slate-700">
                            <div className="font-semibold text-slate-900">Device location</div>
                            {locationStatus.kind === 'requesting' && <div className="mt-1">Requesting…</div>}
                            {locationStatus.kind === 'captured' && (
                              <div className="mt-1">
                                {formatGeo(formData.location?.latitude)}, {formatGeo(formData.location?.longitude)}
                                {formData.location?.accuracy != null && (
                                  <span className="text-slate-500"> ({formatAccuracyMeters(formData.location?.accuracy)})</span>
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

                        <Button
                          type="button"
                          size="lg"
                          disabled={isVerifying || !selectedBusiness?.business_pk || !formData.location}
                          onClick={verifyBusinessProximity}
                        >
                          {isVerifying ? 'Verifying…' : 'Run verification'}
                        </Button>

                        {verificationMessage && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-semibold text-slate-900">Result</div>
                            <div className="mt-1 text-sm text-slate-800">{verificationMessage}</div>
                            {typeof verificationDistanceMeters === 'number' && (
                              <div className="mt-1 text-sm text-slate-700">Distance: {formatDistanceMeters(verificationDistanceMeters)}</div>
                            )}
                          </div>
                        )}

                        {formData.locationVerificationTag === 'Failed Location Verification' && (
                          <Alert kind="warning" title="Flagged" message="This complaint will be flagged." />
                        )}
                      </div>
                    </div>
                  </div>
                </Panel>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" size="lg" onClick={handlePreviousStep}>Back</Button>
                  <Button type="button" size="lg" disabled={!formData.locationVerificationTag} onClick={handleNextStep}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Complaint details */}
            {currentStep === 'complaint-details' && (
              <div className="space-y-6 animate-slide-up">
                <Panel title="Complaint details" subtitle="Describe what happened in your own words.">
                  <div className="space-y-8">
                    <Field label="What happened?" hint="Minimum 20 characters" error={complaintDescriptionError}>
                      <div className="space-y-2">
                        <textarea
                          data-field="complaintDescription"
                          value={formData.complaintDescription || ''}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, complaintDescription: e.target.value }));
                            setErrors((prev) => prev.filter((err) => err.field !== 'complaintDescription'));
                          }}
                          rows={10}
                          placeholder="Describe what happened"
                          className={cx(
                            'w-full rounded-xl border px-5 py-4 text-lg outline-none resize-none transition',
                            complaintDescriptionError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                            'focus:ring-4 focus:ring-slate-100 focus:border-slate-400'
                          )}
                        />
                        <div className="flex justify-end">
                          <div className="text-sm font-medium text-slate-600 bg-slate-50 px-4 py-2 rounded-lg animate-fade-in">
                            {(formData.complaintDescription || '').length} characters
                          </div>
                        </div>
                      </div>
                    </Field>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <Field label="Your email" error={reporterEmailError}>
                        <input
                          data-field="reporterEmail"
                          type="email"
                          value={formData.reporterEmail || ''}
                          autoComplete="email"
                          inputMode="email"
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, reporterEmail: e.target.value }));
                            setErrors((prev) => prev.filter((err) => err.field !== 'reporterEmail'));
                          }}
                          placeholder="name@example.com"
                          className={cx(
                            'w-full rounded-xl border px-5 py-4 text-lg outline-none transition',
                            reporterEmailError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                            'focus:ring-4 focus:ring-slate-100 focus:border-slate-400'
                          )}
                        />
                      </Field>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 animate-scale-in flex flex-col justify-center">
                        <div className="text-xs font-semibold text-slate-600 uppercase">Privacy</div>
                        <div className="mt-2 text-sm text-slate-800 leading-relaxed">
                          Your email is used to verify your complaint submission and for updates related to this report.
                        </div>
                        <div className="mt-3 text-xs text-slate-600">
                          If you do not have an email, ask a friend or family member for help.
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
                <Panel title="Additional photos" subtitle="Optional: add extra photos to support your complaint.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Additional photos" error={imagesError} required={false}>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleEvidenceFiles('images', e.target.files)}
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
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                      <HelpText>This step helps reduce false reports.</HelpText>
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
