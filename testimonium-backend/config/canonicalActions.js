/**
 * Centralized Canonical Action Types & Legacy Pattern Mappings
 * Pure data catalog: No DB connections or runtime side-effects.
 */

export const CANONICAL_ACTION_TYPES = [
  "Activity Logs Archived",
  "Activity Logs Purged",
  "Activity Logs Restored",
  "Admin Email Verification Bypassed",
  "Admin Verification Bypassed",
  "Available Documents Updated",
  "Document Request Cancelled",
  "Document Request Corrections Submitted",
  "Document Request Draft Created",
  "Document Request Status Updated",
  "Document Request Submitted",
  "Duplicate Payment Warning Overridden",
  "Duplicate Provider Blocked",
  "Email Verified",
  "Google Account Linked",
  "Google Existing User",
  "Google New User",
  "JIT User Created",
  "JIT User Reused",
  "Mass Schedule Defaults Restored",
  "Mass Schedule Template Created",
  "Mass Schedule Template Deleted",
  "Mass Schedule Template Updated",
  "Parish Archived",
  "Parish Availability Created",
  "Parish Availability Deleted",
  "Parish Coordinates Updated",
  "Parish Created",
  "Parish Creation Failed",
  "Parish Directory Settings Updated",
  "Parish Event Created",
  "Parish Event Deleted",
  "Parish Event Updated",
  "Parish Event Visibility Changed",
  "Parish Restored",
  "Parish Updated",
  "Password Reset",
  "Payment QR Deleted",
  "Payment QR Uploaded",
  "Priest Assigned",
  "Priest Assignment Response Updated",
  "Priest Changed",
  "Priest Conflict Validation Failed",
  "Priest Removed",
  "Privacy Accepted",
  "Profile Completed",
  "Profile Updated",
  "Receipt Uploaded",
  "Registration Completed",
  "Role Updated",
  "Schedule Configuration Updated",
  "Schedule Date Rule Created",
  "Schedule Date Rule Removed",
  "Schedule Date Rule Updated",
  "Schedule Weekday Rule Updated",
  "Secretary Assigned",
  "Secretary Changed",
  "Secretary Removed",
  "Terms Accepted",
  "Unauthorized Cross-Parish Access Attempt",
  "User Created",
  "User Disabled",
  "User Enabled",
  "User Login",
  "User Logout",
  "User Updated",
  "Verification Email Sent",
  "Verification Resent",
].sort((a, b) => a.localeCompare(b));

