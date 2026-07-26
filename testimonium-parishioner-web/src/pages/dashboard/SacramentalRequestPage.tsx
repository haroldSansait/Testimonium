import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Copy } from 'lucide-react';
import services from '../../providers/factory';
import { useParishes } from '../../hooks/useService';
import type { SacramentalRequest } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Stepper } from '../../components/ui/Stepper';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { FileDropzone } from '../../features/requests/components/FileDropzone';
import { UploadPreview } from '../../features/requests/components/UploadPreview';

export const SacramentalRequestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParishId = searchParams.get('parishId');

  const parishesQuery = useParishes();
  const parishes = parishesQuery.data || [];
  const { loading, error, refetch } = parishesQuery;

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const ALL_DOCUMENT_TYPES = [
    { type: 'BAPTISMAL_CERTIFICATE', title: 'Baptismal Certificate', reqs: 'Valid ID, GKK Endorsement Letter' },
    { type: 'CONFIRMATION_CERTIFICATE', title: 'Confirmation Certificate', reqs: 'Valid ID, GKK Endorsement Letter' },
    { type: 'MARRIAGE_CERTIFICATE', title: 'Marriage Certificate', reqs: 'Valid ID, GKK Endorsement Letter' },
    { type: 'FIRST_COMMUNION_CERTIFICATE', title: 'First Communion Certificate', reqs: 'Parent/Guardian ID, GKK Endorsement Letter' },
    { type: 'MARRIAGE_BANNS', title: 'Marriage Banns', reqs: 'Valid IDs, Baptismal & Confirmation Certs, Civil Marriage License, Pre-Cana, CENOMAR, Banns Clearance, GKK Endorsement' },
    { type: 'PERMIT_TO_MARRY', title: 'Permit to Marry', reqs: 'Valid ID, Baptismal & Confirmation Certs, Civil Marriage License, Pre-Cana, CENOMAR, Canonical Interview, Banns Clearance, GKK Endorsement' },
    { type: 'STATUS_OF_LIBERTY', title: 'Status of Liberty', reqs: 'Valid ID, Baptismal Cert, CENOMAR, Canonical Interview, GKK Endorsement' },
    { type: 'ENDORSEMENT', title: 'GKK Endorsement', reqs: 'GKK Chapel Officer Recommendation Form' },
  ];

  // Form State
  const [selectedParishId, setSelectedParishId] = useState('');
  const [docType, setDocType] = useState<string>('BAPTISMAL_CERTIFICATE');
  const [applicantName, setApplicantName] = useState('');
  const [relationship, setRelationship] = useState('Self');
  const [purpose, setPurpose] = useState('');
  const [registryYear, setRegistryYear] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; size: number; progress?: number; id: string }>>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);

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

  const handleFilesSelected = (files: File[]) => {
    const mapped = files.map(f => ({
      name: f.name,
      size: f.size,
      progress: 100,
      id: `${f.name}-${f.size}-${Date.now()}`
    }));
    setSelectedFiles(prev => [...prev, ...mapped]);
    setRawFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (id: string) => {
    const fileToRemove = selectedFiles.find(f => f.id === id);
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
    if (fileToRemove) {
      setRawFiles(prev => prev.filter(f => f.name !== fileToRemove.name));
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Create request draft
      const draft = await services.request.createRequest({
        parishId: selectedParishId,
        documentType: docType as any,
        applicantName,
        relationship,
        purpose,
      });

      // 2. Upload attached files
      if (rawFiles.length > 0) {
        await services.request.uploadFiles(draft.id, rawFiles, "supporting");
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
            {/* Stepper Skeleton */}
            <div className="flex justify-between items-center max-w-xl mx-auto">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  {i < 5 && <Skeleton className="h-1 w-12 sm:w-16 rounded" />}
                </div>
              ))}
            </div>

            {/* Form Fields Skeletons */}
            <div className="space-y-4 max-w-xl mx-auto pt-4">
              <Skeleton className="h-5 w-40 rounded animate-pulse" />
              <Skeleton className="h-4 w-60 rounded animate-pulse" />
              <Skeleton className="h-10 w-full rounded-button animate-pulse" />
              <div className="flex justify-end pt-4">
                <Skeleton className="h-10 w-28 rounded-button animate-pulse" />
              </div>
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

      <Card>
        <CardContent className="pt-6 space-y-8">
          <Stepper steps={steps} currentStep={currentStep} />

          {/* Step 1: Select Parish */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
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
                    {parish.name} — {parish.city}
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
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Document Certificate Type
                </label>
                <p className="text-xs text-text-muted">Select from the 8 official sacramental document types.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_DOCUMENT_TYPES.map(doc => (
                  <button
                    key={doc.type}
                    onClick={() => setDocType(doc.type)}
                    className={`p-3.5 border rounded-button text-left font-serif text-sm transition-all focus-ring ${
                      docType === doc.type 
                        ? 'border-crimson bg-red-50/20 text-crimson font-bold shadow-sm' 
                        : 'border-border text-text-primary hover:bg-app-page'
                    }`}
                  >
                    <div className="font-serif font-bold text-sm leading-snug">{doc.title}</div>
                    <div className="text-[10px] text-text-muted mt-1 font-sans font-normal truncate">{doc.reqs}</div>
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
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Relationship to Registrant"
                  placeholder="e.g. Self, Parent, Sibling"
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                  required
                />
                <Input
                  label="Registry Year (Approximate)"
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
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="p-4 bg-app-page border border-border/80 rounded-card space-y-2">
                <span className="text-[10px] font-bold text-crimson uppercase tracking-wider">Required Attachments for {ALL_DOCUMENT_TYPES.find(d => d.type === docType)?.title}</span>
                <p className="text-xs text-text-primary font-medium">
                  {ALL_DOCUMENT_TYPES.find(d => d.type === docType)?.reqs}
                </p>
                <p className="text-[11px] text-text-muted">
                  Please upload clear scans or legible photos of the specified files. Maximum 5MB per file (PNG, JPG, PDF).
                </p>
              </div>

              <FileDropzone
                onFilesSelected={handleFilesSelected}
                disabled={submitting}
              />

              <UploadPreview
                files={selectedFiles}
                onRemove={handleRemoveFile}
              />

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev} disabled={submitting}>Back</Button>
                <Button onClick={handleSubmit} loading={submitting}>Submit Request</Button>
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

              {/* Tracking ID Card */}
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
