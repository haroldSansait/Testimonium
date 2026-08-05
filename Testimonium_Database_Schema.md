## **Testimonium — Database Architecture** 

Database Schema Reference & Entity Descriptions _Vicariate of Canlaon, Diocese of San Carlos_ 

---

## **Database Architecture Overview** 

The TESTIMONIUM database uses a relational model implemented in PostgreSQL via **Prisma ORM (v7.8.0)** with `@prisma/adapter-pg`. It is organized around seventeen active tables that support sacramental document processing, payment verification, OCR parsing, church scheduling, staff assignment, parish directory & mapping, notification dispatching, FAQ chatbot operations, and audit logging. All tables include timestamps for full data traceability. The database supports request processing, scheduling coordination, and system monitoring.

---

## **Entities and Descriptions** 

| Entity / Table | Description |
|---|---|
| `users` | Account information for parishioners, parish secretaries, parish priests, and Diocese Coordinators. Authenticated via Firebase Auth with `firebase_uid`. |
| `roles` | Defines system authorization roles: `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR`. |
| `parishes` | Stores information for parishes, quasi-parishes, and mission stations in the Vicariate of Canlaon, including settings, cover/logo/gallery images, and map markers. |
| `document_requests` | Sacramental document request records including document type, request status, payment status, tracking number, correction notes, and processing history. |
| `request_attachments` | Metadata for primary, supporting, and receipt files stored in Cloudflare R2 object storage. |
| `payment_transactions` | Payment verification transactions linking document requests to uploaded receipts and staff verifiers. |
| `receipt_uploads` | Storage metadata for payment receipt screenshots uploaded to Cloudflare R2. |
| `ocr_results` | Extracted raw text, parsed GCash/Maya payment metadata, multi-score confidence metrics, field normalization, engine parameters, and performance telemetry. |
| `request_history` | Audit trail of status transitions, remarks, and actor IDs for document requests. |
| `schedules` | Church scheduling requests including event type, requested dates, proposed reschedules, priest assignments, and conflict flags. |
| `mass_schedule_templates` | Recurring weekly Mass schedule templates per parish with assigned presiding priests. |
| `parish_events` | Custom parish activities (Seminars, Fiestas, Holy Hours) with dates, times, and priest assignments. |
| `parish_availabilities` | Office closures, staff leave ranges, and booking availability blocks. |
| `notifications` | Notification logs dispatched to users via `PUSH`, `IN_APP`, or `EMAIL`. |
| `faq_knowledge_base` | FAQ entries and answers used by the Caloy chatbot to respond to parishioner inquiries. |
| `chatbot_logs` | Interaction transcripts between parishioners/guests and the Caloy chatbot. |
| `activity_logs` | Audit trail of system actions, logging previous/new value deltas, system flags, and archiving states. |

---

## **Entity Relationships** 

| From Table | To Table | Relationship |
|---|---|---|
| `users` | `roles` | Many-to-one (`role_id`). Each user has one role; each role has many users. |
| `users` | `parishes` | Many-to-one (`parish_id`, nullable). Staff members belong to a parish; parishioners may be unassigned. |
| `document_requests` | `users` | Many-to-one (`user_id` submitter, `processed_by` staff processor). |
| `document_requests` | `parishes` | Many-to-one (`parish_id`). Each request is routed to one parish. |
| `request_attachments` | `document_requests` | Many-to-one (`request_id`). Supporting files belong to a document request. |
| `payment_transactions` | `document_requests` | Many-to-one (`request_id`). Payment records belong to a document request. |
| `payment_transactions` | `users` | Many-to-one (`verified_by`, nullable). Staff user who verified payment. |
| `receipt_uploads` | `payment_transactions` | Many-to-one (`payment_transaction_id`). Receipt image attached to a payment transaction. |
| `ocr_results` | `receipt_uploads` | One-to-one (`receipt_upload_id`). OCR output parsed from a receipt upload. |
| `request_history` | `document_requests` | Many-to-one (`request_id`). Request audit log history. |
| `request_history` | `users` | Many-to-one (`actor_id`, nullable). Staff or parishioner who triggered the status change. |
| `schedules` | `users` | Many-to-one (`user_id` requester, `processed_by` secretary, `assigned_priest_id` priest). |
| `schedules` | `parishes` | Many-to-one (`parish_id`). Each schedule request is assigned to a parish. |
| `mass_schedule_templates` | `parishes` | Many-to-one (`parish_id`). Recurring templates belong to a parish. |
| `mass_schedule_templates` | `users` | Many-to-one (`assigned_priest_id`, nullable). Presiding priest assigned to a Mass template. |
| `parish_events` | `parishes` | Many-to-one (`parish_id`). Events belong to a parish. |
| `parish_events` | `users` | Many-to-one (`created_by`, `assigned_priest_id`, nullable). Event creator and presiding priest. |
| `parish_availabilities` | `parishes` | Many-to-one (`parish_id`). Closure/leave blocks belong to a parish. |
| `notifications` | `users` | Many-to-one (`user_id`). Notifications target a specific user account. |
| `faq_knowledge_base` | `users` | Many-to-one (`updated_by`, nullable). Admin who last modified the FAQ entry. |
| `chatbot_logs` | `users` | Many-to-one (`user_id`, nullable). Logged-in user or null for guest sessions. |
| `activity_logs` | `users` | Many-to-one (`user_id`, nullable). User who performed the audited database action. |
| `activity_logs` | `parishes` | Many-to-one (`parish_id`, nullable). Scoped parish for audit tracking. |

