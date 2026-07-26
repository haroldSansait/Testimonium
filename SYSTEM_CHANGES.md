# TESTIMONIUM — Implementation Planning Brief
## Post–System Analyst Review Enhancements

## Overview

Following the latest system analysis review, several usability, workflow, scheduling, and administrative improvements have been identified across the entire TESTIMONIUM platform. These refinements are intended to improve user experience, strengthen workflow efficiency, and better align the system with actual parish operations.

The implementation plan should organize these changes into logical phases, prioritize workflow-critical features first, and preserve the existing architecture and backend integration.

The implementation plan should **not** include code-level implementation details, database schemas, or framework-specific instructions. It should focus on objectives, deliverables, affected modules, dependencies, verification goals, and execution order.

---

# Objectives

The implementation plan should address improvements for:

- Parishioner Portal
- Secretary/Admin Portal
- Priest Portal
- Diocese Coordinator Portal

The resulting implementation should improve:

- User experience
- Scheduling workflow
- Sacramental request process
- Calendar management
- Communication between parishioners and parish personnel
- Administrative flexibility
- Consistency across all portals

---

# Parishioner Portal Objectives

## Landing Page

Plan improvements for:

- Replace references to contacting priests with contacting the assigned parish secretary.
- Update terminology from **Ecclesiastical Documents** to **Sacramental Documents**.
- Improve wording consistency throughout the landing page.

---

## Authentication

Plan improvements for:

- Login/Register layout refinement.
- Remove duplicated statements and footer content.
- Add password visibility toggle.
- Display a successful registration confirmation after account creation.
- Improve duplicate account handling.

If a user registers using another authentication provider (Google/email) with an existing email address:

- Inform the user that the account already exists.
- Redirect them to the Login page.
- Do not automatically sign them into the dashboard.

---

## First-Time User Experience

Plan a first-time onboarding flow.

After successful registration:

- Redirect users to their Profile page.
- Prompt them to complete their personal information.
- Encourage them to finalize contact information before using services.

The greeting card should recognize first-time users instead of always displaying "Welcome Back."

---

## Home Dashboard

Plan improvements to:

- Simplify the page header.
- Improve first-time user experience.
- Remove redundant headings.

---

## Vicariate Directory

Rename the current Parish Directory Map to:

**Vicariate Directory Map**

Update terminology consistently throughout the system.

Plan enhancements including:

- Full-screen interactive map mode.
- Larger information cards.
- Better navigation and usability.

---

## Sacramental Request Wizard

Review and redesign the request wizard to support document-specific requirements.

Each document type should present only the requirements relevant to that request.

### Reference Requirements

| BAPTISMAL | MARRIAGE | CONFIRMATION | MARRIAGE BANNS | PERMIT TO MARRY | STATUS OF LIBERTY | ENDORSEMENT |
|------------|----------|--------------|----------------|------------------|-------------------|-------------|
| personal information | personal information | personal information | ID | ID | ID | get it from their own GKK |
| ID | ID | ID | baptismal certificate | baptismal certificate | baptismal certificate | |
| purpose/reason | purpose/reason | purpose/reason | confirmation certificate | confirmation certificate | CENOMAR | |
| endorsement (from GKK) | endorsement (from GKK) | endorsement (from GKK) | marriage license | marriage license | canonical interview | |
| payment | payment | payment | Pre-Cana Seminar | Pre-Cana Seminar | endorsement (from GKK) | |
| | | | CENOMAR | CENOMAR | | |
| | | | banns clearance | canonical interview | | |
| | | | permit to marry (if applicable) | banns clearance | | |
| | | | endorsement (from GKK) | endorsement (from GKK) | | |

The implementation plan should include:

- Dynamic requirements per document
- Clear upload guidance
- Better user validation
- Easier review by parish staff

---

## Sign Out Flow

Plan an improved sign-out experience.

Instead of redirecting users to Login/Register:

- Return users to the public Landing Page.

---

# Secretary / Admin Portal Objectives

## Profile

Review the current Profile functionality.

Determine whether:

- it should be removed,
- relocated,
- or redesigned,

to avoid duplicated account management with User Management.

---

## Document Requests

Improve the correction workflow.

When marking a request as **Needs Correction**, parish personnel should be able to:

- explain what needs correction,
- provide notes,
- communicate required resubmissions.

Parishioners should clearly understand what needs to be corrected before resubmitting.

---

## Schedule Requests

Expand the scheduling workflow.

Support:

- alternative schedule proposals,
- accepting alternative dates,
- assigning priests after approval,
- reflecting assignments across all affected portals.

---

## Calendar Improvements

Plan enhancements including:

- clearer schedule information
- assigned priest visibility
- location display
- improved readability

Introduce:

- color coding based on assigned priest
- manual scheduling for parish events and Masses
- synchronization with the Parishioner Portal

---

## Availability Management

Introduce scheduling controls allowing secretaries to define:

- unavailable dates
- office closures
- holidays
- leave periods

These should be visible to parishioners so they understand possible delays.

---

## Priest Assignment Management

Allow secretaries to:

- reassign priests
- update assignments
- keep schedules flexible

Changes should immediately reflect throughout the system.

---

## Calendar Filters

Complete implementation of:

- Day View
- Week View
- Month View

Ensure filtering behaves correctly.

---

# Priest Portal Objectives

## Profile

Review Profile functionality for consistency.

---

## Availability

Allow priests to manage:

- unavailable dates
- leave periods
- pastoral commitments

Scheduling should respect these availability settings.

---

# Diocese Coordinator Portal Objectives

## Profile

Review Profile functionality for consistency.

---

## Assistant Priest Management

Support assigning assistant priests to parishes where applicable.

The implementation plan should consider:

- management workflow
- visibility
- scheduling implications
- future reporting

---

# Cross-Portal Goals

The implementation plan should ensure:

- Consistent terminology across all portals.
- Improved onboarding for new users.
- Better communication between parishioners and parish staff.
- Flexible scheduling workflows.
- Transparent document correction process.
- Clear availability management.
- Improved calendar usability.
- Consistent profile management experience.
- Better responsiveness and accessibility.
- Preservation of the existing architecture while extending functionality.

---

# Expected Deliverable

Produce a comprehensive implementation plan that:

- Organizes the work into logical implementation phases.
- Defines objectives for each phase.
- Lists affected modules and user roles.
- Identifies dependencies between phases.
- Includes verification goals and acceptance criteria.
- Recommends an execution order based on user impact and workflow priority.

The implementation plan should remain architecture-focused and product-oriented without including implementation code, framework-specific details, or database/schema modifications.