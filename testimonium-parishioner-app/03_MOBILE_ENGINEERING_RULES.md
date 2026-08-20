# TESTIMONIUM Parishioner Mobile — Engineering Rules

**Status:** Binding baseline for mobile implementation unless explicitly superseded.

## 1. General rules

1. Inspect the existing mobile scaffold before installing packages or moving architecture.
2. Reuse the existing backend. Do not create mobile-only duplicate business logic.
3. Backend and Prisma schema are authoritative for persisted state.
4. Do not add undocumented API contracts.
5. Do not infer hidden backend behavior from web UI text.
6. Keep feature changes focused; avoid broad refactors inside unrelated implementation phases.
7. Prefer explicit types and explicit state machines over ambiguous unions/defaults for security-sensitive behavior.
8. Build for real API mode first. Mock/demo adapters may exist for development/tests but must not define production behavior.
9. New behavior must have loading, empty, error, and retry states.
10. Do not claim runtime verification that was not actually performed.

## 2. Security rules

Never:
- ship backend Firebase Admin credentials;
- ship Cloudflare R2 access keys;
- ship database credentials;
- connect directly to PostgreSQL/Supabase from the app for application data;
- manually store Firebase ID tokens or refresh tokens;
- put secrets in `EXPO_PUBLIC_*`;
- trust client-supplied role/parish data as authorization;
- expose coordinator/staff actions in the parishioner app;
- log tokens, passwords, receipt OCR raw text, or sensitive document payloads.

Firebase client configuration is not the same as a server secret, but it must still be environment-specific and protected by proper Firebase project rules/configuration.

## 3. Authentication rules

- Firebase proves identity.
- Backend resolves application user/profile/role.
- Interactive login uses backend login/bootstrap semantics.
- Restored sessions use current-profile retrieval.
- Do not let observer/profile sync race interactive login.
- Logout must clear protected mobile state.
- A late network response after logout must not repopulate protected state.
- One forced token refresh retry maximum on 401.
- Never loop token refresh.

## 4. Authorization and tenancy

The mobile app is parishioner-facing.

- Do not rely on hiding UI as security.
- Backend must reject unauthorized actions.
- Do not send arbitrary parish IDs to "act as" staff.
- Parish selection is request context, not role/tenancy elevation.
- Do not introduce a "home parish" assumption unless backend adds it.

## 5. API rules

- Centralize API base URL and bearer-token injection.
- Centralize error parsing.
- Use `AbortController`/supported cancellation where practical.
- Apply reasonable timeouts.
- Do not retry non-idempotent mutations automatically.
- Handle 400/401/403/404/409/413/429/5xx distinctly when useful.
- Respect backend rate limits.
- Never hide a failed mutation by assuming success.

## 6. Request workflow rules

- Do not fabricate request history.
- Do not locally calculate authoritative next status.
- Show expected process separately from actual history.
- Fee displayed for an existing request must come from request snapshot/backend data.
- Correction requirement IDs/notes come from backend.
- Cancellation is only enabled when backend indicates/accepts eligibility.
- Double-submit buttons must lock while mutation is active.

## 7. Payment/OCR rules

- OCR is evidence enrichment, not payment verification.
- Never show "Payment verified" because OCR matched.
- Only backend/staff verification state can mark verified.
- Receipt upload is one intentional mutation.
- Disable repeated upload taps.
- If network outcome is ambiguous, refetch request/payment state before retrying.
- Client hash checking may not replace backend duplicate detection.

## 8. Scheduling rules

- Always fetch availability from backend.
- A visible slot is not reserved until backend accepts the request.
- On capacity/conflict rejection, refetch and explain.
- Do not duplicate Manila timezone/business rules without matching backend semantics.
- Use structured dates/times; do not encode time slot identity inside remarks/free text.
- Do not assume priest availability from cached UI alone.

## 9. File/media rules

