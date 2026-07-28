# TESTIMONIUM — Next Enhancement Brief

## Parishioner Experience, Scheduling, Document Requests, and Admin Configuration

## Overview

This brief consolidates the next set of product improvements requested for TESTIMONIUM after the completion of the previous phases. The goal is to improve parishioner-facing workflows, give administrators more control over scheduling and pricing settings, and introduce priest-side schedule response handling without breaking the existing architecture, routing, provider pattern, or portal separation already in place.

The implementation plan that follows should be organized into logical phases, prioritize the most user-visible and workflow-critical items first, and remain product-focused rather than code-focused. It should define clear objectives, user outcomes, dependencies, and acceptance criteria for each phase.

---

## Primary Objectives

The next enhancement cycle should achieve the following outcomes:

* Improve the parishioner experience on the Home page, Event banner, and request flows.
* Make parish schedule and event visibility more accurate and more parish-specific.
* Allow administrators to configure pricing, requirements, schedules, and parish settings from one consistent place.
* Make the request and scheduling workflows more flexible and realistic for parish operations.
* Let priests respond to assigned schedules with accept/reject actions and optional reasons.
* Keep the vicariate directory, office schedule settings, and event visibility synchronized across portals.
* Preserve the current portal structure, provider abstraction, and backend integration style already used in TESTIMONIUM.

---

## Parishioner Portal Goals

### 1. Event Banner and Parish Filters

The parishioner Home page should show the current public events and Masses for each parish.

Required improvements:

* The banner should display current parish events and Mass schedules.
* Users should be able to filter by parish.
* Users should be able to filter by event type or schedule type.
* Only secretary-published public events and Mass schedules should appear here.
* Parishioners should not see private or unpublished items.

Expected outcome:

* Parishioners can quickly understand what is happening in each parish.
* The event banner becomes a useful public-facing summary rather than a generic display.

---

### 2. Sacramental Request Flow Improvements

The document request flow should be more flexible and easier for parishioners to complete.

Required improvements:

* Add a self/relative dropdown in the first step of document requests.
* Make the date of registry optional.
* Organize uploads so each required document has its own upload box and label.
* Some document types should have separate upload fields for each requirement.
* Where a document type has no requirements, the upload step should be skipped or simplified.

Expected outcome:

* Parishioners can understand exactly what is required.
* Parish staff can review requests more efficiently.
* Incomplete submissions should be reduced.

---

### 3. Payment Defaults

The parishioner payment experience should be simplified.

Required improvements:

* Make GCash the default payment option.
* Remove or hide PayMaya and other payment options unless they are explicitly enabled by admin settings.

Expected outcome:

* Payment instructions become simpler and more consistent.
* Parishioners are guided toward the supported payment channel by default.

---

### 4. Event Request Fields

Parishioner-requested events and schedules should include venue/address information.

Required improvements:

* Add a venue/address textbox for each event request or scheduled request.
* The venue field should appear wherever parishioners are asked to submit schedule details.

Expected outcome:

* Event and schedule records contain enough detail for staff approval and calendar placement.

---

## Admin Portal Goals

### 5. Pricing and Requirements Settings

Administrators should be able to configure document and event-related settings centrally.

Required improvements:

* Add payment price settings for documents.
* Add configurable checkbox/toggle settings for document scheduling requirements.
* Add configurable checkbox/toggle settings for event scheduling requirements.

Expected outcome:

* Secretaries and coordinators can update prices and requirement rules without changing the request workflow itself.
* The system becomes easier to maintain as requirements change over time.

---

### 6. Vicariate Meeting Calendar Entry

The admin calendar should support vicariate meeting entries.

Required improvements:

* Add a vicariate meeting event type to the calendar.
* Allow the coordinator to modify these meetings.
* Use the default schedule of every third Saturday of the quarter.
* Add a location field in settings as a textbox.

Expected outcome:

* Vicariate meetings become a first-class calendar item.
* Coordinators can adjust meeting dates and locations when needed.

---

### 7. Office Schedule Settings for Each Parish

Each parish should have configurable office hours.

Required improvements:

* Allow admins to define open and closing times per parish.
* The controls should be user-friendly, not just a raw textbox.
* Changes should be reflected on the parishioner side, especially in the vicariate directory.

Expected outcome:

* Parishioners can see accurate office availability.
* Staff can manage parish office schedules without ambiguity.

---

### 8. Calendar and Event Scheduling Standards

The admin calendar should support the new scheduling rules consistently.

Required improvements:

* Set marriage (regular) to every Saturday at 6:00 AM.
* Support secretary-created parish events separately from parishioner-requested events.
* Ensure that event visibility and scheduling behavior follow the correct category.

Expected outcome:

* Calendar entries reflect actual parish workflow and scheduling conventions.
* Public and private events are separated correctly.

---

## Priest Portal Goals

### 9. Priest Schedule Response Workflow

Priests should be able to respond to assigned schedules directly.

Required improvements:

* When a priest is assigned to a mass or event, they should be able to accept or reject it.
* Include an optional reason textbox for the response.
* Make sure the workflow does not create conflicts with secretary assignment or other schedule states.

Expected outcome:

* Priest availability becomes part of the scheduling workflow.
* Staff can respond to assignments in a traceable and structured way.

---

## Schedule and Event Catalog Goals

### 10. Updated Parishioner-Requested Event Catalog

The current parishioner event catalog should be updated to reflect the actual supported request types and requirements.

Required improvements:

* Add any new event types that do not yet exist.
* Keep existing event types that are still valid.
* Map each event to the correct requirements.

### Event Requirements Reference

| Parishioner Event       | Requirements                                                  |
| ----------------------- | ------------------------------------------------------------- |
| Marriage (Special)      | CENOMAR, marriage license, baptismal certificate, endorsement |
| Wake Mass               | Death certificate                                             |
| Funeral                 | Death certificate                                             |
| Private Mass            | N/A                                                           |
| Anointing of the Sick   | N/A                                                           |
| Fiesta                  | N/A                                                           |
| Blessing                | N/A                                                           |
| Deliverance             | N/A                                                           |
| Thanksgiving            | N/A                                                           |
| First Communion         | N/A                                                           |
| Mass of the Holy Spirit | N/A                                                           |
| Confirmation            | Baptismal certificate                                         |
| Confession              | N/A                                                           |
| Baptism                 | Marriage certificate, birth certificate / immunization card   |

Expected outcome:

* Parishioner event requests match actual parish workflow.
* Requirement handling becomes consistent across request types.

---

## Cross-Portal Consistency Goals

The implementation plan should ensure:

* Public events shown to parishioners come only from secretary-published events.
* Parish filters work consistently wherever parish data is shown.
* Calendar and event terminology is consistent across all portals.
* Payment settings, schedule settings, and event requirements remain synchronized.
* The parishioner, admin, and priest portals all reflect the same source of truth for schedules and events.

---

## Suggested Implementation Focus

The implementation plan should likely be organized into these work streams:

1. Parishioner event banner and filtering
2. Document request workflow improvements
3. Admin settings for pricing, requirements, and office hours
4. Priest response workflow for assignments
5. Calendar and event catalog alignment
6. Cross-portal consistency and final verification

---

## Desired Deliverable

Produce a full implementation plan that:

* groups the work into logical phases,
* states the objective of each phase,
* lists the affected portals and modules,
* identifies dependencies,
* defines acceptance criteria,
* and recommends a sensible execution order based on user impact and workflow importance.

The result should stay architecture-focused and product-oriented, without code-level details or database schema instructions.
