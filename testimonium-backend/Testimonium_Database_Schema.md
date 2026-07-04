## **Testimonium — Database Architecture** 

Database Schema Reference & Entity Descriptions _Vicariate of Canlaon, Diocese of San Carlos_ 

## **Database Architecture Overview** 

The TESTIMONIUM database uses a relational model implemented in PostgreSQL. It is organized around ten core tables that support the sacramental document request workflow, church scheduling, role-based access control, automated notifications, the Caloy FAQ chatbot, and system audit logging. All tables include timestamps for traceability. The database does not serve as a replacement for official sacramental record books — it supports request processing, scheduling coordination, and system monitoring only. 

## **Entities and Descriptions** 

|||
|---|---|
|**Entity / Table**|**Description**|
|||
|||
|`users`|Stores account information for all system users: parishioners, parish personnel, and<br>the Diocese Coordinator/System Administrator.|
|||
|`roles`|Defines the three access roles in the system and their labels.|
|||
|`parishes`|Stores information about the parishes and mission stations covered by the Vicariate of<br>Canlaon.|
|||
|`document_requests`|Stores all sacramental document request records including type, status, payment<br>status, payment proof, and processing details.|
|||
|`requirements`|Stores metadata for files uploaded by parishioners as supporting requirements for a<br>document request.|
|||
|`schedules`|Stores church scheduling requests including event type, requested dates, conflict<br>detection flag, and confirmation status.|
|||
|`notifications`|Stores notification messages sent to users through push, in-app, or email channels.|
|||
|`faq_knowledge_base`|Stores the FAQ entries and answers used by the Caloy rule-based chatbot to respond<br>to common parishioner inquiries.|
|||
|`chatbot_logs`|Records each chatbot interaction for monitoring, quality review, and future FAQ<br>improvement.|
|||
|`activity_logs`|Stores a record of significant system actions for accountability, monitoring, and audit<br>purposes.|



## **Entity Relationships** 

||||
|---|---|---|
|**From Table**|**To Table**|**Relationship**|
||||
||||
|`users`|`roles`|Many-to-one. Each user has one role; each role can be<br>assigned to many users.|
||||
|`users`|`parishes`|Many-to-one. Each user belongs to one parish; each<br>parish has many users.|
||||
|`document_requests`|`users`|Many-to-one. Each request is submitted by one<br>parishioner. processed_by references a staff user.|



||||
|---|---|---|
|**From Table**|**To Table**|**Relationship**|
||||
||||
|`document_requests`|`parishes`|Many-to-one. Each request is directed to one parish.|
||||
|`requirements`|`document_requests`|Many-to-one. Each requirement file belongs to one<br>document request.|
||||
|`schedules`|`users`|Many-to-one. Each schedule is requested by one<br>parishioner. processed_by references a staff user.|
||||
|`schedules`|`parishes`|Many-to-one. Each schedule request is assigned to one<br>parish.|
||||
|`notifications`|`users`|Many-to-one. Each notification is sent to one user.|
||||
|`faq_knowledge_base`|`users`|Many-to-one. updated_by references the admin who last<br>modified the FAQ entry.|
||||
|`chatbot_logs`|`users`|Many-to-one (nullable). Each log entry optionally<br>references a logged-in user.|
||||
|`activity_logs`|`users`|Many-to-one (nullable). Each log entry optionally<br>references the user who performed the action.|



## **Database Schema Tables** 

**Table 1 — users** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`user_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each user account|
|||||
|`name`|`VARCHAR(150)`|NOT NULL|Full name of the user|
|||||
|`email`|`VARCHAR(150)`|NOT NULL,<br>UNIQUE|Email address used for login and<br>notifications|
|||||
|`password_hash`|`VARCHAR(255)`|NOT NULL|Hashed password (bcrypt or Argon2)|
|||||
|`contact_number`|`VARCHAR(20)`|NULLABLE|Mobile or landline number for contact|
|||||
|`role_id`|`INT`|FK → roles, NOT<br>NULL|References the role assigned to the user|
|||||
|`parish_id`|`INT`|FK → parishes,<br>NULLABLE|Parish the user belongs to or manages|
|||||
|`is_verified`|`BOOLEAN`|DEFAULT FALSE|Indicates if the account email is verified|
|||||
|`status`|`ENUM`|DEFAULT 'active'|Account status: active or inactive|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Date and time the account was created|
|||||
|`updated_at`|`TIMESTAMP`|ON UPDATE NOW()|Date and time the account was last<br>updated|



_Note: password_hash stores the output of bcrypt or Argon2 — never a plaintext password. status ENUM values: 'active', 'inactive'._ 

**Table 2 — roles** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`role_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each role|
|||||
|`role_name`|`VARCHAR(50)`|NOT NULL,<br>UNIQUE|Role label: parishioner, parish_personnel,<br>diocese_coordinator|
|||||
|`description`|`TEXT`|NULLABLE|Description of the role and its access level|



_Note: role_name ENUM values: 'parishioner', 'parish_personnel', 'diocese_coordinator'. Additional roles may be added in future versions._ 