---

## **Database Schema Tables** 

### **Table 1 — users** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `INT` | PK, AUTO_INCREMENT (`@default(autoincrement())`) | Unique identifier for each user account |
| `firebase_uid` | `VARCHAR(128)` | UNIQUE, NULLABLE | Firebase Authentication UID linked during login |
| `full_name` | `VARCHAR(150)` | NOT NULL | Full name of the user |
| `email` | `VARCHAR(150)` | NOT NULL, UNIQUE | Email address used for login and notifications |
| `contact_number` | `VARCHAR(20)` | NULLABLE | Mobile or landline contact number |
| `address` | `TEXT` | NULLABLE | Physical home or office address |
| `role_id` | `INT` | FK → roles, NOT NULL | Foreign key referencing assigned system role |
| `parish_id` | `INT` | FK → parishes, NULLABLE | Parish association (for staff roles) |
| `is_assistant` | `BOOLEAN` | DEFAULT FALSE | Assistant flag for staff permissions |
| `is_verified` | `BOOLEAN` | DEFAULT FALSE | Email verification status flag |
| `status` | `UserStatus` | DEFAULT `ACTIVE` | Account status (`ACTIVE`, `INACTIVE`) |
| `color` | `VARCHAR(50)` | NULLABLE | Custom user calendar display color preference |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 2 — roles** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `role_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for each role |
| `role_name` | `RoleName` | NOT NULL, UNIQUE | Role enum: `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR` |
| `description` | `TEXT` | NULLABLE | Human-readable role scope description |

---

### **Table 3 — parishes** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `parish_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for each parish |
| `parish_name` | `VARCHAR(150)` | NOT NULL, UNIQUE | Official name of parish or mission station |
| `slug` | `VARCHAR(150)` | UNIQUE, NULLABLE | URL-friendly parish slug |
| `type` | `ParishType` | NOT NULL | Enum: `PARISH`, `QUASI_PARISH`, `MISSION_STATION` |
| `address` | `TEXT` | NULLABLE | Physical street address |
| `municipality_city` | `VARCHAR(100)` | NOT NULL | Municipality or city name |
| `province` | `VARCHAR(100)` | NOT NULL | Province name |
| `contact_number` | `VARCHAR(20)` | NULLABLE | Office contact number |
| `patron_saint` | `VARCHAR(150)` | NULLABLE | Patron saint name |
| `email` | `VARCHAR(150)` | NULLABLE | Official parish email address |
| `latitude` | `FLOAT` | NULLABLE | Geographical latitude coordinate |
| `longitude` | `FLOAT` | NULLABLE | Geographical longitude coordinate |
| `feast_day` | `VARCHAR(100)` | NULLABLE | Annual parish feast day date |
| `cover_image` | `VARCHAR(255)` | NULLABLE | Cloudflare R2 URL for parish cover image |
| `logo_image` | `VARCHAR(255)` | NULLABLE | Cloudflare R2 URL for parish logo image |
| `map_zoom` | `INT` | NULLABLE | Custom map zoom level |
| `pin_color` | `VARCHAR(20)` | NULLABLE | Vicariate map pin color hex code |
| `show_label` | `BOOLEAN` | DEFAULT TRUE | Toggle map label visibility |
| `directory_description` | `TEXT` | NULLABLE | Public directory summary profile |
| `location_updated_by` | `INT` | NULLABLE | User ID who updated coordinates |
| `location_updated_at` | `TIMESTAMP` | NULLABLE | Timestamp coordinates were last updated |
| `gallery` | `VARCHAR[]` | DEFAULT `[]` | Array of Cloudflare R2 URLs for gallery photos |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Active operational status toggle |
| `document_settings` | `TEXT` | NULLABLE | JSON string of parish document request fees & rules |
| `event_settings` | `TEXT` | NULLABLE | JSON string of event reservation fees & rules |
| `office_hours` | `TEXT` | NULLABLE | JSON string of parish office operating schedules |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 4 — document_requests** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `request_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for each document request |
| `user_id` | `INT` | FK → users, NOT NULL | Parishioner who submitted the request |
| `parish_id` | `INT` | FK → parishes, NOT NULL | Target parish handling the request |
| `tracking_number` | `VARCHAR(50)` | UNIQUE, NULLABLE | Public tracking reference number |
| `applicant_name` | `VARCHAR(150)` | NOT NULL | Full name of certificate subject |
| `relationship` | `VARCHAR(100)` | NULLABLE | Relationship of applicant to subject |
| `is_draft` | `BOOLEAN` | DEFAULT TRUE | Draft status flag before final submission |
| `document_type` | `DocumentType` | NOT NULL | Enum: `BAPTISMAL_CERTIFICATE`, `CONFIRMATION_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `FIRST_COMMUNION_CERTIFICATE` |
| `purpose` | `TEXT` | NULLABLE | Stated purpose for request |
| `status` | `DocumentRequestStatus` | DEFAULT `PENDING` | Request status workflow enum (`PENDING`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `PAYMENT_PENDING`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_NEEDS_CORRECTION`, `PAYMENT_VERIFIED`, `PROCESSING`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, `CANCELLED`) |
| `payment_status` | `PaymentStatus` | DEFAULT `UNPAID` | Payment state (`UNPAID`, `PROOF_SUBMITTED`, `CONFIRMED`) |
| `payment_proof_object_key` | `VARCHAR(255)` | NULLABLE | Cloudflare R2 object key of payment screenshot |
| `payment_qr_reference` | `VARCHAR(100)` | NULLABLE | GCash/Maya reference ID |
| `processed_by` | `INT` | FK → users, NULLABLE | Staff user processing request |
| `remarks` | `TEXT` | NULLABLE | General remarks or instructions |
| `correction_note` | `TEXT` | NULLABLE | Document requirement correction note |
| `payment_correction_note` | `TEXT` | NULLABLE | Payment proof correction note |
| `correction_requirement_ids` | `VARCHAR[]` | DEFAULT `[]` | Array of requirement IDs needing re-upload |
| `date_requested` | `TIMESTAMP` | DEFAULT `now()` | Initial submission date |
| `date_processed` | `TIMESTAMP` | NULLABLE | Processing completion date |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 5 — request_attachments** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `attachment_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for uploaded file attachment |
| `request_id` | `INT` | FK → document_requests, NOT NULL | Document request owner |
| `file_name` | `VARCHAR(255)` | NOT NULL | Original filename |
| `r2_object_key` | `VARCHAR(255)` | NOT NULL | Cloudflare R2 storage key |
| `file_type` | `VARCHAR(100)` | NULLABLE | File MIME type |
| `file_size` | `INT` | NULLABLE | File size in bytes |
| `category` | `VARCHAR(50)` | NOT NULL | Attachment category (`primary`, `supporting`, `receipt`) |
| `uploaded_at` | `TIMESTAMP` | DEFAULT `now()` | Upload timestamp |

---

### **Table 6 — payment_transactions** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `payment_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for payment record |
| `request_id` | `INT` | FK → document_requests, NOT NULL | Associated document request ID |
| `amount` | `DECIMAL(10,2)` | NULLABLE | Paid transaction amount |
| `provider` | `VARCHAR(50)` | NULLABLE | Payment channel (e.g. `GCash`, `Maya`) |
| `reference_number` | `VARCHAR(100)` | NULLABLE | Extracted/submitted reference number |
| `status` | `PaymentVerificationStatus` | DEFAULT `PENDING` | Verification status (`PENDING`, `VERIFIED`, `REJECTED`) |
| `verified_by` | `INT` | FK → users, NULLABLE | Staff member who verified payment |
| `verified_at` | `TIMESTAMP` | NULLABLE | Verification timestamp |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |

---

### **Table 7 — receipt_uploads** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `receipt_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for uploaded receipt |
| `payment_transaction_id` | `INT` | FK → payment_transactions, NOT NULL | Payment transaction owner |
| `r2_object_key` | `VARCHAR(255)` | NOT NULL | Cloudflare R2 object key |
| `file_name` | `VARCHAR(255)` | NOT NULL | Original receipt filename |
| `mime_type` | `VARCHAR(100)` | NULLABLE | Image MIME type |
| `file_size` | `INT` | NULLABLE | File size in bytes |
| `uploaded_at` | `TIMESTAMP` | DEFAULT `now()` | Upload timestamp |

---

### **Table 8 — ocr_results** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `ocr_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for OCR result |
| `receipt_upload_id` | `INT` | FK → receipt_uploads, UNIQUE | Associated receipt upload record |
| `reference_number` | `VARCHAR(100)` | NULLABLE | Extracted reference number |
| `amount` | `VARCHAR(50)` | NULLABLE | Raw extracted amount string |
| `payment_date` | `VARCHAR(100)` | NULLABLE | Raw extracted payment date string |
| `provider` | `VARCHAR(50)` | NULLABLE | Detected payment provider (`GCash`, `Maya`) |
| `confidence_score` | `FLOAT` | NULLABLE | Primary OCR confidence score |
| `raw_text` | `TEXT` | NULLABLE | Complete raw text payload returned by OCR engine |
| `processed_at` | `TIMESTAMP` | DEFAULT `now()` | OCR execution timestamp |
| `status` | `OcrStatus` | DEFAULT `PENDING` | OCR status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) |
| `merchant` | `VARCHAR(100)` | NULLABLE | Extracted recipient/merchant name |
| `payment_time` | `VARCHAR(50)` | NULLABLE | Extracted payment timestamp |
| `account_name` | `VARCHAR(150)` | NULLABLE | Extracted sender account name |
| `ocr_provider` | `VARCHAR(50)` | NULLABLE | Active OCR engine vendor (`ocrspace` or `stub`) |
| `ocr_duration_ms` | `INT` | NULLABLE | Execution duration in milliseconds |
| `original_file_size` | `INT` | NULLABLE | Original image size in bytes |
| `compressed_file_size` | `INT` | NULLABLE | Sharp optimized payload size in bytes |
| `ocr_confidence` | `FLOAT` | NULLABLE | Raw text recognition confidence score |
| `parser_confidence` | `FLOAT` | NULLABLE | Regex field extraction confidence score |
| `final_confidence` | `FLOAT` | NULLABLE | Combined weighted confidence score |
| `ocr_engine` | `VARCHAR(20)` | NULLABLE | Engine mode identifier (`2` for OCR.Space Engine 2) |
| `ocr_language` | `VARCHAR(20)` | NULLABLE | Language parser setting (`eng`) |
| `compression_width` | `VARCHAR` | NULLABLE | Sharp target resize width (1200px) |
| `compression_quality` | `INT` | NULLABLE | Sharp JPEG quality setting (80) |
| `normalized_amount` | `VARCHAR(50)` | NULLABLE | Standardized numeric amount string |
| `normalized_date` | `VARCHAR(30)` | NULLABLE | Standardized ISO date string |

