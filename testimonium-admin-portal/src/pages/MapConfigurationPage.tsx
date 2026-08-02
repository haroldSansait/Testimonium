import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { Church, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { InteractiveMap } from '@/components/map-configuration/InteractiveMap';
import { DIOCESE_CENTER } from '@/components/map-configuration/ParishMarker';
import { ParishSettingsPanel } from '@/components/map-configuration/ParishSettingsPanel';
import { SaveToolbar } from '@/components/map-configuration/SaveToolbar';
import { UnsavedChangesBanner } from '@/components/map-configuration/UnsavedChangesBanner';
import { PreviewDialog } from '@/components/map-configuration/PreviewDialog';
import { ParishManagementService } from '@/services/ParishManagementService';
import type { Parish } from '@/types';
import { cn } from '@/utils/cn';

export function MapConfigurationPage() {
  const [, startTransition] = useTransition();

  // State Management
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Parish>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveSuccessIds, setSaveSuccessIds] = useState<string[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVicariate, setSelectedVicariate] = useState('all');

  // Preview Dialog state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // New states for Phase 3.5 layout refactor & locate trigger
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0);

  // Reusable Toast and Confirmation Modal states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ) => {
    setDialog({ title, message, confirmText, cancelText, onConfirm });
  };

  // Esc key fullscreen dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Load parishes on mount
  const loadParishes = async () => {
    setLoading(true);
    try {
      const data = await ParishManagementService.getMapConfig();
      setParishes(data);
    } catch (err) {
      console.error('Failed to load map configurations:', err);
      showToast('Failed to load map configurations from the database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParishes();
  }, []);

  // Compute pending changes count
  const dirtyCount = Object.keys(drafts).length;
  const hasUnsavedChanges = dirtyCount > 0;

  // Sync dirty changes flag to window for sidebar navigation intercept
  useEffect(() => {
    (window as any).hasUnsavedMapChanges = hasUnsavedChanges;
    return () => {
      (window as any).hasUnsavedMapChanges = false;
    };
  }, [hasUnsavedChanges]);

  // beforeunload page refresh / tab close blocker
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Handle draft state modifications (with instant live preview)
  const handleFieldChange = useCallback((field: keyof Parish, value: any) => {
    if (!selectedId) return;

    setDrafts((prev) => {
      const currentParish = parishes.find((p) => p.id === selectedId);
      if (!currentParish) return prev;

      const parishDraft = { ...prev[selectedId], [field]: value };

      // Check if this draft field is different from original
      const originalValue = currentParish[field];
      const isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);

      const newDrafts = { ...prev };
      if (isDifferent) {
        newDrafts[selectedId] = parishDraft;
      } else {
        // If it reverted to original value, clean up field
        delete parishDraft[field];
        if (Object.keys(parishDraft).length === 0) {
          delete newDrafts[selectedId];
        } else {
          newDrafts[selectedId] = parishDraft;
        }
      }

      return newDrafts;
    });
  }, [selectedId, parishes]);

  const handleUpdateDraftCoords = useCallback((id: string, lat: number, lng: number) => {
    setDrafts((prev) => {
      const currentParish = parishes.find((p) => p.id === id);
      if (!currentParish) return prev;

      const newLat = Number(lat.toFixed(6));
      const newLng = Number(lng.toFixed(6));

      const isDiffLat = currentParish.latitude !== newLat;
      const isDiffLng = currentParish.longitude !== newLng;

      const newDrafts = { ...prev };
      const currentDraft = prev[id] || {};

      if (isDiffLat || isDiffLng) {
        newDrafts[id] = {
          ...currentDraft,
          latitude: newLat,
          longitude: newLng
        };
      } else {
        // Reverted to original
        const { latitude: _latitude, longitude: _longitude, ...rest } = currentDraft;
        if (Object.keys(rest).length === 0) {
          delete newDrafts[id];
        } else {
          newDrafts[id] = rest;
        }
      }

      return newDrafts;
    });
  }, [parishes]);

  const handleSelectParish = useCallback((id: string) => {
    setSelectedId(id);
    setIsSettingsCollapsed(false);
  }, []);

  // Discard all local draft states using custom confirmation modal
  const handleDiscardDrafts = useCallback(() => {
    showConfirm(
      'Discard Changes?',
      'Are you sure you want to discard all unsaved coordinate and configuration edits? This cannot be undone.',
      () => setDrafts({}),
      'Discard',
      'Cancel'
    );
  }, []);

  // Perform transaction batch save + parallel directory settings save
  const handleSaveAll = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;

    setIsSaving(true);

    // 1. Coordinates and map display settings updates (only dirty ones)
    const mapUpdates = Object.entries(drafts)
      .filter(([_, draft]) => 
        draft.latitude !== undefined || 
        draft.longitude !== undefined || 
        draft.mapZoom !== undefined || 
        draft.pinColor !== undefined || 
        draft.showLabel !== undefined
      )
      .map(([id, draft]) => {
        const original = parishes.find((p) => p.id === id);
        const lat = (draft.latitude !== undefined && draft.latitude !== null)
          ? draft.latitude
          : (original?.latitude !== null && original?.latitude !== undefined ? original.latitude : DIOCESE_CENTER[0]);
        const lng = (draft.longitude !== undefined && draft.longitude !== null)
          ? draft.longitude
          : (original?.longitude !== null && original?.longitude !== undefined ? original.longitude : DIOCESE_CENTER[1]);
        return {
          id,
          latitude: lat,
          longitude: lng,
          mapZoom: draft.mapZoom !== undefined ? draft.mapZoom : original!.mapZoom,
          pinColor: draft.pinColor !== undefined ? draft.pinColor : original!.pinColor,
          showLabel: draft.showLabel !== undefined ? draft.showLabel : original!.showLabel,
          locationUpdatedAt: original!.locationUpdatedAt
        };
      });

    // 2. Directory settings updates (only dirty ones)
    const directoryUpdates = Object.entries(drafts)
      .filter(([_, draft]) => 
        draft.directoryDescription !== undefined || 
        draft.contactNumber !== undefined || 
        draft.email !== undefined
      )
      .map(([id, draft]) => {
        return ParishManagementService.updateDirectorySettings(id, {
          directoryDescription: draft.directoryDescription,
          contactNumber: draft.contactNumber,
          email: draft.email
        });
      });

    try {
      let updatedParishes: Parish[] = [];

      // Save map settings in a single transaction batch
      if (mapUpdates.length > 0) {
        const mapResults = await ParishManagementService.batchUpdateMap(mapUpdates);
        updatedParishes = [...updatedParishes, ...mapResults];
      }

      // Save directory settings in parallel
      if (directoryUpdates.length > 0) {
        const dirResults = await Promise.all(directoryUpdates);
        updatedParishes = [...updatedParishes, ...dirResults];
      }

      // Trigger visual save success pulse animation on saved parishes
      const savedIds = Object.keys(drafts);
      setSaveSuccessIds(savedIds);
      setDrafts({});

      // Clear save success after 3 seconds
      setTimeout(() => {
        setSaveSuccessIds([]);
      }, 3000);

      // Merge saved parish objects back into state to update only the affected ones
      setParishes((prev) => {
        const next = [...prev];
        updatedParishes.forEach((updated) => {
          const idx = next.findIndex((p) => p.id === updated.id);
          if (idx !== -1) {
            next[idx] = updated;
          }
        });
        return next;
      });

      showToast('Parish configurations saved successfully.', 'success');
    } catch (err: any) {
      console.error(err);
      if (err.statusCode === 409) {
        // Optimistic locking version conflict
        showConfirm(
          'Version Conflict Detected',
          'Another coordinator has updated the settings for one or more parishes you modified. Please reload to sync.',
          () => { loadParishes(); },
          'Reload Configs',
          'Cancel'
        );
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to save configurations.';
        showToast(`Save failed: ${msg}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, isSaving, drafts, parishes]);

  // Image Upload wrapper (no full reload, in-place update)
  const handleUploadParishImage = useCallback(async (type: 'cover' | 'logo', file: File) => {
    if (!selectedId) throw new Error('No parish selected');
    
    // Add upload success toast via ImageUploader, but here we save it in state
    const result = await ParishManagementService.uploadParishImage(selectedId, type, file);
    
    setParishes((prev) => {
      return prev.map((p) => {
        if (p.id === selectedId) {
          return {
            ...p,
            [type === 'cover' ? 'coverImage' : 'logoImage']: result.url
          };
        }
        return p;
      });
    });

    showToast(`${type === 'cover' ? 'Cover' : 'Logo'} image uploaded successfully.`, 'success');
    return result;
  }, [selectedId]);

  // Reset view: flies to first parish or Diocese Center
  const handleResetView = useCallback(() => {
    if (parishes.length > 0) {
      // Find first parish with coordinates
      const active = parishes.find((p) => p.latitude !== null && p.latitude !== undefined);
      if (active) {
        setSelectedId(active.id);
        setLocateTrigger((prev) => prev + 1); // trigger focus
      }
    }
  }, [parishes]);

  // Locate selected parish trigger
  const handleLocateClick = useCallback(() => {
    if (selectedId) {
      setLocateTrigger((prev) => prev + 1);
    }
  }, [selectedId]);

  // Filter parishes list
  const filteredParishes = React.useMemo(() => {
    return parishes.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVicariate = selectedVicariate === 'all' || p.vicariate === selectedVicariate;
      return matchesSearch && matchesVicariate;
    });
  }, [parishes, searchQuery, selectedVicariate]);

  // Sort parishes list: Needs Location first, then alphabetical
  const sortedParishes = React.useMemo(() => {
    return [...filteredParishes].sort((a, b) => {
      const aNeedsLoc = a.latitude === null || a.latitude === undefined;
      const bNeedsLoc = b.latitude === null || b.latitude === undefined;
      
      if (aNeedsLoc && !bNeedsLoc) return -1;
      if (!aNeedsLoc && bNeedsLoc) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredParishes]);

  // Handle selected parish DTO (merging draft settings for live preview)
  const selectedParish = parishes.find((p) => p.id === selectedId) || null;
  const selectedParishDraft = selectedId ? drafts[selectedId] || {} : {};

  // Combine original selected parish and current draft values for map live preview
  const previewParish = selectedParish ? {
    ...selectedParish,
    latitude: selectedParishDraft.latitude !== undefined ? selectedParishDraft.latitude : selectedParish.latitude,
    longitude: selectedParishDraft.longitude !== undefined ? selectedParishDraft.longitude : selectedParish.longitude,
    pinColor: selectedParishDraft.pinColor !== undefined ? selectedParishDraft.pinColor : selectedParish.pinColor,
    showLabel: selectedParishDraft.showLabel !== undefined ? selectedParishDraft.showLabel : selectedParish.showLabel,
    coverImage: selectedParishDraft.coverImage !== undefined ? selectedParishDraft.coverImage : selectedParish.coverImage,
    logoImage: selectedParishDraft.logoImage !== undefined ? selectedParishDraft.logoImage : selectedParish.logoImage,
    directoryDescription: selectedParishDraft.directoryDescription !== undefined ? selectedParishDraft.directoryDescription : selectedParish.directoryDescription,
  } : null;

  // Auto-select first parish with Needs Location if any on load
  useEffect(() => {
    if (parishes.length > 0 && !selectedId) {
      const needsLoc = parishes.find((p) => p.latitude === null || p.latitude === undefined);
      if (needsLoc) {
        setSelectedId(needsLoc.id);
      } else {
        setSelectedId(parishes[0].id);
      }
    }
  }, [parishes, selectedId]);

  return (
    <div className={cn(
      "flex flex-col w-full overflow-hidden bg-gray-50/50 transition-all duration-300",
      isFullScreen ? "fixed inset-0 z-[999] h-screen" : "h-[calc(100vh-64px)]"
    )}>
      {/* Search & Actions Toolbar */}
      <SaveToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedVicariate={selectedVicariate}
        onVicariateChange={setSelectedVicariate}
        onResetView={handleResetView}
        onPreviewClick={() => setIsPreviewOpen(true)}
        onSaveAllClick={handleSaveAll}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isFullScreen={isFullScreen}
        onFullScreenToggle={() => setIsFullScreen(!isFullScreen)}
        selectedId={selectedId}
        onLocateClick={handleLocateClick}
      />

      <div className="flex-1 w-full overflow-hidden relative">
        {/* Fullscreen Map Canvas in Background */}
        <div className="absolute inset-0 w-full h-full z-0">
          {loading ? (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 font-medium">
              <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                Loading Vicariate Map...
              </div>
            </div>
          ) : (
            <InteractiveMap
              parishes={parishes}
              selectedId={selectedId}
              drafts={drafts}
              saveSuccessIds={saveSuccessIds}
              onSelectParish={handleSelectParish}
              onUpdateDraftCoords={handleUpdateDraftCoords}
              locateTrigger={locateTrigger}
              isFullScreen={isFullScreen}
            />
          )}
        </div>

        {/* Floating Left Panel: Parish List */}
        <div 
          className={cn(
            "absolute left-4 top-4 bottom-4 w-[320px] transition-all duration-300 z-10 flex flex-col pointer-events-auto",
            isListCollapsed ? "-translate-x-[340px] opacity-0 pointer-events-none" : "translate-x-0"
          )}
        >
          <div className="w-full h-full bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-gray-150 bg-gray-50/75 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Parishes List</span>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full">
                {filteredParishes.length} found
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <div className="p-8 text-center text-xs text-gray-500 font-medium flex flex-col items-center gap-2">
                  <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  Loading list...
                </div>
              ) : sortedParishes.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-medium">
                  No parishes found
                </div>
              ) : (
                sortedParishes.map((p) => {
                  const isSelected = p.id === selectedId;
                  const isDirty = drafts[p.id] !== undefined;
                  const needsLocation = p.latitude === null || p.latitude === undefined;

                  return (
                    <button
                      key={p.id}
                      onClick={() => startTransition(() => {
                        setSelectedId(p.id);
                        setIsSettingsCollapsed(false);
                      })}
                      className={cn(
                        "w-full text-left p-3.5 flex items-start justify-between border-l-2 transition-all",
                        isSelected
                          ? "bg-teal-50/40 border-teal-600"
                          : "border-transparent hover:bg-gray-50/40"
                      )}
                    >
                      <div className="flex gap-2.5 min-w-0">
                        <div className={cn(
                          "mt-0.5 rounded-lg p-1.5 flex-shrink-0",
                          isSelected ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-500"
                        )}>
                          <Church className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className={cn(
                            "text-xs font-bold truncate",
                            isSelected ? "text-teal-900" : "text-gray-700"
                          )}>
                            {p.name}
                          </h4>
                          <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                            {p.vicariate || 'Vicariate of Canlaon'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
                        {needsLocation && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold">
                            No Loc
                          </span>
                        )}
                        {isDirty && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes"></span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Floating Toggle Button for Left List */}
        <button
          onClick={() => setIsListCollapsed(!isListCollapsed)}
          className="absolute bg-white/95 border border-gray-200/80 text-gray-500 hover:text-teal-600 p-2 rounded-xl shadow-md z-20 transition-all hover:scale-105 active:scale-95 pointer-events-auto"
          style={{ 
            left: isListCollapsed ? '16px' : '348px', 
            top: '20px',
            transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms' 
          }}
          title={isListCollapsed ? "Expand Parish List" : "Collapse Parish List"}
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", isListCollapsed && "rotate-180")} />
        </button>

        {/* Floating Right Panel: Settings sidebar */}
        {previewParish && (
          <div 
            className={cn(
              "absolute right-4 top-4 bottom-4 w-[380px] transition-all duration-300 z-10 flex flex-col pointer-events-auto",
              isSettingsCollapsed ? "translate-x-[400px] opacity-0 pointer-events-none" : "translate-x-0"
            )}
          >
            <ParishSettingsPanel
              key={previewParish.id}
              parish={previewParish}
              draft={selectedParishDraft}
              onFieldChange={handleFieldChange}
              uploadImageFn={handleUploadParishImage}
              onClose={() => setIsSettingsCollapsed(true)}
            />
          </div>
        )}

        {/* Floating Toggle Button for Settings Panel */}
        {previewParish && isSettingsCollapsed && (
          <button
            onClick={() => setIsSettingsCollapsed(false)}
            className="absolute right-4 bg-white/95 border border-gray-200/80 text-gray-500 hover:text-teal-600 p-2 rounded-xl shadow-md z-20 transition-all hover:scale-105 active:scale-95 pointer-events-auto"
            style={{ top: '20px' }}
            title="Expand Settings Panel"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>

      {/* Floating Unsaved Changes Bottom Banner */}
      <UnsavedChangesBanner
        changeCount={dirtyCount}
        isSaving={isSaving}
        onDiscard={handleDiscardDrafts}
        onSave={handleSaveAll}
      />

      {/* Preview Parish Card Dialog */}
      {previewParish && (
        <PreviewDialog
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          parish={previewParish}
          draft={selectedParishDraft}
        />
      )}

      {/* Reusable Premium Toast Component */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white animate-in slide-in-from-bottom duration-200 border',
            toast.type === 'success' && 'bg-teal-600 border-teal-500',
            toast.type === 'error' && 'bg-rose-600 border-rose-500',
            toast.type === 'warning' && 'bg-amber-600 border-amber-500'
          )}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Reusable Confirmation Dialog Portal */}
      {dialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
              {dialog.title}
            </h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              {dialog.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDialog(null)}
                className="px-4 py-2 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {dialog.cancelText}
              </button>
              <button
                onClick={() => {
                  dialog.onConfirm();
                  setDialog(null);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg active:scale-95 transition-all"
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MapConfigurationPage;