**Table 3 — parishes** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`parish_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each parish|
|||||
|`parish_name`|`VARCHAR(150)`|NOT NULL|Official name of the parish or mission<br>station|
|||||
|`address`|`TEXT`|NULLABLE|Physical address of the parish|
|||||
|`contact_number`|`VARCHAR(20)`|NULLABLE|Parish contact number|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Date and time the parish record was<br>created|
|||||
|`updated_at`|`TIMESTAMP`|ON UPDATE NOW()|Date and time the parish record was last<br>updated|



_Note: Covers all parishes and mission stations within the Vicariate of Canlaon._ 

**Table 4 — document_requests** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`request_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each document<br>request|
|||||
|`user_id`|`INT`|FK → users, NOT<br>NULL|Parishioner who submitted the<br>request|
|||||
|`parish_id`|`INT`|FK → parishes, NOT<br>NULL|Parish where the request is directed|
|||||
|`document_type`|`VARCHAR(100)`|NOT NULL|Type of sacramental document<br>requested (e.g., Baptismal<br>Certificate)|
|||||
|`purpose`|`TEXT`|NULLABLE|Stated purpose or reason for the<br>request|
|||||
|`status`|`ENUM`|DEFAULT 'pending'|Request status: pending,<br>under_review, approved, rejected|
|||||
|`payment_status`|`ENUM`|DEFAULT 'unpaid'|Payment status: unpaid,<br>proof_submitted, confirmed|
|||||
|`payment_proof_path`|`VARCHAR(255)`|NULLABLE|File path to the uploaded payment<br>screenshot or proof|



|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`payment_qr_reference`|`VARCHAR(100)`|NULLABLE|QR code reference number<br>displayed to the parishioner|
|||||
|`processed_by`|`INT`|FK → users,<br>NULLABLE|Parish personnel who reviewed and<br>processed the request|
|||||
|`remarks`|`TEXT`|NULLABLE|Staff notes on approval, rejection, or<br>follow-up instructions|
|||||
|`date_requested`|`TIMESTAMP`|DEFAULT NOW()|Date and time the request was<br>submitted|
|||||
|`date_processed`|`TIMESTAMP`|NULLABLE|Date and time the request was<br>approved or rejected|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Record creation timestamp|
|||||
|`updated_at`|`TIMESTAMP`|ON UPDATE NOW()|Record last updated timestamp|



_Note: status ENUM values: 'pending', 'under_review', 'approved', 'rejected'. payment_status ENUM values: 'unpaid', 'proof_submitted', 'confirmed'. Payment processing is not handled by the system — SELYO displays a QR code (GCash/Maya) and staff manually confirms the uploaded payment proof._ 

**Table 5 — requirements** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`requirement_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each uploaded<br>requirement|
|||||
|`request_id`|`INT`|FK →<br>document_requests,<br>NOT NULL|Document request this requirement<br>belongs to|
|||||
|`file_name`|`VARCHAR(255)`|NOT NULL|Original filename of the uploaded file|
|||||
|`file_path`|`VARCHAR(255)`|NOT NULL|Storage path or URL of the uploaded file|
|||||
|`file_type`|`VARCHAR(50)`|NULLABLE|MIME type of the file (e.g., image/jpeg,<br>application/pdf)|
|||||
|`file_size`|`INT`|NULLABLE|File size in kilobytes|
|||||
|`uploaded_at`|`TIMESTAMP`|DEFAULT NOW()|Date and time the file was uploaded|



_Note: file_path stores the URL or relative path to the file in cloud storage (e.g., Cloudflare R2). Files are not stored directly in the database._ 

**Table 6 — schedules** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`schedule_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each schedule<br>request|
|||||
|`user_id`|`INT`|FK → users, NOT<br>NULL|Parishioner who submitted the schedule<br>request|
|||||
|`parish_id`|`INT`|FK → parishes, NOT<br>NULL|Parish where the scheduled event will<br>take place|



|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`event_type`|`ENUM`|NOT NULL|Event type: wedding, baptism,<br>confirmation, private_mass,<br>mass_intention|
|||||
|`requested_date`|`DATE`|NOT NULL|Preferred date requested by the<br>parishioner|
|||||
|`start_datetime`|`DATETIME`|NULLABLE|Confirmed or requested event start date<br>and time|
|||||
|`end_datetime`|`DATETIME`|NULLABLE|Confirmed or estimated event end date<br>and time|
|||||
|`status`|`ENUM`|DEFAULT 'pending'|Schedule status: pending, confirmed,<br>rejected|
|||||
|`conflict_flag`|`BOOLEAN`|DEFAULT FALSE|Indicates if a scheduling conflict was<br>detected|
|||||
|`remarks`|`TEXT`|NULLABLE|Staff notes on schedule approval,<br>rejection, or conflicts|
|||||
|`processed_by`|`INT`|FK → users,<br>NULLABLE|Parish personnel who reviewed the<br>schedule request|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Record creation timestamp|
|||||
|`updated_at`|`TIMESTAMP`|ON UPDATE NOW()|Record last updated timestamp|



