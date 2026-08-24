import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { useParishes } from '@/features/parishes/api';
import type { ParishDto } from '@/features/parishes/types';
import { isAppError } from '@/services/api/errors';
import { colors, fontStyles, radii, spacing } from '@/theme/tokens';
import {
  useAvailabilityDates,
  useAvailableSlots,
  useCreateSchedule,
  useSchedulingConfiguration,
} from './api';
import { formatScheduleDate, makeSchedulePayloadSignature } from './presentation';
import type { ScheduleEventType } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const generateClientUuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

const getManilaDateParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  return { year, month, day, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
};

const isoForDay = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const moveMonth = (month: { year: number; month: number }, delta: number) => {
  const value = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
};

export const ScheduleWizardScreen: React.FC = () => {
  const router = useRouter();
  const today = useMemo(() => getManilaDateParts(), []);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedParishId, setSelectedParishId] = useState<number | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<ScheduleEventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState({ year: today.year, month: today.month });
  const currentKeyRef = useRef({ payloadSignature: '', key: '' });
  const lastRefreshAtRef = useRef(0);
  const inactiveAtRef = useRef<number | null>(null);

  const { data: parishesResponse, isLoading: isLoadingParishes } = useParishes({ limit: 50 });
  const parishes: ParishDto[] = parishesResponse?.items || [];
  const selectedParish = parishes.find((parish) => Number(parish.id) === selectedParishId);

  const configurationQuery = useSchedulingConfiguration(selectedParishId);
  const configuration = configurationQuery.data;
  const datesQuery = useAvailabilityDates(selectedParishId, selectedEventType);
  const slotsQuery = useAvailableSlots(selectedParishId, selectedDate, selectedEventType);
  const { refetch: refetchConfiguration } = configurationQuery;
  const { refetch: refetchDates } = datesQuery;
  const { refetch: refetchSlots } = slotsQuery;
  const createMutation = useCreateSchedule();

  const availableDateSet = useMemo(
    () => new Set(datesQuery.data?.dates || []),
    [datesQuery.data?.dates]
  );
  const selectedService = configuration?.services.find(
    (service) => service.eventType === selectedEventType
  );

  const refreshAuthoritativeAvailability = useCallback((force = false) => {
    if (!selectedParishId) return;
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < 1200) return;
    lastRefreshAtRef.current = now;
    void refetchConfiguration().then(() => {
      if (selectedEventType) void refetchDates();
      if (selectedDate && selectedEventType) void refetchSlots();
    });
  }, [refetchConfiguration, refetchDates, refetchSlots, selectedDate, selectedEventType, selectedParishId]);

  useEffect(() => {
    if (currentStep >= 2 && selectedParishId) refreshAuthoritativeAvailability();
  }, [currentStep, refreshAuthoritativeAvailability, selectedParishId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        inactiveAtRef.current = Date.now();
        return;
      }
      if (
        nextState === 'active' &&
        currentStep >= 2 &&
        inactiveAtRef.current &&
        Date.now() - inactiveAtRef.current >= 30_000
      ) {
        refreshAuthoritativeAvailability(true);
      }
      if (nextState === 'active') inactiveAtRef.current = null;
    });
    return () => subscription.remove();
  }, [currentStep, refreshAuthoritativeAvailability]);

  const configurationSignature = `${configuration?.configurationUpdatedAt || ''}|${configuration?.schedulingAvailable}|${configuration?.services.map((service) => service.eventType).join(',') || ''}`;
  useEffect(() => {
    if (!configuration || !selectedEventType) return;
    const stillOffered = configuration.schedulingAvailable && configuration.services.some(
      (service) => service.eventType === selectedEventType
    );
    if (!stillOffered) {
      const resetTimer = setTimeout(() => {
        setSelectedEventType(null);
        setSelectedDate(null);
        setSelectedSlot(null);
        setCurrentStep(2);
        setErrorMessage('This parish changed its available services. Please choose a service again.');
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [configurationSignature, configuration, selectedEventType]);

  useEffect(() => {
    if (selectedDate && datesQuery.data && !availableDateSet.has(selectedDate)) {
      const resetTimer = setTimeout(() => {
        setSelectedDate(null);
        setSelectedSlot(null);
        setCurrentStep(3);
        setErrorMessage('That date is no longer available. Please choose another date.');
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [availableDateSet, datesQuery.data, selectedDate]);

  useEffect(() => {
    if (selectedSlot && slotsQuery.data && !slotsQuery.data.includes(selectedSlot)) {
      const resetTimer = setTimeout(() => {
        setSelectedSlot(null);
        setCurrentStep(4);
        setErrorMessage('That time slot is no longer available. Please choose another time.');
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [selectedSlot, slotsQuery.data]);

  const chooseParish = (parishId: number) => {
    setSelectedParishId(parishId);
    setSelectedEventType(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setErrorMessage(null);
    setCurrentStep(2);
  };

  const chooseService = (eventType: ScheduleEventType) => {
    setSelectedEventType(eventType);
    setSelectedDate(null);
    setSelectedSlot(null);
    setErrorMessage(null);
    setCurrentStep(3);
  };

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setErrorMessage(null);
  };

  const handleBack = () => {
    if (currentStep === 1) router.back();
    else {
      setCurrentStep((step) => step - 1);
      setErrorMessage(null);
    }
  };

  const getIdempotencyKey = () => {
    const payloadSignature = makeSchedulePayloadSignature({
      parishId: selectedParishId!, eventType: selectedEventType!, date: selectedDate!,
      timeSlot: selectedSlot!, remarks,
    });
    if (currentKeyRef.current.payloadSignature === payloadSignature && currentKeyRef.current.key) {
      return currentKeyRef.current.key;
    }
    const key = `mobile-sched-${generateClientUuid()}`;
    currentKeyRef.current = { payloadSignature, key };
    return key;
  };

  const handleSubmit = async () => {
    if (!selectedParishId || !selectedEventType || !selectedDate || !selectedSlot || !selectedService) {
      setErrorMessage('Please complete each scheduling step before submitting.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        payload: {
          parishId: selectedParishId,
          eventType: selectedEventType,
          date: selectedDate,
          timeSlot: selectedSlot,
          remarks: remarks.trim() || undefined,
        },
        idempotencyKey: getIdempotencyKey(),
      });
      Alert.alert('Schedule Request Submitted', 'Your request has been sent to the parish for review.', [
        { text: 'View Details', onPress: () => router.replace(`/(app)/schedule/${created.id}` as never) },
      ]);
    } catch (error: unknown) {
      const appError = isAppError(error) ? error : null;
      const code = appError?.code ?? '';
      const configurationChanged = [
        'SCHEDULING_CONFIGURATION_INCOMPLETE', 'SERVICE_NOT_OFFERED', 'PARISH_INACTIVE',
      ].includes(code);
      const dateChanged = [
        'OFFICE_CLOSED', 'OUTSIDE_OFFICE_HOURS', 'SERVICE_BLOCKED', 'DATE_IN_PAST',
        'DATE_OUT_OF_HORIZON', 'TIME_IN_PAST',
      ].includes(code);
      const slotChanged = [
        'INVALID_TIME_SLOT', 'DAILY_CAPACITY_EXCEEDED', 'SLOT_CAPACITY_EXCEEDED',
        'SCHEDULE_CONCURRENCY_CONFLICT',
      ].includes(code);

      const availabilityChanged = configurationChanged || dateChanged || slotChanged;
      if (availabilityChanged) refreshAuthoritativeAvailability(true);
      if (configurationChanged) {
        setSelectedEventType(null);
        setSelectedDate(null);
        setSelectedSlot(null);
        setCurrentStep(2);
      } else if (dateChanged) {
        setSelectedDate(null);
        setSelectedSlot(null);
        setCurrentStep(3);
      } else if (slotChanged) {
        setSelectedSlot(null);
        setCurrentStep(4);
      }
      const retryMessage = availabilityChanged
        ? 'Scheduling availability changed. Please review the available options and try again.'
        : appError && appError.status !== undefined && appError.status >= 400 && appError.status < 500
          ? appError.message
          : 'Unable to submit your schedule request. Please try again.';
      setErrorMessage(retryMessage);
      Alert.alert('Schedule Request Not Submitted', retryMessage);
    }
  };

  const renderCalendar = () => {
    const firstWeekday = new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(calendarMonth.year, calendarMonth.month, 0)).getUTCDate();
    const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index - firstWeekday + 1);
    return (
      <Card style={styles.calendarCard}>
        <View style={styles.calendarToolbar}>
          <TouchableOpacity accessibilityRole='button' accessibilityLabel='Previous month' onPress={() => setCalendarMonth((month) => moveMonth(month, -1))} style={styles.monthButton}>
            <Ionicons name='chevron-back' size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTH_NAMES[calendarMonth.month - 1]} {calendarMonth.year}</Text>
          <TouchableOpacity accessibilityRole='button' accessibilityLabel='Next month' onPress={() => setCalendarMonth((month) => moveMonth(month, 1))} style={styles.monthButton}>
            <Ionicons name='chevron-forward' size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity accessibilityRole='button' onPress={() => setCalendarMonth({ year: today.year, month: today.month })} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
        <View style={styles.weekRow}>{WEEKDAY_NAMES.map((name) => <Text key={name} style={styles.weekday}>{name}</Text>)}</View>
        <View style={styles.calendarGrid}>
          {cells.map((day, index) => {
            if (day <= 0) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const iso = isoForDay(calendarMonth.year, calendarMonth.month, day);
            const available = availableDateSet.has(iso);
            const selected = selectedDate === iso;
            const isToday = today.iso === iso;
            return (
              <TouchableOpacity
                key={iso}
                accessibilityRole='button'
                accessibilityLabel={`${iso}${available ? ', available' : ', unavailable'}`}
                accessibilityState={{ disabled: !available, selected }}
                disabled={!available}
                onPress={() => chooseDate(iso)}
                style={[styles.dayCell, styles.dayButton, available && styles.dayAvailable, selected && styles.daySelected, isToday && styles.dayToday]}
              >
                <Text style={[styles.dayText, !available && styles.dayDisabledText, selected && styles.daySelectedText]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.calendarHelp}>Only dates confirmed by the parish are selectable.</Text>
      </Card>
    );
  };

  return (
    <Screen safeArea style={styles.screen}>
      <AppHeader title='New Schedule' subtitle={`Step ${currentStep} of 5`} onBack={handleBack} />
      <View style={styles.stepIndicator} accessibilityLabel={`Step ${currentStep} of 5`}>
        {[1, 2, 3, 4, 5].map((step) => <View key={step} style={[styles.stepDot, step <= currentStep && styles.stepDotActive]} />)}
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        {errorMessage ? <View style={styles.errorBanner}><Text style={styles.errorText}>{errorMessage}</Text></View> : null}

        {currentStep === 1 && <View style={styles.section}>
          <Text style={styles.title}>Choose a parish</Text>
          <Text style={styles.subtitle}>Select where you would like to request a schedule.</Text>
          {isLoadingParishes ? <><Skeleton height={88} /><Skeleton height={88} style={styles.skeletonGap} /></> : null}
          {!isLoadingParishes && parishes.length === 0 ? <EmptyState icon='location-outline' title='No parishes available' description='Please try again when parish directory information is available.' /> : null}
          {parishes.map((parish) => <TouchableOpacity key={parish.id} accessibilityRole='button' onPress={() => chooseParish(Number(parish.id))} style={styles.choiceCard}>
            <View style={styles.choiceIcon}><Ionicons name='business-outline' size={22} color={colors.primary} /></View>
            <View style={styles.choiceBody}><Text style={styles.choiceTitle}>{parish.name}</Text><Text style={styles.choiceDescription}>{parish.municipalityCity || parish.address || parish.type}</Text></View>
            <Ionicons name='chevron-forward' size={20} color={colors.textMuted} />
          </TouchableOpacity>)}
        </View>}

        {currentStep === 2 && <View style={styles.section}>
          <Text style={styles.title}>Choose a service</Text>
          <Text style={styles.subtitle}>{selectedParish?.name || 'Selected parish'}</Text>
          {configuration?.venueCapacity ? <Text style={styles.capacityNote}>Venue capacity: {configuration.venueCapacity} people</Text> : null}
          {configurationQuery.isLoading ? <><Skeleton height={84} /><Skeleton height={84} style={styles.skeletonGap} /></> : null}
          {!configurationQuery.isLoading && !configuration?.schedulingAvailable ? <EmptyState icon='calendar-outline' title='Online scheduling unavailable' description={configuration?.configurationUnavailable ? 'This parish has not completed its scheduling configuration.' : 'This parish is not accepting online scheduling requests right now.'} /> : null}
          {configuration?.services.map((service) => <TouchableOpacity key={service.eventType} accessibilityRole='button' onPress={() => chooseService(service.eventType)} style={styles.choiceCard}>
            <View style={styles.choiceIcon}><Ionicons name='calendar-outline' size={22} color={colors.primary} /></View>
            <View style={styles.choiceBody}><Text style={styles.choiceTitle}>{service.label}</Text><Text style={styles.choiceDescription}>Online scheduling service</Text></View>
            <Ionicons name='chevron-forward' size={20} color={colors.textMuted} />
          </TouchableOpacity>)}
        </View>}

        {currentStep === 3 && <View style={styles.section}>
          <Text style={styles.title}>Choose a date</Text>
          <Text style={styles.subtitle}>{selectedService?.label || 'Selected service'} at {selectedParish?.name || 'your parish'}</Text>
          {datesQuery.isLoading ? <Skeleton height={320} /> : renderCalendar()}
          {datesQuery.data && !datesQuery.data.serviceAvailable ? <EmptyState icon='calendar-clear-outline' title='No dates available' description='This service is currently unavailable for online scheduling.' /> : null}
          <Button title='Continue to time slot' disabled={!selectedDate} onPress={() => setCurrentStep(4)} />
        </View>}

        {currentStep === 4 && <View style={styles.section}>
          <Text style={styles.title}>Choose a time slot</Text>
          <Text style={styles.subtitle}>{selectedDate ? formatScheduleDate(selectedDate) : 'Choose a date first'}</Text>
          {slotsQuery.isLoading ? <><Skeleton height={52} /><Skeleton height={52} style={styles.skeletonGap} /></> : null}
          {!slotsQuery.isLoading && (slotsQuery.data || []).length === 0 ? <EmptyState icon='time-outline' title='No time slots available' description='Choose another date to see current parish availability.' /> : null}
          <View style={styles.slotGrid}>{(slotsQuery.data || []).map((slot) => <TouchableOpacity key={slot} accessibilityRole='button' accessibilityState={{ selected: selectedSlot === slot }} onPress={() => { setSelectedSlot(slot); setErrorMessage(null); }} style={[styles.slotButton, selectedSlot === slot && styles.slotSelected]}><Text style={[styles.slotText, selectedSlot === slot && styles.slotSelectedText]}>{slot}</Text></TouchableOpacity>)}</View>
          <Button title='Continue to confirmation' disabled={!selectedSlot} onPress={() => setCurrentStep(5)} />
        </View>}

        {currentStep === 5 && <View style={styles.section}>
          <Text style={styles.title}>Confirm your request</Text>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Parish</Text><Text style={styles.summaryValue}>{selectedParish?.name}</Text>
            <Text style={styles.summaryLabel}>Service</Text><Text style={styles.summaryValue}>{selectedService?.label}</Text>
            <Text style={styles.summaryLabel}>Date</Text><Text style={styles.summaryValue}>{selectedDate ? formatScheduleDate(selectedDate) : ''}</Text>
            <Text style={styles.summaryLabel}>Time</Text><Text style={styles.summaryValue}>{selectedSlot}</Text>
          </Card>
          <Text style={styles.inputLabel}>Notes for the parish (optional)</Text>
          <RNTextInput value={remarks} onChangeText={setRemarks} placeholder='Add relevant details' placeholderTextColor={colors.textMuted} multiline style={styles.notesInput} maxLength={1000} />
          <Button title='Submit schedule request' loading={createMutation.isPending} onPress={handleSubmit} />
        </View>}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  stepDot: { width: 28, height: 5, borderRadius: radii.pill, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  title: { ...fontStyles.titleMedium, color: colors.textPrimary },
  subtitle: { ...fontStyles.body, color: colors.textSecondary, marginTop: -spacing.sm },
  capacityNote: { ...fontStyles.caption, color: colors.textSecondary },
  errorBanner: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...fontStyles.bodySmall, color: colors.danger },
  choiceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  choiceIcon: { width: 42, height: 42, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  choiceBody: { flex: 1, gap: spacing.xxs },
  choiceTitle: { ...fontStyles.subheading, color: colors.textPrimary },
  choiceDescription: { ...fontStyles.bodySmall, color: colors.textSecondary },
  skeletonGap: { marginTop: spacing.sm },
  calendarCard: { gap: spacing.sm },
  calendarToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthButton: { padding: spacing.xs },
  monthTitle: { ...fontStyles.subheading, color: colors.textPrimary },
  todayButton: { alignSelf: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  todayButtonText: { ...fontStyles.captionMedium, color: colors.primary },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.2857%', textAlign: 'center', ...fontStyles.caption, color: colors.textMuted },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: radii.md },
  dayAvailable: { backgroundColor: colors.primarySoft },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { ...fontStyles.bodyMedium, color: colors.textPrimary },
  dayDisabledText: { color: colors.disabled },
  daySelectedText: { color: colors.surface },
  calendarHelp: { ...fontStyles.caption, color: colors.textSecondary, textAlign: 'center' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotButton: { minWidth: '46%', flexGrow: 1, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  slotSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  slotText: { ...fontStyles.button, color: colors.textPrimary },
  slotSelectedText: { color: colors.surface },
  summaryCard: { gap: spacing.xs },
  summaryLabel: { ...fontStyles.caption, color: colors.textSecondary, marginTop: spacing.sm },
  summaryValue: { ...fontStyles.bodyMedium, color: colors.textPrimary },
  inputLabel: { ...fontStyles.bodyMedium, color: colors.textPrimary },
  notesInput: { minHeight: 108, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, ...fontStyles.body, color: colors.textPrimary, textAlignVertical: 'top', backgroundColor: colors.surface },
});
