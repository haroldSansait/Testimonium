import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Copy, FileText, AlertCircle } from 'lucide-react';
import services from '../../providers/factory';
import { useParishes, usePausePolling } from '../../hooks/useService';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
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

export const SacramentalRequestPage: React.FC = () => {
  usePausePolling(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParishId = searchParams.get('parishId');

  const parishesQuery = useParishes();
  const parishes = parishesQuery.data || [];
  const { loading, error, refetch } = parishesQuery;

  const { isProfileIncomplete, openProfileModal } = useProfileRequirement();

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

  // Authorization Letter for Authorized Representatives
  const [authLetterFile, setAuthLetterFile] = useState<File | null>(null);
  const [authLetterError, setAuthLetterError] = useState<string | null>(null);

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
      services.request.getDocumentRequirements(docType, selectedParishId)
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
  }, [currentStep, docType, selectedParishId]);

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
    setRelationship(newRel);
    if (newRel !== 'Authorized Representative') {
      setAuthLetterFile(null);
      setAuthLetterError(null);
    }
  };

  const handleAuthLetterUpload = (file: File) => {
    setAuthLetterError(null);
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    const name = file.name.toLowerCase();
    const hasValidExt = allowedExts.some(ext => name.endsWith(ext));
    const validMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const hasValidMime = !file.type || validMimes.includes(file.type.toLowerCase());

    if (!hasValidExt || !hasValidMime) {
      setAuthLetterError("Unsupported file type. Please upload a PDF, JPEG, or PNG file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAuthLetterError("File is too large. Maximum size allowed is 5 MB.");
      return;
    }
    setAuthLetterFile(file);
  };

  const handleUploadForReq = (reqId: string, file: File) => {
    setUploadedFilesByReq(prev => ({
      ...prev,
      [reqId]: file
    }));
  };

  const handleRemoveFileForReq = (reqId: string) => {
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

      const draft = await services.request.createRequest({
        parishId: selectedParishId,
        documentType: docType as any,
        applicantFirstName: applicantFirstName.trim(),
        applicantMiddleName: applicantMiddleName.trim() || undefined,
        applicantLastName: applicantLastName.trim(),
        relationship,
        purpose: finalPurpose,
      });

      // 2. Upload requirements if any are present
      const reqFiles = Object.entries(uploadedFilesByReq);
      for (const [reqId, file] of reqFiles) {
        await services.request.uploadFiles(draft.id, [file], reqId);
      }

      // 2b. Upload authorization letter if Authorized Representative
      if (relationship === 'Authorized Representative') {
        if (!authLetterFile) {
          setSubmissionError("An authorization letter is required when requesting documents as an Authorized Representative.");
          setSubmitting(false);
          return;
        }
        await services.request.uploadFiles(draft.id, [authLetterFile], 'authorization_letter');
      }

      // 3. Finalize and submit the request
      const finalized = await services.request.submitDraft(draft.id);

      setCreatedRequest(finalized);
      setCurrentStep(4);
    } catch (err: any) {
      console.error("Request submission error:", err);
      if (err?.code === "PROFILE_INCOMPLETE") {
        openProfileModal('request certificates');
      } else if (err?.code === "AUTHORIZATION_LETTER_REQUIRED") {
        setSubmissionError("An authorization letter is required when requesting documents as an Authorized Representative.");
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

  const isAuthLetterRequired = relationship === 'Authorized Representative';
  const allReqsUploaded = requirementsList.every(req => !req.required || !!uploadedFilesByReq[req.id]) &&
    (!isAuthLetterRequired || !!authLetterFile);

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
                size="sm"
                onClick={() => navigate('/dashboard/home')}
              >
                Return to Dashboard
              </Button>
              <Button
                size="sm"
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

          {/* Step 3: Applicant Info */}
          {currentStep === 2 && (
            <div className="space-y-4 max-w-xl mx-auto">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full mb-4">
                  <CustomSelect
                    label="Relationship to Registrant"
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
                </div>
                <Input
                  label="Registry Year (Optional)"
                  type="number"
                  placeholder="Approx. year, e.g. 1995"
                  value={registryYear}
                  onChange={e => setRegistryYear(e.target.value)}
                  className="h-[42px]"
                />
              </div>
              <Input
                label="Purpose of Request"
                placeholder="e.g. Marriage canonical requirement, school, passport"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
              />
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
                  Upload file formats (PNG, JPG, PDF) under 5MB for each field.
                </p>
              </div>

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

                        {file ? (
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
                          <div className="relative border border-dashed border-gray-300 rounded-button p-4 text-center hover:border-crimson transition-colors bg-white">
                            <input
                              type="file"
                              onChange={(e) => {
                                const selected = e.target.files?.[0];
                                if (selected) handleUploadForReq(req.id, selected);
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              accept=".png,.jpg,.jpeg,.pdf"
                            />
                            <span className="text-xs text-text-muted">Click or drag a file to upload</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Authorization Letter Upload when Authorized Representative */}
              {isAuthLetterRequired && (
                <div className="p-4 border border-crimson/30 rounded-button bg-red-50/20 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-text-primary block">
                        Authorization Letter <span className="text-crimson">*</span>
                      </span>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Upload the signed authorization letter from the person you are representing.
                      </p>
                      <span className="text-[10px] text-text-muted mt-1 block">
                        Accepted formats: PDF, JPEG, PNG (Max 5 MB)
                      </span>
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
                    <div className="relative border border-dashed border-gray-300 rounded-button p-4 text-center hover:border-crimson transition-colors bg-white">
                      <input
                        type="file"
                        onChange={(e) => {
                          const selected = e.target.files?.[0];
                          if (selected) handleAuthLetterUpload(selected);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".png,.jpg,.jpeg,.pdf"
                      />
                      <span className="text-xs text-text-muted">Click or drag signed authorization letter to upload</span>
                    </div>
                  )}
                </div>
              )}

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