- Validate type/size before upload for UX.
- Backend validation remains authoritative.
- Supporting docs: PDF, PNG, JPEG, WebP; current max 5 MB each, up to five.
- Receipts: JPEG/PNG only, current max 5 MB, one file.
- iOS HEIC/HEIF must be handled intentionally before receipt upload.
- Never upload directly to R2 with embedded credentials.
- Temporary device files should be cleaned when no longer needed.
- Do not persist private documents to public media galleries.

## 10. State rules

- Server state and local UI state are different.
- Do not copy query results into long-lived local stores without need.
- After mutation, update from authoritative response or invalidate/refetch.
- On logout, clear all parishioner-specific cached server data.
- Cache keys must include relevant identity/resource parameters.
- Avoid global mutable singletons for feature state.

## 11. Offline rules

Allowed:
- cached read-only parish directory/events where safe;
- skeleton/last-known UI clearly marked;
- local unsent form draft if explicitly approved and sensitive fields are handled.

Not allowed in initial version:
- automatic offline queue for payment upload;
- automatic offline queue for schedule submission;
- automatic offline queue for document-request submission;
- showing stale availability as bookable without network confirmation.

## 12. UI/UX rules

- Mobile is not a scaled desktop portal.
- Use native interaction patterns.
- Avoid duplicated brand labels.
- Use crimson/maroon as identity accent, not as a heavy admin shell.
- Primary actions must be reachable and obvious.
- Critical information must be visible, not hidden in tooltips.
- Use clear destructive confirmations where needed.
- Never display fake progress percentages.
- If real upload progress is unavailable, use indeterminate progress.
- Respect reduced motion.

## 13. Accessibility rules

- Minimum practical touch target around 44×44 pt.
- Every icon-only action has an accessible label.
- Text supports system font scaling without breaking critical flows.
- Do not use color alone to communicate status.
- Preserve sufficient contrast.
- Screen-reader order should follow visual/task order.
- Modal/sheet focus and dismissal must be predictable.
- Keyboard support is required where platform/external keyboard use is relevant.
- Loading indicators require accessible status text.

## 14. Error handling rules

Every mutation must define:
- start/loading state;
- success handling;
- validation errors;
- auth/session expiry;
- network timeout/offline;
- rate limiting when applicable;
- server error;
- cleanup/finally state.

Do not swallow failed profile refreshes, persistence failures, or upload errors.

## 15. Race-condition checklist

Before finishing a feature, explicitly inspect:
- double tap/double submit;
- stale query overwriting mutation result;
- screen unmount during request;
- logout during request;
- auth observer vs interactive sign-in;
- two uploads in parallel when only one is permitted;
- slot availability changing between load and submit;
- navigation firing before authoritative state refresh;
- background refetch replacing newer form state.

## 16. Package/dependency rules

Before adding a dependency:
1. check if the capability already exists in Expo/React Native/current package tree;
2. justify why it is needed;
3. verify Expo compatibility;
4. prefer maintained packages with TypeScript support;
5. avoid overlapping state/navigation/UI libraries.

Do not perform package upgrades as part of unrelated features.

## 17. Database/schema rules

Mobile must not edit Prisma schema directly unless the feature truly requires a backend contract change.

If a backend persisted-field change is needed:
- update Prisma schema;
- create migration;
- update backend validation/service/controller;
- update API docs;
- update mobile types/providers;
- test old/current clients as appropriate.

Never use `prisma db push` as a production migration substitute.

## 18. Documentation rules

Any contract change must update:
- API documentation;
- relevant mobile document;
- decision log when architectural;
- backend docs if storage/security behavior changes.

## 19. Coding-agent completion report

Every agent implementation should report:
- files changed;
- exact behavior implemented;
- API/backend assumptions;
- security/race/error handling considered;
- lint/type/test/build output;
- warnings introduced vs pre-existing;
- runtime flows actually tested;
- flows not tested;
- follow-up risks/TODOs.

## 20. Definition of done

A feature is not "done" solely because it compiles.

Done means:
- correct backend contract;
- secure auth/authorization behavior;
- no obvious duplicate mutation race;
- usable loading/error/empty state;
- accessible controls;
- target device layout checked;
- tests/static verification pass;
- documentation updated where necessary.
