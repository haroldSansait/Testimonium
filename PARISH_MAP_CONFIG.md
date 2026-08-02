TESTIMONIUM — Parish Map Configuration System
Vision

Create an interactive map management module where Diocese Coordinators can visually configure every parish shown throughout TESTIMONIUM.

Instead of editing coordinates directly inside the database, coordinators manipulate everything through an intuitive map interface.

The configured information immediately becomes the single source of truth for:

Parishioner Website
Vicariate Directory
Public Parish Cards
Future Mobile Application
Future Directions / Navigation integrations
Objectives
Primary Objective

Allow Diocese Coordinators to visually manage parish locations through an interactive map editor without requiring database access.

Secondary Objectives

Improve accuracy of parish locations.

Reduce administrator dependence on developers.

Provide richer parish information.

Make the directory more engaging.

Prepare the system for future GIS features.

Goals
Functional Goals

✓ Drag parish pins

✓ Save new coordinates

✓ Upload parish cover image

✓ Upload parish logo

✓ Configure map zoom

✓ Configure pin label

✓ Configure parish display color (optional)

✓ Toggle visibility

✓ Preview before publishing

✓ Auto-sync changes to Parishioner Portal

UX Goals

Configuration should feel similar to Google Maps.

Everything should happen visually.

No manual coordinate editing.

Smooth transitions.

Modern animations.

Undo before saving.

Responsive on tablet and desktop.

Scope
Diocese Coordinator Portal

New module:

Map Configuration

Inside:

Directory Management

├── Parish List
├── Interactive Map
├── Parish Settings Panel
└── Unsaved Changes Indicator
User Flow
Coordinator Login

↓

Directory

↓

Map Configuration

↓

Select Parish

↓

Map centers on parish

↓

Drag Marker

↓

Edit Settings

↓

Preview

↓

Save

↓

Coordinates updated

↓

Parishioner website reflects changes immediately
Layout
-------------------------------------------------------
 Toolbar
-------------------------------------------------------

Search Parish

Vicariate Filter

Reset View

Preview

Save All

-------------------------------------------------------

 Parish List      |       Interactive Map
                  |
                  |
                  |
                  |
                  |
                  |
-------------------------------------------------------

      Selected Parish Settings Panel
Interactive Map Features
Draggable Marker

Every parish marker can be dragged.

During drag:

Marker lifts slightly
Shadow grows
Small bounce animation

When released:

Marker snaps into position.

Settings panel updates instantly.

Coordinate Preview

Display:

Latitude

Longitude

Last Updated

Updated By

Accuracy

Coordinates update live while dragging.

Auto Reverse Geocoding (Future)

When marker moves:

Automatically display:

Current Address

Barangay

City

Province

Purely informational.

Coordinates remain the source of truth.

Parish Settings Panel

Selecting a parish opens:

Basic Information

Church Name

Vicariate

Status

Visibility

Images
Parish Cover

Landscape image

Used in directory card

Recommended:

1600 x 900
Parish Logo

Square image

Used in:

Cards

Search

Future mobile

Recommended:

512 x 512
Map Settings

Latitude

Longitude

Map Zoom

Pin Color

Label Visibility

Directory Settings

Short Description

Mass Schedule (future)

Office Hours (future)

Website (future)

Facebook Page (future)

Contact Number

Email

Save Workflow

Coordinator drags marker.

↓

Unsaved badge appears.

↓

Save button animates.

↓

Preview available.

↓

Click Save.

↓

Backend updates coordinates.

↓

Map refreshes.

↓

Parishioner portal immediately uses new coordinates.

New Parish Workflow

Current:

Coordinator creates parish.

New workflow:

Create Parish

↓

Automatically appears in Map Configuration

↓

Highlighted

↓

Red "Needs Location" badge

↓

Coordinator drags pin

↓

Save

↓

Ready for public directory

This prevents forgotten coordinates.

Interactive Animations
Marker Hover

Scale:

1.0

↓

1.1

Soft glow.

Marker Drag

Lift upward.

Shadow expands.

Cursor changes.

Drop

Small bounce.

Elastic easing.

Save Success

Marker pulses green.

Check icon.

Toast:

Location Updated Successfully
Unsaved Changes

Orange dot.

Floating badge.

Bottom bar:

3 Unsaved Changes
Auto Focus

Selecting parish:

Map smoothly flies to marker.

Duration:

600–800 ms
Backend Changes
Parish Model

Add fields:

latitude

longitude

mapZoom

coverImage

logoImage

directoryDescription

pinColor

showLabel

updatedBy

updatedAt
New APIs

Coordinator:

GET /parishes/map-config

PATCH /parishes/:id/map

PATCH /parishes/:id/settings

PATCH /parishes/:id/images

Parishioner:

GET /directory/parishes

Returns updated coordinates.

Frontend Architecture

Coordinator Portal

New Feature:

Directory

└── Map Configuration

      Components

      ├── InteractiveMap

      ├── ParishMarker

      ├── ParishSettingsPanel

      ├── ImageUploader

      ├── UnsavedChangesBanner

      ├── PreviewDialog

      └── SaveToolbar
Recommended Libraries

Map:

Leaflet (already likely in use) or React Leaflet.

Animations:

Framer Motion.

Drag interaction:

Leaflet Dragging API.

Image uploads:

Existing Cloudflare R2 upload pipeline.

State Management

Local draft state.

Original Parish

↓

Editable Draft

↓

Save

↓

API

↓

Refresh

No backend update until Save.

Validation Rules

Coordinates required.

Latitude:

-90 to 90

Longitude:

-180 to 180

Images:

JPEG

PNG

WebP

Max:

5 MB

Cover image required aspect ratio.

Logo square.

Security Rules

Only Diocese Coordinators may access Map Configuration.

Every update:

authenticated
authorized
audited

Log:

Old Coordinates

New Coordinates

User

Timestamp

Protect image uploads using existing validation and Cloudflare R2 pipeline.

Performance Rules

Load all parish markers once.

Update only modified parish.

Do not rerender entire map after one pin changes.

Cluster markers if future parish count grows significantly (100+).

Images lazy load.

Accessibility

Keyboard navigation.

High contrast markers.

Visible focus rings.

Tooltips.

Reduced-motion support.

Future Expansion

This architecture enables several future features with minimal changes:

Route & Directions: Open Google Maps or Waze from a parish card.
Service Area Visualization: Draw vicariate boundaries or deanery regions.
Mass Finder: Filter nearby parishes based on the user's location.
Maintenance Mode: Temporarily hide closed or under-renovation churches.
Historical Locations: Keep an audit trail of coordinate changes.
Map Themes: Satellite, terrain, dark mode, or diocesan-themed styles.
Bulk Import: Import coordinates from CSV or GeoJSON for large migrations.
Constraints & Rules
Functional Rules
Only Diocese Coordinators can modify map configuration.
Parish Secretaries cannot edit parish locations.
New parishes must appear automatically in Map Configuration with a "Needs Location" state until coordinates are saved.
Changes remain local until the coordinator explicitly saves.
All changes must be audit logged.
UI Rules
No manual coordinate editing is required for normal use (advanced manual entry can be hidden behind an "Advanced" section).
All interactions should be smooth, animated, and reversible before saving.
Saving should update only modified parishes.
Technical Rules
Maintain the existing Data Provider Architecture (Demo/API/Hybrid).
Reuse the existing Cloudflare R2 image upload infrastructure.
Keep the Parishioner Portal read-only; all editing happens exclusively in the Coordinator Portal.
Ensure backward compatibility so existing parish records without images or optional metadata continue to function correctly.