_Note: event_type ENUM values: 'wedding', 'baptism', 'confirmation', 'private_mass', 'mass_intention'. conflict_flag is set to TRUE when the system detects an overlapping approved schedule for the same parish, event type, and datetime range. status ENUM values: 'pending', 'confirmed', 'rejected'._ 

**Table 7 — notifications** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`notification_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each notification|
|||||
|`user_id`|`INT`|FK → users, NOT<br>NULL|User who receives the notification|
|||||
|`title`|`VARCHAR(150)`|NOT NULL|Short notification title or subject|
|||||
|`message`|`TEXT`|NOT NULL|Full notification message content|
|||||
|`type`|`ENUM`|NOT NULL|Notification channel: push, in_app, email|
|||||
|`is_read`|`BOOLEAN`|DEFAULT FALSE|Indicates whether the user has read the<br>notification|
|||||
|`date_sent`|`TIMESTAMP`|DEFAULT NOW()|Date and time the notification was sent|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Record creation timestamp|



_Note: type ENUM values: 'push', 'in_app', 'email'. Push notifications are delivered via Firebase Cloud Messaging (FCM)._ 

**Table 8 — faq_knowledge_base** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`faq_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each FAQ entry|



|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`question`|`TEXT`|NOT NULL|Frequently asked question text|
|||||
|`answer`|`TEXT`|NOT NULL|Official answer or system guidance for the<br>question|
|||||
|`category`|`VARCHAR(100)`|NULLABLE|Topic category (e.g., Requirements,<br>Scheduling, Tracking)|
|||||
|`is_active`|`BOOLEAN`|DEFAULT TRUE|Indicates if the FAQ entry is currently<br>shown in the chatbot|
|||||
|`updated_by`|`INT`|FK → users,<br>NULLABLE|Admin user who last updated this FAQ<br>entry|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Date and time the FAQ entry was created|
|||||
|`updated_at`|`TIMESTAMP`|ON UPDATE NOW()|Date and time the FAQ entry was last<br>modified|



_Note: This table powers the Caloy rule-based FAQ chatbot. Caloy uses keyword matching against the question field to return the corresponding answer. It does not use an external AI model._ 

**Table 9 — chatbot_logs** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`chatbot_log_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each chatbot<br>interaction log|
|||||
|`user_id`|`INT`|FK → users,<br>NULLABLE|User who sent the inquiry (nullable for<br>guest sessions)|
|||||
|`session_id`|`VARCHAR(100)`|NULLABLE|Session identifier for grouping a<br>conversation thread|
|||||
|`question`|`TEXT`|NOT NULL|Message or question submitted by the<br>user|
|||||
|`response`|`TEXT`|NOT NULL|Automated response returned by Caloy|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Date and time the interaction was<br>recorded|



_Note: user_id is nullable to support parishioners who interact with Caloy before logging in. Logs are used for monitoring common inquiries and improving FAQ coverage._ 

**Table 10 — activity_logs** 

|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`log_id`|`INT`|PK,<br>AUTO_INCREMENT|Unique identifier for each activity log<br>entry|
|||||
|`user_id`|`INT`|FK → users,<br>NULLABLE|User who performed the action<br>(nullable for system actions)|
|||||
|`action`|`VARCHAR(255)`|NOT NULL|Description of the action performed<br>(e.g., Approved request #12)|
|||||
|`affected_table`|`VARCHAR(100)`|NULLABLE|Name of the database table affected<br>by the action|



|||||
|---|---|---|---|
|**Field Name**|**Data Type**|**Constraints**|**Description**|
|||||
|||||
|`affected_record_id`|`INT`|NULLABLE|ID of the specific record that was<br>affected|
|||||
|`ip_address`|`VARCHAR(45)`|NULLABLE|IP address of the user at the time of<br>the action|
|||||
|`created_at`|`TIMESTAMP`|DEFAULT NOW()|Date and time the action was recorded|



_Note: ip_address supports IPv6 (up to 45 characters). This table is write-only for regular users — only the Diocese Coordinator/System Administrator may view activity logs. Supports SDG 16 transparency and accountability objectives of the study._ 

## **Database Security Notes** 

|||
|---|---|
|**Security Measure**|**Implementation Detail**|
|||
|||
|Password hashing|All passwords are hashed using bcrypt or Argon2 before storage. Plaintext<br>passwords are never stored in the database.|
|||
|Role-based access|Every API query filters data by role_id and parish_id. Parish personnel cannot<br>access records from other parishes.|
|||
|Input validation|All form inputs are validated on the backend before database insertion to<br>prevent SQL injection and malformed data.|
|||
|File validation|Uploaded requirement files and payment proofs are validated by MIME type<br>and size limit before storage.|
|||
|Audit logging|All significant actions (approvals, rejections, account changes) are recorded in<br>activity_logs with user ID, IP address, and timestamp.|
|||
|Automated timestamps|All tables use created_at and updated_at timestamps to support data<br>traceability and audit review.|
|||
|Data backup|The production PostgreSQL instance should have automated daily backups<br>enabled through the hosting platform.|