export const LEGACY_ACTION_PATTERNS = {
  "Document Request Draft Created": [
    { type: "startsWith", value: "Created request draft tracking number " },
    { type: "exact", value: "CREATED_DOCUMENT_REQUEST" },
  ],
  "Document Request Submitted": [
    { type: "startsWith", value: "Submitted request " },
  ],
  "Document Request Cancelled": [
    { type: "startsWith", value: "Cancelled request " },
  ],
  "Document Request Corrections Submitted": [
    { type: "startsWith", value: "Resubmitted corrected documents for request " },
  ],
  "Document Request Status Updated": [
    { type: "startsWith", value: "Updated document request " },
    { type: "exact", value: "UPDATED_DOCUMENT_REQUEST_STATUS" },
  ],
  "Receipt Uploaded": [
    { type: "startsWith", value: "Receipt uploaded for request " },
  ],
  "Duplicate Payment Warning Overridden": [
    { type: "startsWith", value: "DUPLICATE_PAYMENT_OVERRIDE:" },
  ],
  "User Created": [
    { type: "startsWith", value: "User Created: " },
  ],
  "User Updated": [
    { type: "startsWith", value: "User Updated: " },
    { type: "startsWith", value: "Updated priest color for " },
  ],
  "User Disabled": [
    { type: "startsWith", value: "User Disabled: " },
  ],
  "User Enabled": [
    { type: "startsWith", value: "User Enabled: " },
  ],
  "Password Reset": [
    { type: "startsWith", value: "Password Reset: " },
  ],
  "Parish Created": [
    { type: "startsWith", value: "Parish Created: " },
  ],
  "Parish Updated": [
    { type: "startsWith", value: "Parish Updated: " },
  ],
  "Parish Archived": [
    { type: "startsWith", value: "Parish Archived: " },
  ],
  "Parish Restored": [
    { type: "startsWith", value: "Parish Restored: " },
  ],
  "Parish Creation Failed": [
    { type: "startsWith", value: "Parish Creation Failed: " },
  ],
  "Parish Coordinates Updated": [
    { type: "startsWith", value: "Parish Coordinates Configured: " },
  ],
  "Parish Directory Settings Updated": [
    { type: "startsWith", value: "Parish Directory Settings Updated: " },
  ],
  "Payment QR Uploaded": [
    { type: "startsWith", value: "Payment QR uploaded for parish " },
    { type: "exact", value: "Payment QR uploaded" },
  ],
  "Payment QR Deleted": [
    { type: "startsWith", value: "Payment QR deleted for parish " },
    { type: "exact", value: "Payment QR deleted" },
  ],
  "Priest Assigned": [
    { type: "startsWith", value: "Assigned Priest " },
  ],
  "Priest Changed": [
    { type: "startsWith", value: "Changed Priest for parish " },
  ],
  "Priest Removed": [
    { type: "startsWith", value: "Removed Priest from parish " },
  ],
  "Secretary Assigned": [
    { type: "startsWith", value: "Assigned Secretary " },
  ],
  "Secretary Changed": [
    { type: "startsWith", value: "Changed Secretary for parish " },
  ],
  "Secretary Removed": [
    { type: "startsWith", value: "Removed Secretary from parish " },
  ],
  "Priest Assignment Response Updated": [
    { type: "startsWith", value: "Priest " },
  ],
  "Priest Conflict Validation Failed": [
    { type: "startsWith", value: "Priest assignment validation failed: " },
  ],
  "Parish Event Created": [
    { type: "startsWith", value: "Created new parish event: " },
  ],
  "Parish Event Updated": [
    { type: "startsWith", value: "Updated parish event #" },
  ],
  "Parish Event Deleted": [
    { type: "startsWith", value: "Deleted parish event #" },
  ],
  "Parish Event Visibility Changed": [
    { type: "exact", value: "PARISH_EVENT_VISIBILITY_CHANGED" },
  ],
  "Parish Availability Created": [
    { type: "startsWith", value: "Created leave/availability block: " },
  ],
  "Parish Availability Deleted": [
    { type: "startsWith", value: "Deleted leave/availability block #" },
  ],
  "Mass Schedule Template Created": [
    { type: "startsWith", value: "Created new Mass schedule template for parish ID " },
  ],
  "Mass Schedule Template Updated": [
    { type: "startsWith", value: "Updated Mass schedule template #" },
  ],
  "Mass Schedule Template Deleted": [
    { type: "startsWith", value: "Deleted Mass schedule template #" },
  ],
  "Mass Schedule Defaults Restored": [
    { type: "startsWith", value: "Restored default Mass schedules for parish ID " },
  ],
  "Activity Logs Archived": [
    { type: "startsWith", value: "Archived " },
  ],
  "Activity Logs Restored": [
    { type: "startsWith", value: "Restored " },
  ],
  "Activity Logs Purged": [
    { type: "startsWith", value: "Purged " },
  ],
  "Unauthorized Cross-Parish Access Attempt": [
    { type: "startsWith", value: "SECURITY_ALERT: Unauthorized cross-parish access attempt" },
  ],
  "Schedule Weekday Rule Updated": [
    { type: "exact", value: "SCHEDULE_WEEKDAY_RULE_UPDATED" },
  ],
  "Schedule Date Rule Created": [
    { type: "exact", value: "SCHEDULE_DATE_RULE_CREATED" },
  ],
  "Schedule Date Rule Updated": [
    { type: "exact", value: "SCHEDULE_DATE_RULE_UPDATED" },
  ],
  "Schedule Date Rule Removed": [
    { type: "exact", value: "SCHEDULE_DATE_RULE_REMOVED" },
  ],
  "Schedule Configuration Updated": [
    { type: "exact", value: "SCHEDULING_CONFIGURATION_UPDATED" },
  ],
};