---

### **Table 9 — request_history** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `history_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for history record |
| `request_id` | `INT` | FK → document_requests, NOT NULL | Associated request ID |
| `actor_id` | `INT` | FK → users, NULLABLE | User who performed action |
| `action` | `VARCHAR(255)` | NOT NULL | Status action description |
| `old_status` | `VARCHAR(50)` | NULLABLE | Previous status state |
| `new_status` | `VARCHAR(50)` | NULLABLE | Updated status state |
| `remarks` | `TEXT` | NULLABLE | Action comments or notes |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Action timestamp |

---

### **Table 10 — schedules** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `schedule_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for schedule request |
| `user_id` | `INT` | FK → users, NOT NULL | Parishioner requesting appointment |
| `parish_id` | `INT` | FK → parishes, NOT NULL | Target parish for event |
| `assigned_priest_id` | `INT` | FK → users, NULLABLE | Presiding priest assigned to event |
| `event_type` | `ScheduleEventType` | NOT NULL | Event type enum (`WEDDING`, `BAPTISM`, `CONFIRMATION`, `PRIVATE_MASS`, `MASS_INTENTION`, `FUNERAL`, `BLESSING`, `FIESTA`, `CONFESSION`, etc.) |
| `requested_date` | `DATE` | NOT NULL | Requested reservation date |
| `start_datetime` | `TIMESTAMP` | NULLABLE | Approved start datetime |
| `end_datetime` | `TIMESTAMP` | NULLABLE | Approved end datetime |
| `location` | `VARCHAR(150)` | NULLABLE | Event location venue |
| `proposed_date` | `DATE` | NULLABLE | Staff proposed reschedule date |
| `proposed_start_datetime` | `TIMESTAMP` | NULLABLE | Staff proposed start time |
| `proposed_end_datetime` | `TIMESTAMP` | NULLABLE | Staff proposed end time |
| `reschedule_reason` | `TEXT` | NULLABLE | Explanation for proposed reschedule |
| `status` | `ScheduleStatus` | DEFAULT `REQUESTED` | Status enum (`PENDING`, `REQUESTED`, `PROPOSED_RESCHEDULE`, `WAITING_PARISHIONER_RESPONSE`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`) |
| `conflict_flag` | `BOOLEAN` | DEFAULT FALSE | Automated schedule overlap warning flag |
| `remarks` | `TEXT` | NULLABLE | Additional staff or parishioner notes |
| `display_title` | `VARCHAR(150)` | NULLABLE | Title displayed on calendar feed |
| `processed_by` | `INT` | FK → users, NULLABLE | Secretary who processed schedule |
| `priest_response_status` | `VARCHAR(50)` | NULLABLE | Priest assignment response status (`CONFIRMED`, `REJECTED`) |
| `priest_response_reason` | `TEXT` | NULLABLE | Priest response notes |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 11 — mass_schedule_templates** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `template_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for Mass schedule template |
| `parish_id` | `INT` | FK → parishes, NOT NULL | Parish holding recurring Mass |
| `day_type` | `VARCHAR(20)` | NOT NULL | Day type (`SUNDAY`, `WEEKDAY`, `HOLIDAY`, `SPECIAL`) |
| `time_slot` | `VARCHAR(20)` | NOT NULL | Scheduled Mass time slot (e.g. `06:00 AM`) |
| `label` | `VARCHAR(100)` | NOT NULL | Mass title label (e.g. `Sunday High Mass`) |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Active template toggle |
| `assigned_priest_id` | `INT` | FK → users, NULLABLE | Assigned presiding priest |
| `priest_response_status` | `VARCHAR(50)` | NULLABLE | Priest acceptance status |
| `priest_response_reason` | `TEXT` | NULLABLE | Priest notes or reasons |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 12 — parish_events** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `event_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for parish event |
| `parish_id` | `INT` | FK → parishes, NOT NULL | Hosting parish ID |
| `created_by` | `INT` | FK → users, NULLABLE | Staff member who created event |
| `title` | `VARCHAR(150)` | NOT NULL | Event title |
| `event_type` | `VARCHAR(50)` | NOT NULL | Event type (`FIESTA`, `SEMINAR`, `OTHER`) |
| `description` | `TEXT` | NULLABLE | Detailed event description |
| `location` | `VARCHAR(150)` | NULLABLE | Event venue |
| `event_date` | `DATE` | NOT NULL | Scheduled event date |
| `start_time` | `VARCHAR(20)` | NULLABLE | Event start time |
| `end_time` | `VARCHAR(20)` | NULLABLE | Event end time |
| `assigned_priest_id` | `INT` | FK → users, NULLABLE | Presiding priest assigned |
| `priest_response_status` | `VARCHAR(50)` | NULLABLE | Priest acceptance status |
| `priest_response_reason` | `TEXT` | NULLABLE | Priest response notes |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Active event toggle |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 13 — parish_availabilities** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `availability_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for availability block |
| `parish_id` | `INT` | FK → parishes, NOT NULL | Parish experiencing closure/leave |
| `user_id` | `INT` | FK → users, NULLABLE | Staff member taking leave (if applicable) |
| `type` | `AvailabilityType` | NOT NULL | Enum (`PARISH_CLOSED`, `SECRETARY_LEAVE`, `PRIEST_LEAVE`, `FULLY_BOOKED`) |
| `start_date` | `DATE` | NOT NULL | Unavailability start date |
| `end_date` | `DATE` | NOT NULL | Unavailability end date |
| `title` | `VARCHAR(150)` | NOT NULL | Title of closure or leave reason |
| `description` | `TEXT` | NULLABLE | Additional context |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 14 — notifications** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `notification_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for notification |
| `user_id` | `INT` | FK → users, NOT NULL | Recipient user ID |
| `title` | `VARCHAR(150)` | NOT NULL | Notification title |
| `message` | `TEXT` | NOT NULL | Notification body message |
| `type` | `NotificationType` | NOT NULL | Delivery channel (`PUSH`, `IN_APP`, `EMAIL`) |
| `is_read` | `BOOLEAN` | DEFAULT FALSE | Read status flag |
| `read_at` | `TIMESTAMP` | NULLABLE | Read timestamp |
| `date_sent` | `TIMESTAMP` | DEFAULT `now()` | Sent timestamp |
| `reference_type` | `NotificationReferenceType` | NULLABLE | Linked object type (`DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL`) |
| `reference_id` | `INT` | NULLABLE | Primary key ID of linked record |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |

---

### **Table 15 — faq_knowledge_base** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `faq_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for FAQ entry |
| `question` | `TEXT` | NOT NULL | Frequently asked question text |
| `answer` | `TEXT` | NOT NULL | Official guidance answer |
| `category` | `VARCHAR(100)` | NULLABLE | Category tag |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Active chatbot FAQ entry toggle |
| `updated_by` | `INT` | FK → users, NULLABLE | Admin who last updated entry |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `@updatedAt` | Record last updated timestamp |

---

### **Table 16 — chatbot_logs** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `chatbot_log_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for chatbot interaction log |
| `user_id` | `INT` | FK → users, NULLABLE | User ID (nullable for guest sessions) |
| `session_id` | `VARCHAR(100)` | NULLABLE | Chatbot thread session identifier |
| `question` | `TEXT` | NOT NULL | User inquiry text |
| `response` | `TEXT` | NOT NULL | Chatbot response text |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Interaction timestamp |

---

### **Table 17 — activity_logs** 

| Field Name | Data Type | Constraints | Description |
|---|---|---|---|
| `log_id` | `INT` | PK, AUTO_INCREMENT | Unique identifier for activity audit log entry |
| `user_id` | `INT` | FK → users, NULLABLE | User performing action |
| `action` | `VARCHAR(255)` | NOT NULL | Action description |
| `affected_table` | `VARCHAR(100)` | NULLABLE | Database table name targeted |
| `affected_record_id` | `INT` | NULLABLE | Target record primary key |
| `ip_address` | `VARCHAR(45)` | NULLABLE | Client IP address |
| `user_agent` | `VARCHAR(255)` | NULLABLE | Browser user agent string |
| `archived_at` | `TIMESTAMP` | NULLABLE | Archiving timestamp |
| `archived_by` | `INT` | NULLABLE | Admin ID who archived log |
| `is_system` | `BOOLEAN` | DEFAULT FALSE | System-generated event flag |
| `role` | `VARCHAR(50)` | NULLABLE | Active user role during action |
| `parish_id` | `INT` | FK → parishes, NULLABLE | Associated parish scope |
| `previous_values` | `TEXT` | NULLABLE | JSON string of record state before update |
| `new_values` | `TEXT` | NULLABLE | JSON string of record state after update |
| `metadata` | `TEXT` | NULLABLE | JSON string of extended event metadata |
| `created_at` | `TIMESTAMP` | DEFAULT `now()` | Log creation timestamp |

---

## **Database Security & Compliance Notes** 

| Security Measure | Implementation Detail |
|---|---|
| Firebase Auth JWT Verification | Firebase Auth manages passwords and user credentials. PostgreSQL stores `firebase_uid` for JIT user provisioning and role authorization. |
| Scoped RBAC Row Isolation | Queries filter by assigned `parish_id` and `user_id`. Staff cannot view or mutate entries belonging to unassigned parishes. |
| Input Validation | All request payloads pass Zod schema validation before database insertion, mitigating injection risks. |
| Audit Logging & State Deltas | All critical operations record full previous/new state JSON snapshots in `activity_logs`, supporting audit requirements. |
| Cloud Object Decoupling | Binary uploads (documents, receipts, covers, logos, galleries) are uploaded to Cloudflare R2, keeping PostgreSQL lean. |
| Timestamps & Tracing | All tables enforce `@default(now())` and `@updatedAt` timestamps for complete audit traceability. |
