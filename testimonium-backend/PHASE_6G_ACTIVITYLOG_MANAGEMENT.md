Phase 6G – Activity Log Lifecycle Management

Implement a production-ready Activity Log lifecycle system for Testimonium.

IMPORTANT CONSTRAINTS

- DO NOT delete ActivityLog records by default.
- Preserve audit integrity.
- Implement soft archival instead of destructive deletion.
- Only Diocese Coordinators may manage activity logs.
- Maintain existing repository → service → controller architecture.
- Maintain standardized API responses:
  {
    success: true|false,
    data?,
    message?,
    errors?
  }

=================================================
1. Database Improvements
=================================================

If ActivityLog does not already contain these fields, add them through Prisma.

archivedAt DateTime?
archivedBy Int?

Do NOT physically remove records.

=================================================
2. Repository Layer
=================================================

Extend ActivityLogRepository.

Implement:

findMany({
    includeArchived,
    archivedOnly,
    page,
    limit,
    parishId
})

archiveMany(ids, actorId)

archiveAll(actorId)

restoreMany(ids)

restoreAll()

countArchived()

countActive()

Never use deleteMany().

=================================================
3. Service Layer
=================================================

Create clean service methods:

archiveLog(id)

archiveSelected(ids)

archiveAll()

restoreLog(id)

restoreSelected(ids)

restoreAll()

All operations must:

• validate permissions
• use Prisma transactions
• generate audit log entries

Examples:

"Archived Activity Logs"

"Restored Activity Logs"

Do NOT recursively log archive operations.

Use a system flag to prevent recursion.

=================================================
4. Controllers
=================================================

Add endpoints

GET /activity-logs

supports

?page=
&limit=
&includeArchived=
&archivedOnly=

POST /activity-logs/archive

POST /activity-logs/archive-all

POST /activity-logs/restore

POST /activity-logs/restore-all

=================================================
5. Authorization
=================================================

Only

DIOCESE_COORDINATOR

may archive or restore logs.

Return

403

for every other role.

=================================================
6. Frontend
=================================================

Admin Portal only.

Activity Log page should gain:

□ Archive selected

□ Archive all

□ View archived

□ Restore selected

□ Restore all

Confirmation dialogs for every destructive operation.

Never permanently delete.

Archived logs should display

• muted color
• Archived badge
• archive timestamp

=================================================
7. Optional Maintenance Endpoint
=================================================

Create one OPTIONAL endpoint

DELETE /activity-logs/purge

Requirements

• disabled by default
• only enabled when

ENABLE_ACTIVITY_PURGE=true

inside backend .env

• only works in NODE_ENV=development

• never callable in production

This endpoint physically deletes archived logs.

If disabled return

403

with message

"Activity purge is disabled."

=================================================
8. Environment
=================================================

.env.example

Add

ENABLE_ACTIVITY_PURGE=false

Comment:

Development only.
Never enable in production.

=================================================
9. Documentation
=================================================

Update API_DOCUMENTATION.md

Document

archive endpoints

restore endpoints

development purge endpoint

permissions

expected responses

=================================================
10. Verification
=================================================

Run

npx prisma validate

node --check server.js

npm run start

Verify

✓ archive one log

✓ archive selected logs

✓ archive all

✓ restore one

✓ restore all

✓ purge only works in development

✓ purge blocked in production

✓ dashboard activity feed ignores archived logs

✓ existing functionality remains unchanged

=================================================
CRITICAL REQUIREMENTS
=================================================

Never break existing API contracts.

Never remove existing audit history.

Never introduce hard deletes outside the development purge endpoint.

Use transactions for all batch operations.

Follow existing Testimonium coding conventions.

I would additionally include these refinements
1. Archive counts in the UI

Return both active and archived totals so the admin immediately knows how many logs exist.

Example:

{
  "success": true,
  "data": {
    "items": [...],
    "total": 156,
    "active": 142,
    "archived": 14
  }
}
2. Filters

Support:

Status
-------
All
Active
Archived

instead of requiring separate pages.

3. Search archived logs

Search should work regardless of archive status.

Example:

Search:
"Parish Created"

Results:
✓ Active
✓ Archived
4. Bulk Selection UX
☐ Select All

Archive Selected

Restore Selected

instead of forcing one-by-one actions.

5. Protected System Logs

Never allow these to be archived:

Initial database migration
System initialization
First Diocese Coordinator creation
Future security logs

Add:

isSystem = true

Those remain permanently visible.

6. Better Audit Metadata

Instead of only

Archived Activity Logs

store

Archived 24 activity logs

or

Archived "User Disabled" activity

which makes the audit trail much easier to understand.

7. Restore Order

Restored logs should retain their original timestamps.

Don't recreate them.

Don't change createdAt.

Only clear

archivedAt
archivedBy
8. Dashboard

Recent Activity should automatically ignore archived logs.

No frontend filtering.

The backend should simply return only active logs.

9. Purge Safety

Require TWO conditions:

NODE_ENV=development

AND

ENABLE_ACTIVITY_PURGE=true

Not just one.

10. Confirmation Dialog

For "Archive All", require typing:

ARCHIVE

before enabling the button.

This prevents accidental clicks.

Overall recommendation

If I were shipping Testimonium to a real Diocese, I would use this final feature set:

✅ Archive One
✅ Archive Selected
✅ Archive All
✅ Restore One
✅ Restore Selected
✅ Restore All
✅ Active / Archived filters
✅ Search across both
✅ System logs protected
✅ Dashboard ignores archived logs
✅ Development-only Purge
✅ Double confirmation for Archive All
✅ Transactions for every batch operation
✅ Role restriction to Diocese Coordinators
✅ Comprehensive API documentation