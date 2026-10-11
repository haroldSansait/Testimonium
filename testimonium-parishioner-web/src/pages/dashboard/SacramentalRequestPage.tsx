import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Copy, FileText, AlertCircle, ShieldCheck } from 'lucide-react';
import services from '../../providers/factory';
import { useParishes, usePausePolling } from '../../hooks/useService';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
import { useAuth } from '../../contexts/AuthContext';
import type { SacramentalRequest } from '../../types';
import {
  CANONICAL_DOCUMENT_TYPES,
  DEFAULT_OFFERED_DOCUMENTS,
} from '../../config/documents';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Stepper } from '../../components/ui/Stepper';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { UPLOAD_POLICIES, validateUploadFile } from '../../utils/uploadPolicy';

const LocalImagePreview: React.FC<{ file: File; alt: string }> = ({ file, alt }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <img src={url} alt={alt} className="w-full h-36 object-contain rounded bg-gray-900" /> : null;
};

export const SacramentalRequestPage: React.FC = () => {
  usePausePolling(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParishId = searchParams.get('parishId');

  const parishesQuery = useParishes();
  const parishes = parishesQuery.data || [];
  const { loading, error, refetch } = parishesQuery;

  const { isProfileIncomplete, openProfileModal } = useProfileRequirement();
  const { appProfile } = useAuth();
  const isGovIdVerified = Boolean(appProfile?.isGovernmentIdVerified);

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (isProfileIncomplete) {
      openProfileModal('request certificates');
    }
  }, [isProfileIncomplete, openProfileModal]);

  // Form State
  const [selectedParishId, setSelectedParishId] = useState('');
  const [docType, setDocType] = useState<string>('BAPTISMAL_CERTIFICATE');
  const [applicantFirstName, setApplicantFirstName] = useState('');
  const [applicantMiddleName, setApplicantMiddleName] = useState('');
  const [applicantLastName, setApplicantLastName] = useState('');
  const [relationship, setRelationship] = useState('Self');
  const [purpose, setPurpose] = useState('');
  const [registryYear, setRegistryYear] = useState('');

  // Dynamic Requirements State
  const [requirementsList, setRequirementsList] = useState<Array<{ id: string; label: string; required: boolean; description?: string }>>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [uploadedFilesByReq, setUploadedFilesByReq] = useState<Record<string, File>>({});
  const [reqErrors, setReqErrors] = useState<Record<string, string>>({});

  // Authorization Letter for Authorized Representatives
  const [authLetterFile, setAuthLetterFile] = useState<File | null>(null);
  const [authLetterError, setAuthLetterError] = useState<string | null>(null);
  const [registrantIdFront, setRegistrantIdFront] = useState<File | null>(null);
  const [registrantIdBack, setRegistrantIdBack] = useState<File | null>(null);
  const [registrantIdErrors, setRegistrantIdErrors] = useState<Record<string, string>>({});
  const draftRef = useRef<{ id: string; fingerprint: string } | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Success State
  const [createdRequest, setCreatedRequest] = useState<SacramentalRequest | null>(null);

  // Sync selected parish with query params
  useEffect(() => {
    if (parishes.length > 0) {
      if (queryParishId) {
        setSelectedParishId(queryParishId);
      } else if (!selectedParishId) {
        setSelectedParishId(parishes[0].id);
      }
    }
  }, [queryParishId, parishes, selectedParishId]);

  const selectedParish = parishes.find((p) => String(p.id) === String(selectedParishId));
  const availableDocList = selectedParish
    ? (selectedParish.availableDocuments !== null && selectedParish.availableDocuments !== undefined
        ? selectedParish.availableDocuments
        : DEFAULT_OFFERED_DOCUMENTS)
    : DEFAULT_OFFERED_DOCUMENTS;

  const filteredDocTypes = Array.isArray(availableDocList)
    ? CANONICAL_DOCUMENT_TYPES.filter((doc) => availableDocList.includes(doc.type))
    : CANONICAL_DOCUMENT_TYPES;

  // Auto-reset docType if selected parish doesn't offer current docType
  useEffect(() => {
    if (filteredDocTypes.length > 0 && !filteredDocTypes.some((d) => d.type === docType)) {
      setDocType(filteredDocTypes[0].type);
    } else if (filteredDocTypes.length === 0) {
      setDocType('');
    }
  }, [selectedParishId, filteredDocTypes, docType]);

  // Fetch dynamic requirements when step becomes upload step
  useEffect(() => {
    if (currentStep === 3) {
      setLoadingReqs(true);
      services.request.getDocumentRequirements(docType, selectedParishId, relationship)
        .then(res => {
          const reqs = res?.requiredDocuments || [];
          setRequirementsList(reqs);
          setLoadingReqs(false);
        })
        .catch(err => {
          console.error("Failed to load document requirements:", err);
          setRequirementsList([]);
          setLoadingReqs(false);
        });
    }
  }, [currentStep, docType, selectedParishId, relationship]);

  const steps = ['Select Parish', 'Document Details', 'Applicant Info', 'Upload Requirements', 'Confirmation'];

  const handleNext = () => {
    if (currentStep === 0 && !selectedParishId) return;
    if (currentStep === 1 && !docType) return;
    if (currentStep === 2) {
      if (!applicantFirstName.trim() || !applicantLastName.trim()) {
        return;
      }
      if (isProfileIncomplete) {
        openProfileModal('request certificates');
        return;
      }
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleRelationshipChange = (newRel: string) => {
    if (newRel !== relationship) {
      draftRef.current = null;
      idempotencyKeyRef.current = null;
    }
    setRelationship(newRel);
  };

  const handleRegistrantIdUpload = (side: 'front' | 'back', file: File) => {
    const result = validateUploadFile(file, UPLOAD_POLICIES.REGISTRANT_ID_IMAGE);
    if (!result.valid) {
      setRegistrantIdErrors((current) => ({ ...current, [side]: result.error || 'Select a JPEG or PNG image under 5 MB.' }));
      return;
    }
    setRegistrantIdErrors((current) => {
      const next = { ...current };
      delete next[side];
      return next;
    });
    if (side === 'front') setRegistrantIdFront(file);
    else setRegistrantIdBack(file);
  };

  const handleAuthLetterUpload = (file: File) => {
    setAuthLetterError(null);
    const result = validateUploadFile(file, UPLOAD_POLICIES.AUTHORIZATION_LETTER);
    if (!result.valid) {
      setAuthLetterError(result.error || "Unsupported file format. Accepted formats: PDF, JPG, or PNG — up to 5 MB.");
      return;
    }
    setAuthLetterFile(file);
  };

  const handleUploadForReq = (reqId: string, file: File) => {
    const result = validateUploadFile(file, UPLOAD_POLICIES.SUPPORTING_DOCUMENT);
    if (!result.valid) {
      setReqErrors(prev => ({
        ...prev,
        [reqId]: result.error || "Unsupported file format. Accepted formats: PDF, JPG, PNG, or WebP — up to 5 MB.",
      }));
      return;
    }
    setReqErrors(prev => {
      const copy = { ...prev };
      delete copy[reqId];
      return copy;
    });
    setUploadedFilesByReq(prev => ({
      ...prev,
      [reqId]: file
    }));
  };

  const handleRemoveFileForReq = (reqId: string) => {
    setReqErrors(prev => {
      const copy = { ...prev };
      delete copy[reqId];
      return copy;
    });
    setUploadedFilesByReq(prev => {
      const copy = { ...prev };
      delete copy[reqId];
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (isProfileIncomplete) {
      openProfileModal('request certificates');
      return;
    }
    setSubmitting(true);
    setSubmissionError(null);
    try {
      // 1. Create request draft
      // Append registry year to purpose to pass it along safely without schema adjustments
      const finalPurpose = registryYear 
        ? `${purpose} (Approximate Registry Year: ${registryYear})`
        : purpose;

      const payloadFingerprint = JSON.stringify({ selectedParishId, docType, applicantFirstName: applicantFirstName.trim(), applicantMiddleName: applicantMiddleName.trim(), applicantLastName: applicantLastName.trim(), relationship, finalPurpose });
      if (draftRef.current && draftRef.current.fingerprint !== payloadFingerprint) {
        draftRef.current = null;
        idempotencyKeyRef.current = null;
      }
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = globalThis.crypto?.randomUUID?.() || `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const draft = draftRef.current ? { id: draftRef.current.id } : await services.request.createRequest({
        parishId: selectedParishId,
        documentType: docType as any,
        applicantFirstName: applicantFirstName.trim(),
        applicantMiddleName: applicantMiddleName.trim() || undefined,
        applicantLastName: applicantLastName.trim(),
        relationship,
        purpose: finalPurpose,
        idempotencyKey: idempotencyKeyRef.current,
      });
      if (!draftRef.current) draftRef.current = { id: draft.id, fingerprint: payloadFingerprint };

      // 2. Upload requirements if any are present
      const activeRequirementIds = new Set(requirementsList.filter((item) => item.required && item.id !== 'valid_id').map((item) => item.id));
      const reqFiles = Object.entries(uploadedFilesByReq).filter(([id]) => activeRequirementIds.has(id));
      for (const [reqId, file] of reqFiles) {
        await services.request.uploadFiles(draft.id, [file], reqId);
      }

      // 2b. Upload mandatory relationship evidence for every non-Self request.
      if (relationship !== 'Self') {
        if (!authLetterFile) {
          setSubmissionError("An authorization letter is required when requesting a document for another person.");
          setSubmitting(false);
          return;
        }
        if (!registrantIdFront || !registrantIdBack) {
          setSubmissionError("Front and back images of the registrant's Government ID are required.");
          setSubmitting(false);
          return;
        }
        await services.request.uploadFiles(draft.id, [authLetterFile], 'authorization_letter');
        await services.request.uploadRegistrantId(draft.id, { front: registrantIdFront, back: registrantIdBack });
      }

      // 3. Finalize and submit the request
      const finalized = await services.request.submitDraft(draft.id);

      setCreatedRequest(finalized);
      draftRef.current = null;
      idempotencyKeyRef.current = null;
      setCurrentStep(4);
    } catch (err: any) {
      console.error("Request submission error:", err);
      if (err?.code === "PROFILE_INCOMPLETE") {
        openProfileModal('request certificates');
      } else if (err?.code === "IDENTITY_NOT_VERIFIED") {
        setSubmissionError("Please verify your Government ID in your profile before submitting requests.");
      } else if (err?.code === "AUTHORIZATION_LETTER_REQUIRED") {
        setSubmissionError("An authorization letter is required when requesting a document for another person.");
      } else if (err?.code === "REGISTRANT_ID_REQUIRED") {
        setSubmissionError("Front and back images of the registrant's Government ID are required.");
      } else if (err?.code === "SELF_REGISTRANT_NAME_MISMATCH" || err?.code === "SELF_REGISTRANT_NAME_UNAVAILABLE") {
        setSubmissionError(err?.message || "Please check that the registrant name matches your verified profile name.");
      } else {
        setSubmissionError(err?.message || "Failed to submit document request. Please review your information.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTracking = () => {
    if (createdRequest && createdRequest.trackingNumber) {
      navigator.clipboard.writeText(createdRequest.trackingNumber);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Sacramental Request Wizard" 
          description="Submit requirements and request official certificates from canonical registries."
          onRefresh={refetch}
          breadcrumbs={['Home', 'Request Document']}
        />
        <ErrorState 
          title="Unable to load parishes" 
          description="We had trouble loading the available registry locations. Please check your connection and try again."
          onRetry={refetch} 
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader 
          title="Sacramental Request Wizard" 
          description="Submit requirements and request official certificates from canonical registries."
          onRefresh={refetch}
          isRefreshing={true}
          breadcrumbs={['Home', 'Request Document']}
        />
        <Card>
          <CardContent className="pt-6 space-y-8">
            <div className="flex justify-between items-center max-w-xl mx-auto">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  {i < 5 && <Skeleton className="h-1 w-12 sm:w-16 rounded" />}
                </div>
              ))}
            </div>
            <div className="space-y-4 max-w-xl mx-auto pt-4">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-4 w-60 rounded" />
              <Skeleton className="h-10 w-full rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAuthLetterRequired = relationship !== 'Self';
  const allReqsUploaded = requirementsList.every(req => {
    if (!req.required) return true;
    if (req.id === 'valid_id' && isGovIdVerified) return true;
    return !!uploadedFilesByReq[req.id];
  }) && (!isAuthLetterRequired || (!!authLetterFile && !!registrantIdFront && !!registrantIdBack));

  if (isProfileIncomplete) {
    return (
      <div className="space-y-6" aria-live="polite">
        <PageHeader 
          title="Sacramental Request Wizard" 
          description="Submit requirements and request official certificates from canonical registries."
          onRefresh={refetch}
          breadcrumbs={['Home', 'Request Document']}
        />

        <Card className="bg-white border-border shadow-sm">
          <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-bold text-text-primary">
                Profile Completion Required
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Complete your profile to access document and schedule requests. Parish offices require your official contact details (Full Name and Mobile Number) for identity verification and notification updates.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
              <Button
                variant="outline"
                size="md"
                className="px-5"
                onClick={() => navigate('/dashboard/home')}
              >
                Return to Dashboard
              </Button>
              <Button
                size="md"
                className="px-5"
                onClick={() => navigate('/dashboard/profile')}
              >
                Complete Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isGovIdVerified) {
    return (
      <div className="space-y-6" aria-live="polite">
        <PageHeader
          title="Sacramental Request Wizard"
          description="Submit requirements and request official certificates from canonical registries."
          onRefresh={refetch}
          breadcrumbs={['Home', 'Request Document']}
        />

        <Card className="bg-white border-border shadow-sm">
          <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-full bg-crimson/10 text-crimson flex items-center justify-center">
              <ShieldCheck size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-bold text-text-primary">
                Government ID Verification Required
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                You must verify your Government ID before requesting sacramental certificates. Parish offices require an official Philippine government-issued card (PhilSys, Driver's License, UMID, Voter's ID, or Postal ID).
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
              <Button
                variant="outline"
                size="md"
                className="px-5"
                onClick={() => navigate('/dashboard/home')}
              >
                Return to Dashboard
              </Button>
              <Button
                size="md"
                className="px-5"
                onClick={() => navigate('/dashboard/profile')}
              >
                Verify Government ID
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-live="polite">
      <PageHeader 
        title="Sacramental Request Wizard" 
        description="Submit requirements and request official certificates from canonical registries."
        onRefresh={refetch}
        breadcrumbs={['Home', 'Request Document']}
      />

      {submissionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-card flex items-center gap-2.5 text-red-800 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{submissionError}</span>
        </div>
      )}

      <Card className="bg-white border-border shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-8">
            <Stepper steps={steps} currentStep={currentStep} />
          </div>

          {/* Step 1: Select Parish */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Target Parish Office
                </label>
                <p className="text-xs text-text-muted">Select the parish containing the original canonical record registry.</p>
              </div>
              <CustomSelect
                value={selectedParishId}
                onChange={setSelectedParishId}
                placeholder="Select parish..."
                options={parishes.map(parish => ({
                  value: parish.id,
                  label: parish.name,
                  secondary: parish.city ? `${parish.city}, ${parish.province || ''}` : undefined,
                }))}
                searchable
                searchPlaceholder="Search parish by name or city..."
              />
              <div className="flex justify-end pt-4">
                <Button onClick={handleNext}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 2: Document Details */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Document Certificate Type
                </label>
                <p className="text-xs text-text-muted">Select from the official sacramental document types.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredDocTypes.map(doc => (
                  <button
                    key={doc.type}
                    onClick={() => setDocType(doc.type)}
                    className={`p-4 border rounded-button text-left font-serif text-sm transition-all focus-ring ${
                      docType === doc.type 
                        ? 'border-crimson bg-red-50/20 text-crimson font-bold shadow-sm' 
                        : 'border-border text-text-primary hover:bg-app-page'
                    }`}
                  >
                    <div className="font-serif font-bold text-sm leading-snug">{doc.title}</div>
                    <div className="text-[10px] text-text-muted mt-1 font-sans font-normal truncate">{doc.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev}>Back</Button>
                <Button onClick={handleNext}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 3: Registrant & Applicant Info */}
          {currentStep === 2 && (
            <div className="space-y-5 max-w-xl mx-auto text-left">
              {/* Requester vs Registrant Distinction Card */}
              <div className="p-4 bg-app-page border border-border rounded-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-crimson uppercase tracking-wider">
                    Identity Verification Context
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Requester ID Verified
                  </span>
                </div>
                <div className="text-xs text-text-primary">
                  <span className="text-text-muted font-medium">Requester (Account Owner): </span>
                  <span className="font-bold">{appProfile?.fullName || 'Parishioner'}</span>
                </div>
                {relationship === 'Self' ? (
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    You are requesting a sacramental document for <strong>yourself (Self)</strong>. The legal name entered below must correspond with your verified profile identity.
                  </p>
                ) : (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-button space-y-1">
                    <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Third-Party Request: {relationship}
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
                      You (the requester) are applying on behalf of the <strong>registrant</strong>. Enter the registrant's legal name as it appears in parish canonical records. In the next step, you must upload a signed <strong>Authorization Letter</strong> and the registrant's <strong>Government ID (front & back)</strong>.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Relationship to Registrant *
                </label>
                <p className="text-xs text-text-muted">Specify how you are related to the certificate owner.</p>
              </div>
              <CustomSelect
                value={relationship}
                onChange={handleRelationshipChange}
                options={[
                  'Self',
                  'Parent',
                  'Child',
                  'Spouse',
                  'Sibling',
                  'Other Relative',
                  'Authorized Representative',
                ]}
              />

              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  {relationship === 'Self' ? 'Registrant Legal Name (Self) *' : "Registrant's Legal Name *"}
                </label>
                <p className="text-xs text-text-muted">Name of the person whose baptism, confirmation, or marriage is recorded.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="First Name *"
                  placeholder="e.g. Juan"
                  value={applicantFirstName}
                  onChange={e => setApplicantFirstName(e.target.value)}
                  maxLength={50}
                  required
                />
                <Input
                  label="Middle Name (Optional)"
                  placeholder="e.g. Santos"
                  value={applicantMiddleName}
                  onChange={e => setApplicantMiddleName(e.target.value)}
                  maxLength={50}
                />
                <Input
                  label="Last Name *"
                  placeholder="e.g. Dela Cruz"
                  value={applicantLastName}
                  onChange={e => setApplicantLastName(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <Input
                  label="Approx. Registry Year (Optional)"
                  type="number"
                  placeholder="e.g. 1995"
                  value={registryYear}
                  onChange={e => setRegistryYear(e.target.value)}
                  className="h-[42px]"
                />
                <Input
                  label="Purpose of Request"
                  placeholder="e.g. Marriage requirement, School, Passport"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev}>Back</Button>
                <Button onClick={handleNext} disabled={!applicantFirstName.trim() || !applicantLastName.trim()}>
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Upload Requirements */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="p-4 bg-app-page border border-border/80 rounded-card space-y-2">
                <span className="text-[10px] font-bold text-crimson uppercase tracking-wider">Attachments Checklist</span>
                <h4 className="text-xs font-bold text-text-primary">
                  Provide credentials supporting this request.
                </h4>
                <p className="text-[11px] text-text-muted">
                  Upload file formats (PDF, JPG, PNG, or WebP) under 5MB for each field.
                </p>
              </div>

              {relationship === 'Self' ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-card flex items-start gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">
                      Requester Identity Satisfied (Self)
                    </h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed font-normal">
                      Your Government ID is already verified through your TESTIMONIUM profile. Because this request is for yourself (Self), no separate registrant ID images or signed Authorization Letter are required.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-card space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-bold text-amber-950">Representative Evidence Requirements ({relationship})</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
                    Your Government ID is already verified through your TESTIMONIUM profile. Because this document belongs to another person, provide a signed Authorization Letter and clear front and back images of the registrant's valid Government ID. The registrant is the person named on the requested sacramental record.
                  </p>
                  <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
                    If the registrant has no available ID or cannot provide the required evidence, this online request cannot be completed under the current rule. Contact the parish office for guidance.
                  </p>
                </div>
              )}

              {loadingReqs ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded" />
                  <Skeleton className="h-20 w-full rounded" />
                </div>
              ) : requirementsList.length === 0 ? (
                <div className="p-6 border border-dashed border-gray-200 rounded-button bg-gray-50 text-center space-y-2">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto" />
                  <span className="text-sm font-semibold text-gray-700 block">No Upload Requirements</span>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    This parish does not require any document attachments to process this certificate type. You can proceed.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requirementsList.map(req => {
                    const file = uploadedFilesByReq[req.id];
                    return (
                      <div key={req.id} className="p-4 border border-gray-150 rounded-button bg-gray-50/50 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-text-primary block">{req.label}</span>
                            {req.description && <p className="text-[10px] text-text-muted mt-0.5">{req.description}</p>}
                          </div>
                          {req.required && (
                            <span className="text-[9px] bg-red-55 text-crimson font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Required
                            </span>
                          )}
                        </div>

                        {reqErrors[req.id] && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                            {reqErrors[req.id]}
                          </div>
                        )}

                        {req.id === 'valid_id' && isGovIdVerified ? (
                          <div className="flex items-center gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-button">
                            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-emerald-950 block">{relationship === 'Self' ? 'Valid Government ID' : 'Your Government ID - verified (requester)'}</span>
                              <p className="text-[11px] text-emerald-700">Verified through your TESTIMONIUM profile</p>
                            </div>
                          </div>
                        ) : file ? (
                          <div className="flex items-center justify-between p-2.5 bg-white border border-border rounded-button text-xs">
                            <span className="truncate max-w-[280px] font-mono font-semibold text-gray-700">
                              {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFileForReq(req.id)}
                              className="text-crimson hover:underline font-bold text-xs cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const dropped = e.dataTransfer.files?.[0];
                              if (dropped) handleUploadForReq(req.id, dropped);
                            }}
                            className="relative border border-dashed border-gray-300 rounded-button p-4 text-center hover:border-crimson transition-colors bg-white cursor-pointer"
                          >
                            <input
                              type="file"
                              onChange={(e) => {
                                const selected = e.target.files?.[0];
                                if (selected) handleUploadForReq(req.id, selected);
                                e.target.value = '';
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              accept={UPLOAD_POLICIES.SUPPORTING_DOCUMENT.acceptAttribute}
                            />
                            <span className="text-xs text-text-muted block">
                              Drag and drop files here, or click to upload. PDF, JPG, PNG, or WebP — up to 5 MB.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Authorization Letter Upload for every non-Self relationship */}
              {isAuthLetterRequired && (
                <div className="p-4 border border-crimson/30 rounded-button bg-red-50/20 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-text-primary block">
                        Authorization Letter <span className="text-crimson">*</span>
                      </span>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Upload the signed authorization letter required for this non-Self request.
                      </p>
                    </div>
                    <span className="text-[9px] bg-red-55 text-crimson font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Required
                    </span>
                  </div>

                  {authLetterError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                      {authLetterError}
                    </div>
                  )}

                  {authLetterFile ? (
                    <div className="flex items-center justify-between p-2.5 bg-white border border-border rounded-button text-xs">
                      <span className="truncate max-w-[280px] font-mono font-semibold text-gray-700">
                        {authLetterFile.name} ({(authLetterFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthLetterFile(null);
                          setAuthLetterError(null);
                        }}
                        className="text-crimson hover:underline font-bold text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped) handleAuthLetterUpload(dropped);
                      }}
                      className="relative border border-dashed border-gray-300 rounded-button p-4 text-center hover:border-crimson transition-colors bg-white cursor-pointer"
                    >
                      <input
                        type="file"
                        onChange={(e) => {
                          const selected = e.target.files?.[0];
                          if (selected) handleAuthLetterUpload(selected);
                          e.target.value = '';
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept={UPLOAD_POLICIES.AUTHORIZATION_LETTER.acceptAttribute}
                      />
                      <span className="text-xs text-text-muted block">
                        Drag and drop files here, or click to upload. PDF, JPG, or PNG — up to 5 MB.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {relationship !== 'Self' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['front', 'back'] as const).map((side) => {
                    const selected = side === 'front' ? registrantIdFront : registrantIdBack;
                    return (
                      <div key={side} className="p-4 border border-crimson/30 rounded-button bg-red-50/20 space-y-3">
                        <div>
                          <span className="text-xs font-bold text-text-primary block">Registrant's Government ID - {side === 'front' ? 'Front' : 'Back'} *</span>
                          <p className="text-[11px] text-text-muted mt-0.5">Clear, readable JPEG or PNG image. Maximum 5 MB.</p>
                        </div>
                        {registrantIdErrors[side] ? <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">{registrantIdErrors[side]}</div> : null}
                        {selected ? (
                          <div className="space-y-2">
                            <LocalImagePreview file={selected} alt={`Selected registrant ID ${side}`} />
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[220px] font-mono font-semibold">{selected.name} - Selected</span>
                              <button type="button" onClick={() => side === 'front' ? setRegistrantIdFront(null) : setRegistrantIdBack(null)} className="text-crimson font-bold">Remove</button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative border border-dashed border-gray-300 rounded-button p-4 text-center bg-white">
                            <input
                              type="file"
                              capture="environment"
                              accept={UPLOAD_POLICIES.REGISTRANT_ID_IMAGE.acceptAttribute}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) handleRegistrantIdUpload(side, file);
                                event.target.value = '';
                              }}
                            />
                            <span className="text-xs text-text-muted">Choose or capture the {side} image. JPG or PNG - up to 5 MB.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {relationship === 'Self' && (authLetterFile || registrantIdFront || registrantIdBack) ? (
                <p className="text-[11px] text-amber-800">Previously selected non-Self evidence is kept only in this local wizard session and will not be uploaded for a Self request.</p>
              ) : null}

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev} disabled={submitting}>Back</Button>
                <Button onClick={handleSubmit} loading={submitting} disabled={!allReqsUploaded}>Submit Request</Button>
              </div>
            </div>
          )}

          {/* Step 5: Success / Confirmation */}
          {currentStep === 4 && createdRequest && (
            <div className="text-center max-w-md mx-auto space-y-6 py-6 animate-in fade-in zoom-in duration-fast">
              <div className="flex justify-center text-green-600">
                <CheckCircle size={64} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold text-text-primary">
                  Request Submitted Successfully!
                </h3>
                <p className="text-sm text-text-muted">
                  Your document request has been logged in the parish registry database.
                </p>
              </div>

              <div className="p-4 bg-app-page border border-border rounded-card flex flex-col items-center space-y-2">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Tracking Reference Number</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xl font-bold text-text-primary tracking-wider">
                    {createdRequest.trackingNumber}
                  </span>
                  <button 
                    onClick={handleCopyTracking}
                    className="p-1.5 hover:bg-border/60 rounded-button text-text-muted hover:text-crimson transition-colors focus-ring"
                    aria-label="Copy tracking number"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <span className="text-[10px] text-crimson font-medium">Use this reference to monitor processing.</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard/home')}>
                  Go to Dashboard
                </Button>
                <Button className="flex-1" onClick={() => navigate('/dashboard/track')}>
                  Track Status
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
};

export default SacramentalRequestPage;
