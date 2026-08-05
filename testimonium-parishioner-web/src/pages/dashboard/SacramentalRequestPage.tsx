import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Copy, FileText } from 'lucide-react';
import services from '../../providers/factory';
import { useParishes, usePausePolling } from '../../hooks/useService';
import type { SacramentalRequest } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
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

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const ALL_DOCUMENT_TYPES = [
    { type: 'BAPTISMAL_CERTIFICATE', title: 'Baptismal Certificate', desc: 'Baptism registry entry' },
    { type: 'CONFIRMATION_CERTIFICATE', title: 'Confirmation Certificate', desc: 'Sacrament of Confirmation entry' },
    { type: 'MARRIAGE_CERTIFICATE', title: 'Marriage Certificate', desc: 'Holy Matrimony registry entry' },
    { type: 'FIRST_COMMUNION_CERTIFICATE', title: 'First Communion Certificate', desc: 'First Holy Communion entry' },
    { type: 'MARRIAGE_BANNS', title: 'Marriage Banns', desc: 'Public notification of prospective marriage' },
    { type: 'PERMIT_TO_MARRY', title: 'Permit to Marry', desc: 'Clearance to marry in another parish' },
    { type: 'STATUS_OF_LIBERTY', title: 'Status of Liberty', desc: 'Attestation of canonical freedom to marry' },
  ];

  // Form State
  const [selectedParishId, setSelectedParishId] = useState('');
  const [docType, setDocType] = useState<string>('BAPTISMAL_CERTIFICATE');
  const [applicantName, setApplicantName] = useState('');
  const [relationship, setRelationship] = useState('Self');
  const [purpose, setPurpose] = useState('');
  const [registryYear, setRegistryYear] = useState('');

  // Dynamic Requirements State
  const [requirementsList, setRequirementsList] = useState<Array<{ id: string; label: string; required: boolean; description?: string }>>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [uploadedFilesByReq, setUploadedFilesByReq] = useState<Record<string, File>>({});

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
  const availableDocList = selectedParish?.availableDocuments;
  const filteredDocTypes =
    availableDocList && Array.isArray(availableDocList) && availableDocList.length > 0
      ? ALL_DOCUMENT_TYPES.filter((doc) => availableDocList.includes(doc.type))
      : ALL_DOCUMENT_TYPES;

  // Auto-reset docType if selected parish doesn't offer current docType
  useEffect(() => {
    if (filteredDocTypes.length > 0 && !filteredDocTypes.some((d) => d.type === docType)) {
      setDocType(filteredDocTypes[0].type);
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
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
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
    setSubmitting(true);
    try {
      // 1. Create request draft
      // Append registry year to purpose to pass it along safely without schema adjustments
      const finalPurpose = registryYear 
        ? `${purpose} (Approximate Registry Year: ${registryYear})`
        : purpose;

      const draft = await services.request.createRequest({
        parishId: selectedParishId,
        documentType: docType as any,
        applicantName,
        relationship,
        purpose: finalPurpose,
      });

      // 2. Upload requirements if any are present
      const reqFiles = Object.entries(uploadedFilesByReq);
      for (const [reqId, file] of reqFiles) {
        await services.request.uploadFiles(draft.id, [file], reqId);
      }

      // 3. Finalize and submit the request
      const finalized = await services.request.submitDraft(draft.id);

      setCreatedRequest(finalized);
      setCurrentStep(4);
    } catch (err) {
      console.error(err);
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

  const allReqsUploaded = requirementsList.every(req => !req.required || !!uploadedFilesByReq[req.id]);

  return (
    <div className="space-y-6" aria-live="polite">
      <PageHeader 
        title="Sacramental Request Wizard" 
        description="Submit requirements and request official certificates from canonical registries."
        onRefresh={refetch}
        breadcrumbs={['Home', 'Request Document']}
      />

      <Card className="shadow-sm border border-border">
        <CardContent className="pt-6 space-y-8">
          <Stepper steps={steps} currentStep={currentStep} />

          {/* Step 1: Select Parish */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Target Parish Office
                </label>
                <p className="text-xs text-text-muted">Select the parish containing the original canonical record registry.</p>
              </div>
              <select
                value={selectedParishId}
                onChange={e => setSelectedParishId(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary transition-colors"
              >
                {parishes.map(parish => (
                  <option key={parish.id} value={parish.id}>
                    {parish.name}
                  </option>
                ))}
              </select>
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
              <Input
                label="Full Name of Registrant"
                placeholder="Name as written in registry"
                value={applicantName}
                onChange={e => setApplicantName(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full mb-4">
                  <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
                    Relationship to Registrant
                  </label>
                  <select
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary transition-colors outline-none"
                  >
                    <option value="Self">Self</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other Relative">Other Relative</option>
                    <option value="Authorized Representative">Authorized Representative</option>
                  </select>
                </div>
                <Input
                  label="Registry Year (Approximate, Optional)"
                  type="number"
                  placeholder="e.g. 1995"
                  value={registryYear}
                  onChange={e => setRegistryYear(e.target.value)}
                />
              </div>
              <Textarea
                label="Purpose of Request"
                placeholder="Describe why you need this certificate (e.g. Marriage canonical requirement, Passport application)"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                required
              />
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev}>Back</Button>
                <Button onClick={handleNext} disabled={!applicantName || !purpose}>Next Step</Button>
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
