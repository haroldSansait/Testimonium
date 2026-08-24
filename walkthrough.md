# TESTIMONIUM Scheduling Remediation Notes

This replaces the interrupted-session walkthrough. It must not be read as evidence of a native export or physical-device pass.

## Current state

- Scheduling configuration is backend authoritative: parish event settings provide enabled canonical services, time slots, and daily/per-slot capacity, with no fallback values.
- Web and Mobile use the authenticated configuration, availability-date, and available-slot contracts. Booking creation and accepted reschedules revalidate the same configuration transactionally.
- The Mobile schedule entry point is the live schedule-request list and the new five-step wizard, not a placeholder shell.
- Fee, receipt, tracking, notification, settings-version, and public-event work is recorded in the source and the remediation handoff.

## Validation boundary

- Native prebuild, native build, Expo export, and physical-device scenarios were not run in this remediation.
- Release decisions must use the current command output and physical test checklist, not historical counts from the interrupted attempt.
