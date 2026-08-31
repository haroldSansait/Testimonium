import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  scheduleAvailabilityApi,
  type DateRuleMode,
  type ParishWeekdayRule,
  type ScheduleAvailabilityConfiguration,
  type ScheduleDateRule,
  type ServiceWeekdayRule,
  type Weekday,
} from '@/api/scheduleAvailabilityApi';
import type { ApiError } from '@/types/api';
import {
  CANONICAL_SCHEDULING_SERVICES,
  WEEKDAYS,
  cloneScheduleConfiguration,
  formatFriendlyDate,
  isDateExceptionDraftActive,
  isWeeklyAvailabilityDirty,
  type CanonicalServiceOption,
  type DateExceptionDraft,
} from '@/utils/schedulingAvailabilityHelpers';
import { cn } from '@/utils/cn';

interface ServiceOverridePickerProps {
  services: CanonicalServiceOption[];
  existingOverrides: Record<string, 'AVAILABLE' | 'UNAVAILABLE'>;
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  disabled?: boolean;
}

function ServiceOverridePicker({
  services,
  existingOverrides,
  selectedServiceId,
  onSelectService,
  disabled = false,
}: ServiceOverridePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Sacrament' | 'Mass' | 'Other'>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter out already overridden services
  const availableServices = useMemo(() => {
    return services.filter((s) => !(s.id in existingOverrides));
  }, [services, existingOverrides]);

  // Selected service metadata
  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId);
  }, [services, selectedServiceId]);

  // Filter by category and search
  const filteredServices = useMemo(() => {
    return availableServices.filter((s) => {
      const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
      const matchesSearch = s.label.toLowerCase().includes(search.toLowerCase().trim());
      return matchesCategory && matchesSearch;
    });
  }, [availableServices, categoryFilter, search]);

  // Group filtered services
  const groupedServices = useMemo(() => {
    const groups: Array<{
      category: 'Sacrament' | 'Mass' | 'Other';
      title: string;
      badgeClass: string;
      items: CanonicalServiceOption[];
    }> = [
      {
        category: 'Sacrament',
        title: 'Sacraments',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        items: filteredServices.filter((s) => s.category === 'Sacrament'),
      },
      {
        category: 'Mass',
        title: 'Masses & Liturgies',
        badgeClass: 'bg-red-50 text-crimson-800 border-red-200',
        items: filteredServices.filter((s) => s.category === 'Mass'),
      },
      {
        category: 'Other',
        title: 'Devotions & Other',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        items: filteredServices.filter((s) => s.category === 'Other'),
      },
    ];
    return groups.filter((g) => g.items.length > 0);
  }, [filteredServices]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
      setCategoryFilter('ALL');
    }
  }, [isOpen]);

  // Counts for category filter tabs
  const categoryCounts = useMemo(() => {
    return {
      ALL: availableServices.length,
      Sacrament: availableServices.filter((s) => s.category === 'Sacrament').length,
      Mass: availableServices.filter((s) => s.category === 'Mass').length,
      Other: availableServices.filter((s) => s.category === 'Other').length,
    };
  }, [availableServices]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[200px]">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || availableServices.length === 0}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-xs font-medium bg-white transition-all text-left cursor-pointer select-none',
          isOpen
            ? 'border-crimson-700 ring-2 ring-crimson-700/20 shadow-xs'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedService ? (
            <>
              <span className="font-bold text-gray-900 truncate">{selectedService.label}</span>
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                  selectedService.category === 'Sacrament'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : selectedService.category === 'Mass'
                    ? 'bg-red-50 text-crimson-800 border-red-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                )}
              >
                {selectedService.category}
              </span>
            </>
          ) : (
            <span className="text-gray-500 font-medium truncate">
              {availableServices.length === 0
                ? 'All services customized'
                : '+ Choose a service to customize...'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {selectedService && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelectService('');
              }}
              className="p-0.5 hover:text-gray-600 rounded hover:bg-gray-100"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform duration-150', isOpen && 'rotate-180 text-crimson-700')}
          />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full sm:w-[380px] max-w-[95vw] bg-white border border-gray-200 rounded-xl shadow-xl z-40 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Mini Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service name..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700 text-gray-800 font-medium placeholder:text-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'ALL', label: 'All', count: categoryCounts.ALL },
                { id: 'Sacrament', label: 'Sacraments', count: categoryCounts.Sacrament },
                { id: 'Mass', label: 'Masses', count: categoryCounts.Mass },
                { id: 'Other', label: 'Other', count: categoryCounts.Other },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer',
                  categoryFilter === tab.id
                    ? 'bg-crimson-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'text-[10px] px-1 rounded-full',
                    categoryFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Service Items Grouped */}
          <div className="max-h-56 overflow-y-auto space-y-2.5 pr-0.5">
            {groupedServices.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 font-medium">
                No services match your search or filter.
              </div>
            ) : (
              groupedServices.map((group) => (
                <div key={group.category} className="space-y-1">
                  <div className="flex items-center justify-between px-1.5 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {group.title}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">{group.items.length}</span>
                  </div>

                  <div className="space-y-0.5">
                    {group.items.map((service) => {
                      const isSelected = selectedServiceId === service.id;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            onSelectService(service.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer',
                            isSelected
                              ? 'bg-crimson-50 text-crimson-900 font-bold border border-crimson-200'
                              : 'text-gray-800 hover:bg-gray-100 font-medium'
                          )}
                        >
                          <span className="truncate">{service.label}</span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                              group.badgeClass
                            )}
                          >
                            {service.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface SchedulingAvailabilityEditorHandle {
  save: (
    eventSettings: Record<string, unknown>,
    officeHours: Record<string, unknown>
  ) => Promise<ScheduleAvailabilityConfiguration>;
  reset: () => void;
  hasUnsavedDateException: () => boolean;
  focusDateExceptionForm?: () => void;
}

interface Props {
  parishId: string;
  services?: CanonicalServiceOption[];
  readOnly?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onMessage?: (message: string, type: 'success' | 'error') => void;
}

export const SchedulingAvailabilityEditor = forwardRef<SchedulingAvailabilityEditorHandle, Props>(
  function SchedulingAvailabilityEditor(
    {
      parishId,
      services = CANONICAL_SCHEDULING_SERVICES,
      readOnly = false,
      onDirtyChange,
      onMessage,
    },
    ref
  ) {
    // ------------------------------------------------------------------
    // 1. Authoritative Server Baseline & Local Draft State
    // ------------------------------------------------------------------
    const [serverBaseline, setServerBaseline] = useState<ScheduleAvailabilityConfiguration | null>(null);
    const [draftParishRules, setDraftParishRules] = useState<ParishWeekdayRule[]>([]);
    const [draftServiceRules, setDraftServiceRules] = useState<ServiceWeekdayRule[]>([]);
    const [draftDateException, setDraftDateException] = useState<DateExceptionDraft | null>(null);

    // Async & UI state
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSavingDateRule, setIsSavingDateRule] = useState(false);
    const [deleteConfirmRule, setDeleteConfirmRule] = useState<ScheduleDateRule | null>(null);
    const [isDeletingDateRule, setIsDeletingDateRule] = useState(false);

    // Filter and display controls
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOverridesOnly, setFilterOverridesOnly] = useState(false);
    const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());

    // Inline service override selector in Date Exception form
    const [newOverrideServiceId, setNewOverrideServiceId] = useState('');
    const [newOverrideMode, setNewOverrideMode] = useState<'AVAILABLE' | 'UNAVAILABLE'>('UNAVAILABLE');

    // Element refs for navigation/focus
    const dateExceptionFormRef = useRef<HTMLDivElement | null>(null);

    // ------------------------------------------------------------------
    // 2. Stable Callback Refs (Eliminates Re-fetch Cycles)
    // ------------------------------------------------------------------
    const onDirtyChangeRef = useRef(onDirtyChange);
    useEffect(() => {
      onDirtyChangeRef.current = onDirtyChange;
    }, [onDirtyChange]);

    const onMessageRef = useRef(onMessage);
    useEffect(() => {
      onMessageRef.current = onMessage;
    }, [onMessage]);

    // Request generation counter for race-condition protection
    const requestGenRef = useRef(0);

    // ------------------------------------------------------------------
    // 3. Authoritative Fetch Logic (Triggered Only by Genuine Parish Change)
    // ------------------------------------------------------------------
    const fetchAuthoritativeConfig = useCallback(async (targetParishId: string) => {
      if (!targetParishId) {
        setServerBaseline(null);
        setDraftParishRules([]);
        setDraftServiceRules([]);
        setDraftDateException(null);
        setLoadError(null);
        return;
      }

      requestGenRef.current += 1;
      const currentGen = requestGenRef.current;

      setLoading(true);
      setLoadError(null);

      try {
        const data = await scheduleAvailabilityApi.get(targetParishId);
        if (currentGen !== requestGenRef.current) return; // Stale response discarded

        // Ensure all 7 weekdays exist in the baseline
        const completeWeekdayRules: ParishWeekdayRule[] = WEEKDAYS.map((day) => {
          const found = data.weekdayRules?.find((r) => r.weekday === day.value);
          return found ? { ...found } : { weekday: day.value, isAvailable: true };
        });

        const normalizedConfig: ScheduleAvailabilityConfiguration = {
          ...data,
          weekdayRules: completeWeekdayRules,
          serviceWeekdayRules: data.serviceWeekdayRules || [],
          scheduleDateRules: (data.scheduleDateRules || []).sort((a, b) =>
            a.exceptionDate.localeCompare(b.exceptionDate)
          ),
        };

        setServerBaseline(normalizedConfig);
        setDraftParishRules(normalizedConfig.weekdayRules.map((r) => ({ ...r })));
        setDraftServiceRules(normalizedConfig.serviceWeekdayRules.map((r) => ({ ...r })));
        setDraftDateException(null);
      } catch (error) {
        if (currentGen !== requestGenRef.current) return;
        const msg = (error as ApiError)?.message || 'Unable to load sacramental scheduling availability.';
        setLoadError(msg);
        onMessageRef.current?.(msg, 'error');
      } finally {
        if (currentGen === requestGenRef.current) {
          setLoading(false);
        }
      }
    }, []);

    // Initial load & Parish Switch Effect
    useEffect(() => {
      void fetchAuthoritativeConfig(parishId);
    }, [fetchAuthoritativeConfig, parishId]);

    // ------------------------------------------------------------------
    // 4. Dirty State Computation & Synchronization
    // ------------------------------------------------------------------
    const isWeeklyDirty = useMemo(() => {
      return isWeeklyAvailabilityDirty(draftParishRules, draftServiceRules, serverBaseline);
    }, [draftParishRules, draftServiceRules, serverBaseline]);

    const isDateDraftActive = useMemo(() => {
      return isDateExceptionDraftActive(draftDateException, serverBaseline?.scheduleDateRules);
    }, [draftDateException, serverBaseline?.scheduleDateRules]);

    const isDirty = isWeeklyDirty || isDateDraftActive;

    useEffect(() => {
      onDirtyChangeRef.current?.(isDirty);
    }, [isDirty]);

    // ------------------------------------------------------------------
    // 5. 409 Conflict & Version Stale Recovery
    // ------------------------------------------------------------------
    const handleConflict = useCallback(
      async (error: unknown): Promise<boolean> => {
        const apiErr = error as ApiError;
        if (apiErr?.status === 409 && apiErr?.code === 'SCHEDULING_CONFIG_STALE') {
          await fetchAuthoritativeConfig(parishId);
          onMessageRef.current?.(
            'Scheduling settings changed in another session. The latest configuration was reloaded; please review it before making further edits.',
            'error'
          );
          return true;
        }
        return false;
      },
      [fetchAuthoritativeConfig, parishId]
    );

    // ------------------------------------------------------------------
    // 6. Imperative Handle Implementation
    // ------------------------------------------------------------------
    useImperativeHandle(
      ref,
      () => ({
        async save(eventSettings, officeHours) {
          if (!serverBaseline || draftParishRules.length !== WEEKDAYS.length) {
            throw new Error('Authoritative scheduling configuration has not finished loading.');
          }

          try {
            const next = await scheduleAvailabilityApi.replaceWeekdayRules(parishId, {
              expectedVersion: serverBaseline.schedulingConfigVersion,
              parishRules: draftParishRules,
              serviceRules: draftServiceRules,
              eventSettings,
              officeHours,
            });

            // Establish new authoritative baseline from server response
            const completeRules: ParishWeekdayRule[] = WEEKDAYS.map((day) => {
              const found = next.weekdayRules?.find((r) => r.weekday === day.value);
              return found ? { ...found } : { weekday: day.value, isAvailable: true };
            });

            const updatedConfig: ScheduleAvailabilityConfiguration = {
              ...next,
              weekdayRules: completeRules,
              serviceWeekdayRules: next.serviceWeekdayRules || [],
              scheduleDateRules: (next.scheduleDateRules || []).sort((a, b) =>
                a.exceptionDate.localeCompare(b.exceptionDate)
              ),
            };

            setServerBaseline(updatedConfig);
            setDraftParishRules(updatedConfig.weekdayRules.map((r) => ({ ...r })));
            setDraftServiceRules(updatedConfig.serviceWeekdayRules.map((r) => ({ ...r })));
            return updatedConfig;
          } catch (error) {
            await handleConflict(error);
            throw error;
          }
        },

        reset() {
          if (!serverBaseline) return;
          const restored = cloneScheduleConfiguration(serverBaseline);
          setDraftParishRules(restored.weekdayRules);
          setDraftServiceRules(restored.serviceWeekdayRules);
          setDraftDateException(null);
          setNewOverrideServiceId('');
          setNewOverrideMode('UNAVAILABLE');
        },

        hasUnsavedDateException() {
          return isDateExceptionDraftActive(draftDateException, serverBaseline?.scheduleDateRules);
        },

        focusDateExceptionForm() {
          if (dateExceptionFormRef.current) {
            dateExceptionFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const input = dateExceptionFormRef.current.querySelector('input, select') as HTMLElement | null;
            input?.focus();
          }
        },
      }),
      [draftParishRules, draftServiceRules, draftDateException, handleConflict, parishId, serverBaseline]
    );

    // ------------------------------------------------------------------
    // 7. Weekly Booking Availability Handlers (Draft Mutations Only)
    // ------------------------------------------------------------------
    const handleToggleParishWeekday = (weekday: Weekday) => {
      if (readOnly) return;
      setDraftParishRules((current) =>
        current.map((r) => (r.weekday === weekday ? { ...r, isAvailable: !r.isAvailable } : r))
      );
    };

    const handleSetServiceOverrideMode = (
      eventType: string,
      weekday: Weekday,
      mode: 'INHERIT' | 'AVAILABLE' | 'UNAVAILABLE'
    ) => {
      if (readOnly) return;
      setDraftServiceRules((current) => {
        const withoutTarget = current.filter(
          (r) => !(r.eventType === eventType && r.weekday === weekday)
        );
        if (mode === 'INHERIT') {
          return withoutTarget;
        }
        return [...withoutTarget, { eventType, weekday, isAvailable: mode === 'AVAILABLE' }];
      });
    };

    const handleResetServiceOverrides = (eventType: string) => {
      if (readOnly) return;
      setDraftServiceRules((current) => current.filter((r) => r.eventType !== eventType));
    };

    const handleToggleServiceExpand = (serviceId: string) => {
      setExpandedServiceIds((prev) => {
        const next = new Set(prev);
        if (next.has(serviceId)) next.delete(serviceId);
        else next.add(serviceId);
        return next;
      });
    };

    // ------------------------------------------------------------------
    // 8. Date Exceptions Subform Handlers
    // ------------------------------------------------------------------
    const handleStartNewDateException = () => {
      if (readOnly) return;
      setDraftDateException({
        editingRuleId: null,
        date: '',
        baseMode: 'UNAVAILABLE',
        reason: '',
        serviceOverrides: {},
      });
      setNewOverrideServiceId('');
      setNewOverrideMode('UNAVAILABLE');
      setTimeout(() => {
        dateExceptionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    };

    const handleBeginEditDateRule = (rule: ScheduleDateRule) => {
      if (readOnly) return;
      const initialOverrides: Record<string, 'AVAILABLE' | 'UNAVAILABLE'> = {};
      for (const ov of rule.serviceOverrides || []) {
        initialOverrides[ov.eventType] = ov.mode;
      }
      setDraftDateException({
        editingRuleId: rule.id,
        date: rule.exceptionDate.slice(0, 10),
        baseMode: rule.baseMode,
        reason: rule.reason || '',
        serviceOverrides: initialOverrides,
      });
      setNewOverrideServiceId('');
      setNewOverrideMode('UNAVAILABLE');
      setTimeout(() => {
        dateExceptionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    };

    const handleCancelDateException = () => {
      setDraftDateException(null);
      setNewOverrideServiceId('');
      setNewOverrideMode('UNAVAILABLE');
    };

    const handleAddServiceOverrideToDraft = () => {
      if (!newOverrideServiceId || !draftDateException) return;
      setDraftDateException((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          serviceOverrides: {
            ...prev.serviceOverrides,
            [newOverrideServiceId]: newOverrideMode,
          },
        };
      });
      setNewOverrideServiceId('');
      setNewOverrideMode('UNAVAILABLE');
    };

    const handleRemoveServiceOverrideFromDraft = (eventType: string) => {
      setDraftDateException((prev) => {
        if (!prev) return null;
        const nextOverrides = { ...prev.serviceOverrides };
        delete nextOverrides[eventType];
        return {
          ...prev,
          serviceOverrides: nextOverrides,
        };
      });
    };

    const handleSaveDateException = async () => {
      if (!serverBaseline || !draftDateException) return;
      if (!draftDateException.date) {
        onMessageRef.current?.('Please select a valid calendar date for the exception.', 'error');
        return;
      }

      setIsSavingDateRule(true);
      try {
        const payload = {
          exceptionDate: draftDateException.date,
          baseMode: draftDateException.baseMode,
          reason: draftDateException.reason.trim() || null,
          serviceOverrides: Object.entries(draftDateException.serviceOverrides).map(
            ([eventType, mode]) => ({ eventType, mode })
          ),
          expectedVersion: serverBaseline.schedulingConfigVersion,
        };

        const result =
          draftDateException.editingRuleId === null
            ? await scheduleAvailabilityApi.createDateRule(parishId, payload)
            : await scheduleAvailabilityApi.updateDateRule(
                parishId,
                draftDateException.editingRuleId,
                payload
              );

        // Update local authoritative date rules and config version
        setServerBaseline((current) => {
          if (!current) return null;
          const filtered = current.scheduleDateRules.filter((r) => r.id !== result.rule.id);
          return {
            ...current,
            schedulingConfigVersion: result.schedulingConfigVersion,
            scheduleDateRules: [...filtered, result.rule].sort((a, b) =>
              a.exceptionDate.localeCompare(b.exceptionDate)
            ),
          };
        });

        const isUpdate = draftDateException.editingRuleId !== null;
        setDraftDateException(null);
        setNewOverrideServiceId('');
        setNewOverrideMode('UNAVAILABLE');
        onMessageRef.current?.(
          isUpdate ? 'Date availability rule updated successfully.' : 'Date availability rule added successfully.',
          'success'
        );
      } catch (error) {
        const conflictHandled = await handleConflict(error);
        if (!conflictHandled) {
          onMessageRef.current?.(
            (error as ApiError)?.message || 'Failed to save the date availability exception.',
            'error'
          );
        }
      } finally {
        setIsSavingDateRule(false);
      }
    };

    const handleConfirmDeleteDateRule = async () => {
      if (!serverBaseline || !deleteConfirmRule) return;
      setIsDeletingDateRule(true);
      try {
        const ruleId = deleteConfirmRule.id;
        const result = await scheduleAvailabilityApi.deleteDateRule(
          parishId,
          ruleId,
          serverBaseline.schedulingConfigVersion
        );

        setServerBaseline((current) => {
          if (!current) return null;
          return {
            ...current,
            schedulingConfigVersion: result.schedulingConfigVersion,
            scheduleDateRules: current.scheduleDateRules.filter((r) => r.id !== ruleId),
          };
        });

        if (draftDateException?.editingRuleId === ruleId) {
          setDraftDateException(null);
        }

        setDeleteConfirmRule(null);
        onMessageRef.current?.('Date availability rule removed.', 'success');
      } catch (error) {
        const conflictHandled = await handleConflict(error);
        if (!conflictHandled) {
          onMessageRef.current?.(
            (error as ApiError)?.message || 'Failed to remove the date availability rule.',
            'error'
          );
        }
      } finally {
        setIsDeletingDateRule(false);
      }
    };

    // ------------------------------------------------------------------
    // 9. Computed Helpers & Filtered Lists
    // ------------------------------------------------------------------
    const parishAvailabilitySummary = useMemo(() => {
      const openDays = WEEKDAYS.filter((d) => {
        const rule = draftParishRules.find((r) => r.weekday === d.value);
        return rule ? rule.isAvailable : false;
      });
      if (openDays.length === 7) return 'All 7 days available (Mon – Sun)';
      if (openDays.length === 0) return 'Parish closed all week (0 of 7 days)';
      return `${openDays.length} of 7 days available (${openDays.map((d) => d.shortLabel).join(', ')})`;
    }, [draftParishRules]);

    const serviceOverridesMap = useMemo(() => {
      const map: Record<string, Record<Weekday, boolean | undefined>> = {};
      for (const svc of services) {
        map[svc.id] = {} as Record<Weekday, boolean | undefined>;
      }
      for (const rule of draftServiceRules) {
        if (!map[rule.eventType]) {
          map[rule.eventType] = {} as Record<Weekday, boolean | undefined>;
        }
        map[rule.eventType][rule.weekday] = rule.isAvailable;
      }
      return map;
    }, [draftServiceRules, services]);

    const totalActiveOverridesCount = draftServiceRules.length;

    const filteredServices = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      return services.filter((svc) => {
        const matchesQuery =
          !query ||
          svc.label.toLowerCase().includes(query) ||
          svc.category.toLowerCase().includes(query);

        if (!matchesQuery) return false;

        if (filterOverridesOnly) {
          const overrides = draftServiceRules.filter((r) => r.eventType === svc.id);
          return overrides.length > 0;
        }

        return true;
      });
    }, [draftServiceRules, filterOverridesOnly, searchQuery, services]);

    // ------------------------------------------------------------------
    // 10. Render Loading & Error States
    // ------------------------------------------------------------------
    if (loading && !serverBaseline) {
      return (
        <div className="space-y-4 border-t border-gray-200 pt-6 animate-pulse">
          <div className="h-6 w-56 bg-gray-200 rounded-md" />
          <div className="h-32 bg-gray-100 rounded-xl border border-gray-200" />
          <div className="h-48 bg-gray-100 rounded-xl border border-gray-200" />
        </div>
      );
    }

    if (loadError && !serverBaseline) {
      return (
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h5 className="text-sm font-bold text-red-900">Failed to load scheduling configuration</h5>
              <p className="text-xs text-red-700 mt-0.5">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchAuthoritativeConfig(parishId)}
                className="mt-3 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!serverBaseline) return null;

    return (
      <div className="space-y-8 border-t border-gray-200 pt-6">
        {/* Read-Only Notice */}
        {readOnly && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-900">
              You are viewing sacramental scheduling in read-only mode. Only a Parish Secretary or Diocese
              Coordinator can modify these rules.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SECTION 1: GENERAL PARISH AVAILABILITY                       */}
        {/* ------------------------------------------------------------ */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-crimson-700" />
                <h4 className="text-base font-bold text-gray-900">General Parish Availability</h4>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Services set to <span className="font-semibold text-gray-700">Inherit</span> follow this parish-wide
                availability. Configure which days the parish accepts appointments.
              </p>
            </div>
            <span className="text-xs font-semibold text-crimson-800 bg-red-50 border border-crimson-700/20 px-2.5 py-1 rounded-full self-start sm:self-auto">
              {parishAvailabilitySummary}
            </span>
          </div>

          {/* 7-Day Pill Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {WEEKDAYS.map((day) => {
              const rule = draftParishRules.find((r) => r.weekday === day.value);
              const isAvailable = Boolean(rule?.isAvailable);

              return (
                <button
                  key={day.value}
                  type="button"
                  role="checkbox"
                  aria-checked={isAvailable}
                  aria-label={`General parish availability for ${day.label}: ${isAvailable ? 'Available' : 'Closed'}`}
                  disabled={readOnly}
                  onClick={() => handleToggleParishWeekday(day.value)}
                  className={cn(
                    'p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center select-none cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-crimson-700/30 focus:border-crimson-700',
                    isAvailable
                      ? 'bg-white border-crimson-700/40 text-gray-900 shadow-xs hover:border-crimson-700'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600',
                    readOnly && 'cursor-default opacity-80'
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">{day.shortLabel}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight',
                      isAvailable
                        ? 'bg-crimson-700 text-white'
                        : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {isAvailable ? (
                      <>
                        <Check className="w-3 h-3" /> Open
                      </>
                    ) : (
                      <>
                        <Ban className="w-3 h-3" /> Closed
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* SECTION 2: SERVICE-SPECIFIC OVERRIDES                        */}
        {/* ------------------------------------------------------------ */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-crimson-700" />
                <h4 className="text-base font-bold text-gray-900">Service-Specific Overrides</h4>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Override general parish availability for individual sacraments or services that follow customized schedules.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={cn(
                  'px-2.5 py-1 rounded-full border',
                  totalActiveOverridesCount > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                )}
              >
                {totalActiveOverridesCount === 0
                  ? 'All services inheriting parish defaults'
                  : `${totalActiveOverridesCount} active override${totalActiveOverridesCount === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/70 p-2.5 rounded-xl border border-gray-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search service (e.g. Marriage, Funeral, Baptism)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 px-2 select-none cursor-pointer text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={filterOverridesOnly}
                onChange={(e) => setFilterOverridesOnly(e.target.checked)}
                className="w-4 h-4 accent-crimson-700 text-crimson-700 rounded border-gray-300 focus:ring-crimson-700 cursor-pointer"
              />
              Show customized services only
            </label>
          </div>

          {/* Service Cards List */}
          {filteredServices.length === 0 ? (
            <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center">
              <p className="text-xs text-gray-500">
                {filterOverridesOnly
                  ? 'No services currently have custom overrides configured.'
                  : `No services matching "${searchQuery}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredServices.map((service) => {
                const isExpanded = expandedServiceIds.has(service.id);
                const svcOverrides = draftServiceRules.filter((r) => r.eventType === service.id);
                const hasOverrides = svcOverrides.length > 0;

                return (
                  <div
                    key={service.id}
                    className={cn(
                      'border rounded-xl transition-all overflow-hidden bg-white',
                      isExpanded
                        ? 'border-crimson-700/40 shadow-sm ring-1 ring-crimson-700/10'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {/* Service Row Header */}
                    <div
                      onClick={() => handleToggleServiceExpand(service.id)}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{service.label}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                              {service.category}
                            </span>
                          </div>

                          {/* Override summary badges */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {!hasOverrides ? (
                              <span className="text-xs text-gray-400 font-medium italic">
                                Inheriting Parish Default (All 7 days)
                              </span>
                            ) : (
                              svcOverrides.map((ov) => {
                                const dayObj = WEEKDAYS.find((d) => d.value === ov.weekday);
                                return (
                                  <span
                                    key={ov.weekday}
                                    className={cn(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border',
                                      ov.isAvailable
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-rose-50 text-rose-800 border-rose-200'
                                    )}
                                  >
                                    <span>{dayObj?.shortLabel || ov.weekday}:</span>
                                    <span>{ov.isAvailable ? 'Allow' : 'Block'}</span>
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                            isExpanded
                              ? 'bg-crimson-700 text-white border-crimson-700'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          )}
                          aria-label={`Toggle schedule editing for ${service.label}`}
                        >
                          {isExpanded ? (
                            <>
                              <span>Close</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>{hasOverrides ? 'Edit Overrides' : 'Customize'}</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Weekday Override Editor */}
                    {isExpanded && (
                      <div className="p-4 bg-gray-50/70 border-t border-gray-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="text-xs text-gray-600">
                            Configure day-by-day overrides for <span className="font-bold text-gray-900">{service.label}</span>.
                          </p>
                          {hasOverrides && !readOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetServiceOverrides(service.id);
                              }}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-crimson-700 transition-colors self-start sm:self-auto cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reset all to Inherit
                            </button>
                          )}
                        </div>

                        {/* Responsive 7-day compact segmented controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                          {WEEKDAYS.map((day) => {
                            const parishRule = draftParishRules.find((r) => r.weekday === day.value);
                            const parishAvailable = Boolean(parishRule?.isAvailable);
                            const overrideVal = serviceOverridesMap[service.id]?.[day.value];

                            const currentMode: 'INHERIT' | 'AVAILABLE' | 'UNAVAILABLE' =
                              overrideVal === undefined ? 'INHERIT' : overrideVal ? 'AVAILABLE' : 'UNAVAILABLE';

                            return (
                              <div
                                key={day.value}
                                className="p-2.5 bg-white border border-gray-200 rounded-xl space-y-2 flex flex-col justify-between shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-900">{day.label}</span>
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    Default: {parishAvailable ? 'Open' : 'Closed'}
                                  </span>
                                </div>

                                {/* Compact 3-State Segmented Control */}
                                <div
                                  className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg"
                                  role="radiogroup"
                                  aria-label={`${service.label} ${day.label} schedule mode`}
                                >
                                  {/* INHERIT Button */}
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={currentMode === 'INHERIT'}
                                    disabled={readOnly}
                                    onClick={() => handleSetServiceOverrideMode(service.id, day.value, 'INHERIT')}
                                    className={cn(
                                      'py-1 text-[11px] font-bold rounded-md transition-all text-center cursor-pointer',
                                      currentMode === 'INHERIT'
                                        ? 'bg-white text-gray-900 shadow-2xs'
                                        : 'text-gray-500 hover:text-gray-800'
                                    )}
                                  >
                                    Inherit
                                  </button>

                                  {/* ALLOW Button */}
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={currentMode === 'AVAILABLE'}
                                    disabled={readOnly}
                                    onClick={() => handleSetServiceOverrideMode(service.id, day.value, 'AVAILABLE')}
                                    className={cn(
                                      'py-1 text-[11px] font-bold rounded-md transition-all text-center cursor-pointer',
                                      currentMode === 'AVAILABLE'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'text-gray-500 hover:text-emerald-700'
                                    )}
                                  >
                                    Allow
                                  </button>

                                  {/* BLOCK Button */}
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={currentMode === 'UNAVAILABLE'}
                                    disabled={readOnly}
                                    onClick={() => handleSetServiceOverrideMode(service.id, day.value, 'UNAVAILABLE')}
                                    className={cn(
                                      'py-1 text-[11px] font-bold rounded-md transition-all text-center cursor-pointer',
                                      currentMode === 'UNAVAILABLE'
                                        ? 'bg-rose-600 text-white shadow-2xs'
                                        : 'text-gray-500 hover:text-rose-700'
                                    )}
                                  >
                                    Block
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* SECTION 3: DATE EXCEPTIONS                                   */}
        {/* ------------------------------------------------------------ */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-crimson-700" />
                <h4 className="text-base font-bold text-gray-900">Date Exceptions & Special Dates</h4>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Override weekly availability for holidays, parish fiestas, pastoral leaves, or special dates.
              </p>
            </div>

            {!readOnly && draftDateException === null && (
              <button
                type="button"
                onClick={handleStartNewDateException}
                className="flex items-center gap-1.5 px-4 py-2 bg-crimson-700 hover:bg-crimson-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                Add Date Exception
              </button>
            )}
          </div>

          {/* Add / Edit Date Exception Form (Progressive Disclosure) */}
          {draftDateException !== null && (
            <div
              ref={dateExceptionFormRef}
              className="p-5 bg-crimson-700/[0.02] border-2 border-crimson-700/30 rounded-2xl space-y-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div>
                  <h5 className="text-sm font-bold text-gray-900">
                    {draftDateException.editingRuleId === null
                      ? 'New Date Exception'
                      : `Edit Date Exception — ${draftDateException.date}`}
                  </h5>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure general date behavior and optional service-specific overrides.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelDateException}
                  disabled={isSavingDateRule}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
                  aria-label="Cancel date exception editing"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Date Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Date */}
                <div className="space-y-1.5">
                  <label htmlFor="date-exception-picker" className="text-xs font-bold text-gray-800 block">
                    Exception Date <span className="text-crimson-700">*</span>
                  </label>
                  <input
                    id="date-exception-picker"
                    type="date"
                    value={draftDateException.date}
                    onChange={(e) =>
                      setDraftDateException((prev) => (prev ? { ...prev, date: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 font-medium"
                  />
                </div>

                {/* 2. General Date Behavior */}
                <div className="space-y-1.5">
                  <label htmlFor="date-base-mode" className="text-xs font-bold text-gray-800 block">
                    General Date Behavior
                  </label>
                  <select
                    id="date-base-mode"
                    value={draftDateException.baseMode}
                    onChange={(e) =>
                      setDraftDateException((prev) =>
                        prev ? { ...prev, baseMode: e.target.value as DateRuleMode } : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 font-medium"
                  >
                    <option value="UNAVAILABLE">Block / Closed (Parish Unavailable)</option>
                    <option value="AVAILABLE">Allow / Open (Parish Available)</option>
                    <option value="INHERIT">Inherit Weekly Default</option>
                  </select>
                </div>

                {/* 3. Reason */}
                <div className="space-y-1.5">
                  <label htmlFor="date-reason" className="text-xs font-bold text-gray-800 block">
                    Reason or Occasion <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="date-reason"
                    type="text"
                    placeholder="e.g. Parish Fiesta, Holy Week, Pastoral Retreat"
                    maxLength={255}
                    value={draftDateException.reason}
                    onChange={(e) =>
                      setDraftDateException((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
                  />
                </div>
              </div>

              {/* Service-Specific Overrides for this Date (Progressive Disclosure) */}
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Service-Specific Date Overrides</span>
                    <p className="text-[11px] text-gray-500">
                      Add overrides only for services that differ from the General Date Behavior.
                    </p>
                  </div>
                </div>

                {/* Configured Service Overrides List */}
                {Object.keys(draftDateException.serviceOverrides).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(draftDateException.serviceOverrides).map(([eventType, mode]) => {
                      const svc = services.find((s) => s.id === eventType);
                      return (
                        <div
                          key={eventType}
                          className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">
                              {svc?.label || eventType}
                            </span>
                            <span
                              className={cn(
                                'text-[11px] font-bold px-2 py-0.5 rounded-md border',
                                mode === 'AVAILABLE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              )}
                            >
                              {mode === 'AVAILABLE' ? 'Allow' : 'Block'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={mode}
                              onChange={(e) => {
                                const newMode = e.target.value as 'AVAILABLE' | 'UNAVAILABLE';
                                setDraftDateException((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        serviceOverrides: { ...prev.serviceOverrides, [eventType]: newMode },
                                      }
                                    : null
                                );
                              }}
                              className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-medium bg-gray-50 focus:bg-white"
                              aria-label={`Change mode for ${svc?.label || eventType}`}
                            >
                              <option value="AVAILABLE">Allow</option>
                              <option value="UNAVAILABLE">Block</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveServiceOverrideFromDraft(eventType)}
                              className="text-gray-400 hover:text-red-700 p-1 rounded-lg transition-colors cursor-pointer"
                              aria-label={`Remove override for ${svc?.label || eventType}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Service Override Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <ServiceOverridePicker
                    services={services}
                    existingOverrides={draftDateException.serviceOverrides}
                    selectedServiceId={newOverrideServiceId}
                    onSelectService={setNewOverrideServiceId}
                    disabled={isSavingDateRule}
                  />

                  <select
                    value={newOverrideMode}
                    onChange={(e) => setNewOverrideMode(e.target.value as 'AVAILABLE' | 'UNAVAILABLE')}
                    disabled={!newOverrideServiceId}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 font-medium disabled:opacity-50"
                    aria-label="Override mode"
                  >
                    <option value="UNAVAILABLE">Block Service</option>
                    <option value="AVAILABLE">Allow Service</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleAddServiceOverrideToDraft}
                    disabled={!newOverrideServiceId}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Override
                  </button>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Unsaved date exception draft
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCancelDateException}
                    disabled={isSavingDateRule}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveDateException()}
                    disabled={isSavingDateRule || !draftDateException.date}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-crimson-700 hover:bg-crimson-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    {isSavingDateRule ? 'Saving...' : 'Save Exception'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Date Exceptions List */}
          {serverBaseline.scheduleDateRules.length === 0 ? (
            <div className="p-8 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center space-y-2">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-700">No date exceptions configured</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Add date exceptions to block appointments on public holidays, parish fiesta dates, or special pastoral leaves.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {serverBaseline.scheduleDateRules.map((rule) => {
                const { formatted, weekdayName } = formatFriendlyDate(rule.exceptionDate);
                const hasServiceOverrides = (rule.serviceOverrides || []).length > 0;

                return (
                  <div
                    key={rule.id}
                    className="p-4 bg-white border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:border-gray-300 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{formatted}</span>
                        {weekdayName && (
                          <span className="text-xs text-gray-500 font-medium">({weekdayName})</span>
                        )}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border',
                            rule.baseMode === 'UNAVAILABLE'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : rule.baseMode === 'AVAILABLE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          )}
                        >
                          {rule.baseMode === 'UNAVAILABLE'
                            ? 'Parish Blocked'
                            : rule.baseMode === 'AVAILABLE'
                            ? 'Parish Open'
                            : 'Inherit Weekly Default'}
                        </span>
                      </div>

                      {rule.reason && (
                        <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                          <span className="text-gray-400">Reason:</span> {rule.reason}
                        </p>
                      )}

                      {hasServiceOverrides && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] font-semibold text-gray-400">Overrides:</span>
                          {rule.serviceOverrides.map((ov) => {
                            const svc = services.find((s) => s.id === ov.eventType);
                            return (
                              <span
                                key={ov.eventType}
                                className={cn(
                                  'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                                  ov.mode === 'AVAILABLE'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                )}
                              >
                                {svc?.label || ov.eventType}: {ov.mode === 'AVAILABLE' ? 'Allow' : 'Block'}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleBeginEditDateRule(rule)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-crimson-700 bg-gray-50 hover:bg-red-50/50 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                          aria-label={`Edit exception for ${formatted}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmRule(rule)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100/70 border border-red-200 rounded-lg transition-colors cursor-pointer"
                          aria-label={`Remove exception for ${formatted}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* DELETE CONFIRMATION MODAL                                    */}
        {/* ------------------------------------------------------------ */}
        {deleteConfirmRule && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={(e) => e.target === e.currentTarget && !isDeletingDateRule && setDeleteConfirmRule(null)}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-700">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Delete date availability exception?
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Are you sure you want to remove the exception for{' '}
                  <span className="font-semibold text-gray-800">
                    {formatFriendlyDate(deleteConfirmRule.exceptionDate).formatted}
                  </span>
                  ? The parish will revert to its standard weekly schedule for this date.
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmRule(null)}
                  disabled={isDeletingDateRule}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDeleteDateRule()}
                  disabled={isDeletingDateRule}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {isDeletingDateRule ? 'Deleting...' : 'Delete Exception'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default SchedulingAvailabilityEditor;
