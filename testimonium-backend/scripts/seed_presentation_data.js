import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(__dirname, "presentation_seed_manifest.json");

// Excluded table counters for non-invasive dynamic verification
async function getExcludedCounts() {
  const [
    chatbotLogs,
    aiUsageEvents,
    caloyRuntimeConfig,
    systemLeases,
    knowledgeSources,
    knowledgeChunks,
    activityLogs,
    massScheduleTemplates,
  ] = await Promise.all([
    prisma.chatbotLog.count(),
    prisma.aiUsageEvent.count(),
    prisma.caloyRuntimeConfig.count(),
    prisma.systemLease.count(),
    prisma.knowledgeSource.count(),
    prisma.knowledgeChunk.count(),
    prisma.activityLog.count(),
    prisma.massScheduleTemplate.count(),
  ]);

  return {
    chatbotLogs,
    aiUsageEvents,
    caloyRuntimeConfig,
    systemLeases,
    knowledgeSources,
    knowledgeChunks,
    activityLogs,
    massScheduleTemplates,
  };
}

function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
      return {
        manifestVersion: data.manifestVersion || "1.0.0",
        generatedAt: data.generatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parishionerUserIds: Array.isArray(data.parishionerUserIds) ? data.parishionerUserIds : [],
        documentRequestIds: Array.isArray(data.documentRequestIds) ? data.documentRequestIds : [],
        paymentTransactionIds: Array.isArray(data.paymentTransactionIds) ? data.paymentTransactionIds : [],
        scheduleIds: Array.isArray(data.scheduleIds) ? data.scheduleIds : [],
        parishEventIds: Array.isArray(data.parishEventIds) ? data.parishEventIds : [],
        dailyReportIds: Array.isArray(data.dailyReportIds) ? data.dailyReportIds : [],
      };
    } catch {
      // fallback to empty structure on corrupt file
    }
  }

  return {
    manifestVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parishionerUserIds: [],
    documentRequestIds: [],
    paymentTransactionIds: [],
    scheduleIds: [],
    parishEventIds: [],
    dailyReportIds: [],
  };
}

function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  // Ensure unique sorted integers
  manifest.parishionerUserIds = Array.from(new Set(manifest.parishionerUserIds)).sort((a, b) => a - b);
  manifest.documentRequestIds = Array.from(new Set(manifest.documentRequestIds)).sort((a, b) => a - b);
  manifest.paymentTransactionIds = Array.from(new Set(manifest.paymentTransactionIds)).sort((a, b) => a - b);
  manifest.scheduleIds = Array.from(new Set(manifest.scheduleIds)).sort((a, b) => a - b);
  manifest.parishEventIds = Array.from(new Set(manifest.parishEventIds)).sort((a, b) => a - b);
  manifest.dailyReportIds = Array.from(new Set(manifest.dailyReportIds)).sort((a, b) => a - b);

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  // Also sync to workspace root scripts directory if present
  const rootScriptsPath = path.resolve(__dirname, "../../scripts/presentation_seed_manifest.json");
  try {
    const rootDir = path.dirname(rootScriptsPath);
    if (fs.existsSync(rootDir)) {
      fs.writeFileSync(rootScriptsPath, JSON.stringify(manifest, null, 2), "utf8");
    }
  } catch {
    // optional sync
  }
}

// ---------------------------------------------------------
// Seed Dataset Definitions
// ---------------------------------------------------------

const SEED_USERS = [
  {
    email: "presentation.user01@testimonium.local",
    fullName: "Juan Dela Cruz",
    contactNumber: "+639171234501",
    address: "Brgy. Poblacion, San Carlos City, Negros Occidental",
    parishId: 2,
    createdAt: new Date("2026-03-20T08:30:00.000Z"),
  },
  {
    email: "presentation.user02@testimonium.local",
    fullName: "Maria Clara Santos",
    contactNumber: "+639171234502",
    address: "Brgy. Palampas, San Carlos City, Negros Occidental",
    parishId: 3,
    createdAt: new Date("2026-04-15T09:15:00.000Z"),
  },
  {
    email: "presentation.user03@testimonium.local",
    fullName: "Paolo Reyes",
    contactNumber: "+639171234503",
    address: "Brgy. Guadalupe, San Carlos City, Negros Occidental",
    parishId: 6,
    createdAt: new Date("2026-05-18T10:00:00.000Z"),
  },
  {
    email: "presentation.user04@testimonium.local",
    fullName: "Angela Cruz",
    contactNumber: "+639171234504",
    address: "Brgy. Rizal, San Carlos City, Negros Occidental",
    parishId: 7,
    createdAt: new Date("2026-06-22T11:45:00.000Z"),
  },
  {
    email: "presentation.user05@testimonium.local",
    fullName: "Miguel Flores",
    contactNumber: "+639171234505",
    address: "Brgy. Punao, San Carlos City, Negros Occidental",
    parishId: 2,
    createdAt: new Date("2026-07-10T14:20:00.000Z"),
  },
  {
    email: "presentation.user06@testimonium.local",
    fullName: "Carmela Garcia",
    contactNumber: "+639171234506",
    address: "Brgy. San Juan, San Carlos City, Negros Occidental",
    parishId: 3,
    createdAt: new Date("2026-08-05T08:00:00.000Z"),
  },
  {
    email: "presentation.user07@testimonium.local",
    fullName: "Gabriel Ramos",
    contactNumber: "+639171234507",
    address: "Brgy. Prosperidad, San Carlos City, Negros Occidental",
    parishId: 6,
    createdAt: new Date("2026-08-18T13:30:00.000Z"),
  },
  {
    email: "presentation.user08@testimonium.local",
    fullName: "Therese Mendoza",
    contactNumber: "+639171234508",
    address: "Brgy. Bagonbon, San Carlos City, Negros Occidental",
    parishId: 7,
    createdAt: new Date("2026-08-27T16:10:00.000Z"),
  },
  {
    email: "presentation.user09@testimonium.local",
    fullName: "Rafael Aquino",
    contactNumber: "+639171234509",
    address: "Brgy. Ermita, San Carlos City, Negros Occidental",
    parishId: 2,
    createdAt: new Date("2026-09-08T09:30:00.000Z"),
  },
  {
    email: "presentation.user10@testimonium.local",
    fullName: "Beatriz Lim",
    contactNumber: "+639171234510",
    address: "Brgy. Quezon, San Carlos City, Negros Occidental",
    parishId: 3,
    createdAt: new Date("2026-09-09T10:15:00.000Z"),
  },
  {
    email: "presentation.user11@testimonium.local",
    fullName: "Marco Bautista",
    contactNumber: "+639171234511",
    address: "Brgy. Codcod, San Carlos City, Negros Occidental",
    parishId: 6,
    createdAt: new Date("2026-09-11T14:00:00.000Z"),
  },
  {
    email: "presentation.user12@testimonium.local",
    fullName: "Katrina Navarro",
    contactNumber: "+639171234512",
    address: "Brgy. Nataban, San Carlos City, Negros Occidental",
    parishId: 7,
    createdAt: new Date("2026-09-13T11:20:00.000Z"),
  },
];

// Document Requests definition (24 rows)
// Notice date requested pattern:
// Historical (Mar-Jul): 6
// August (1m): 7 (Aug 4, 12[x2], 19, 25[x2], 30)
// Recent 7 days (Sep 8-14): 11 (Sep 8: 1, Sep 9: 3, Sep 10: 0, Sep 11: 2, Sep 12: 1, Sep 13: 3, Sep 14: 1)
const SEED_DOC_REQUESTS = [
  // Older months (6)
  {
    trackingNumber: "PRES-DOC-001",
    userEmail: "presentation.user01@testimonium.local",
    parishId: 2,
    applicantName: "Juan Dela Cruz Jr.",
    relationship: "Self",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "School requirement and enrollment verification",
    status: "COMPLETED",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 2,
    dateRequested: new Date("2026-03-24T08:30:00.000Z"),
    dateProcessed: new Date("2026-03-26T10:15:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-002",
    userEmail: "presentation.user02@testimonium.local",
    parishId: 3,
    applicantName: "Maria Clara Santos",
    relationship: "Self",
    documentType: "CONFIRMATION_CERTIFICATE",
    purpose: "Church wedding prerequisite document",
    status: "COMPLETED",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 3,
    dateRequested: new Date("2026-04-18T09:00:00.000Z"),
    dateProcessed: new Date("2026-04-20T11:30:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-003",
    userEmail: "presentation.user03@testimonium.local",
    parishId: 6,
    applicantName: "Paolo Reyes",
    relationship: "Self",
    documentType: "FIRST_COMMUNION_CERTIFICATE",
    purpose: "Personal records and sacrament verification",
    status: "COMPLETED",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 6,
    dateRequested: new Date("2026-05-22T10:00:00.000Z"),
    dateProcessed: new Date("2026-05-24T14:20:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-004",
    userEmail: "presentation.user04@testimonium.local",
    parishId: 7,
    applicantName: "Angela Cruz",
    relationship: "Daughter",
    documentType: "MARRIAGE_CERTIFICATE",
    purpose: "Legal identification and passport renewal",
    status: "READY_FOR_PICKUP",
    paymentStatus: "CONFIRMED",
    fee: "200.00",
    secretaryParishId: 7,
    dateRequested: new Date("2026-06-15T11:15:00.000Z"),
    dateProcessed: new Date("2026-06-17T13:45:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-005",
    userEmail: "presentation.user05@testimonium.local",
    parishId: 2,
    applicantName: "Miguel Flores",
    relationship: "Self",
    documentType: "PERMIT_TO_MARRY",
    purpose: "Permission for canonical wedding outside parish jurisdiction",
    status: "COMPLETED",
    paymentStatus: "CONFIRMED",
    fee: "250.00",
    secretaryParishId: 2,
    dateRequested: new Date("2026-07-08T13:00:00.000Z"),
    dateProcessed: new Date("2026-07-10T15:00:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-006",
    userEmail: "presentation.user06@testimonium.local",
    parishId: 3,
    applicantName: "Carmela Garcia",
    relationship: "Self",
    documentType: "STATUS_OF_LIBERTY",
    purpose: "Overseas employment and canonical clearance",
    status: "READY_FOR_PICKUP",
    paymentStatus: "CONFIRMED",
    fee: "200.00",
    secretaryParishId: 3,
    dateRequested: new Date("2026-07-25T14:30:00.000Z"),
    dateProcessed: new Date("2026-07-27T16:00:00.000Z"),
  },

  // August 2026 (7)
  {
    trackingNumber: "PRES-DOC-007",
    userEmail: "presentation.user07@testimonium.local",
    parishId: 6,
    applicantName: "Gabriel Ramos",
    relationship: "Self",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "Visa application and overseas employment record",
    status: "PROCESSING",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 6,
    dateRequested: new Date("2026-08-04T08:45:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-008",
    userEmail: "presentation.user08@testimonium.local",
    parishId: 7,
    applicantName: "Therese Mendoza",
    relationship: "Self",
    documentType: "MARRIAGE_BANNS",
    purpose: "Canonical publication of marriage banns in home parish",
    status: "READY_FOR_PICKUP",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 7,
    dateRequested: new Date("2026-08-12T09:30:00.000Z"),
    dateProcessed: new Date("2026-08-14T11:00:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-009",
    userEmail: "presentation.user01@testimonium.local",
    parishId: 2,
    applicantName: "Lourdes Dela Cruz",
    relationship: "Mother",
    documentType: "CONFIRMATION_CERTIFICATE",
    purpose: "Godparent sponsorship requirement",
    status: "COMPLETED",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 2,
    dateRequested: new Date("2026-08-12T14:15:00.000Z"),
    dateProcessed: new Date("2026-08-14T16:20:00.000Z"),
  },
  {
    trackingNumber: "PRES-DOC-010",
    userEmail: "presentation.user02@testimonium.local",
    parishId: 3,
    applicantName: "Mateo Santos",
    relationship: "Son",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "School admission requirement",
    status: "PAYMENT_VERIFIED",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 3,
    dateRequested: new Date("2026-08-19T10:00:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-011",
    userEmail: "presentation.user03@testimonium.local",
    parishId: 6,
    applicantName: "Paolo Reyes",
    relationship: "Self",
    documentType: "MARRIAGE_CERTIFICATE",
    purpose: "Spousal benefit enrollment",
    status: "PAYMENT_VERIFIED",
    paymentStatus: "CONFIRMED",
    fee: "250.00",
    secretaryParishId: 6,
    dateRequested: new Date("2026-08-25T11:30:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-012",
    userEmail: "presentation.user04@testimonium.local",
    parishId: 7,
    applicantName: "Angela Cruz",
    relationship: "Self",
    documentType: "FIRST_COMMUNION_CERTIFICATE",
    purpose: "Parish confirmation documentation",
    status: "PAYMENT_NEEDS_CORRECTION",
    paymentStatus: "PROOF_SUBMITTED",
    paymentCorrectionNote: "Receipt reference number is blurred. Please resubmit clear photo.",
    fee: "150.00",
    secretaryParishId: 7,
    dateRequested: new Date("2026-08-25T15:45:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-013",
    userEmail: "presentation.user05@testimonium.local",
    parishId: 2,
    applicantName: "Rosa Flores",
    relationship: "Aunt",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "Late registry canonical validation",
    status: "REJECTED",
    paymentStatus: "UNPAID",
    remarks: "Parish baptismal records for year 1958 were destroyed during fire.",
    fee: null,
    secretaryParishId: 2,
    dateRequested: new Date("2026-08-30T10:20:00.000Z"),
    dateProcessed: new Date("2026-09-01T14:00:00.000Z"),
  },

  // Recent 7 Days (Sep 8-14, 2026) -> 11 rows
  // Sep 8: 1
  {
    trackingNumber: "PRES-DOC-014",
    userEmail: "presentation.user06@testimonium.local",
    parishId: 3,
    applicantName: "Carmela Garcia",
    relationship: "Self",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "Civil marriage license application",
    status: "PAYMENT_VERIFIED",
    paymentStatus: "CONFIRMED",
    fee: "150.00",
    secretaryParishId: 3,
    dateRequested: new Date("2026-09-08T09:15:00.000Z"),
    dateProcessed: null,
  },

  // Sep 9: 3
  {
    trackingNumber: "PRES-DOC-015",
    userEmail: "presentation.user07@testimonium.local",
    parishId: 6,
    applicantName: "Gabriel Ramos",
    relationship: "Self",
    documentType: "MARRIAGE_CERTIFICATE",
    purpose: "Consular visa sponsorship",
    status: "PROCESSING",
    paymentStatus: "CONFIRMED",
    fee: "300.00",
    secretaryParishId: 6,
    dateRequested: new Date("2026-09-09T08:30:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-016",
    userEmail: "presentation.user08@testimonium.local",
    parishId: 7,
    applicantName: "Therese Mendoza",
    relationship: "Self",
    documentType: "CONFIRMATION_CERTIFICATE",
    purpose: "Nuptial documentation file",
    status: "PAYMENT_UNDER_REVIEW",
    paymentStatus: "PROOF_SUBMITTED",
    fee: "150.00",
    secretaryParishId: 7,
    dateRequested: new Date("2026-09-09T11:00:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-017",
    userEmail: "presentation.user09@testimonium.local",
    parishId: 2,
    applicantName: "Rafael Aquino",
    relationship: "Self",
    documentType: "STATUS_OF_LIBERTY",
    purpose: "Affidavit of civil status clearance",
    status: "UNDER_REVIEW",
    paymentStatus: "UNPAID",
    fee: null,
    secretaryParishId: 2,
    dateRequested: new Date("2026-09-09T14:45:00.000Z"),
    dateProcessed: null,
  },

  // Sep 10: 0 (intentional zero gap)

  // Sep 11: 2
  {
    trackingNumber: "PRES-DOC-018",
    userEmail: "presentation.user10@testimonium.local",
    parishId: 3,
    applicantName: "Beatriz Lim",
    relationship: "Self",
    documentType: "MARRIAGE_BANNS",
    purpose: "Canonical banns coordination",
    status: "NEEDS_CORRECTION",
    paymentStatus: "UNPAID",
    correctionNote: "Please specify complete legal name of fiancé and prospective wedding parish.",
    correctionRequirementIds: ["fiance_id"],
    fee: null,
    secretaryParishId: 3,
    dateRequested: new Date("2026-09-11T09:30:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-019",
    userEmail: "presentation.user11@testimonium.local",
    parishId: 6,
    applicantName: "Marco Bautista",
    relationship: "Self",
    documentType: "PERMIT_TO_MARRY",
    purpose: "Inter-parish marriage endorsement",
    status: "PAYMENT_PENDING",
    paymentStatus: "UNPAID",
    fee: "200.00",
    secretaryParishId: 6,
    dateRequested: new Date("2026-09-11T13:15:00.000Z"),
    dateProcessed: null,
  },

  // Sep 12: 1
  {
    trackingNumber: "PRES-DOC-020",
    userEmail: "presentation.user12@testimonium.local",
    parishId: 7,
    applicantName: "Katrina Navarro",
    relationship: "Self",
    documentType: "FIRST_COMMUNION_CERTIFICATE",
    purpose: "Sacramental book records completion",
    status: "PAYMENT_UNDER_REVIEW",
    paymentStatus: "PROOF_SUBMITTED",
    fee: "150.00",
    secretaryParishId: 7,
    dateRequested: new Date("2026-09-12T10:00:00.000Z"),
    dateProcessed: null,
  },

  // Sep 13: 3
  {
    trackingNumber: "PRES-DOC-021",
    userEmail: "presentation.user01@testimonium.local",
    parishId: 2,
    applicantName: "Juan Dela Cruz",
    relationship: "Self",
    documentType: "CONFIRMATION_CERTIFICATE",
    purpose: "Godfather eligibility certification",
    status: "UNDER_REVIEW",
    paymentStatus: "UNPAID",
    fee: null,
    secretaryParishId: 2,
    dateRequested: new Date("2026-09-13T08:30:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-022",
    userEmail: "presentation.user02@testimonium.local",
    parishId: 3,
    applicantName: "Maria Clara Santos",
    relationship: "Self",
    documentType: "MARRIAGE_CERTIFICATE",
    purpose: "Social security beneficiary claim",
    status: "PAYMENT_PENDING",
    paymentStatus: "UNPAID",
    fee: "200.00",
    secretaryParishId: 3,
    dateRequested: new Date("2026-09-13T11:45:00.000Z"),
    dateProcessed: null,
  },
  {
    trackingNumber: "PRES-DOC-023",
    userEmail: "presentation.user03@testimonium.local",
    parishId: 6,
    applicantName: "Paolo Reyes",
    relationship: "Self",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "Driver license primary document",
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    remarks: "Applicant cancelled after discovering existing physical copy at home.",
    fee: null,
    secretaryParishId: 6,
    dateRequested: new Date("2026-09-13T15:10:00.000Z"),
    dateProcessed: null,
  },

  // Sep 14: 1
  {
    trackingNumber: "PRES-DOC-024",
    userEmail: "presentation.user04@testimonium.local",
    parishId: 7,
    applicantName: "Angela Cruz",
    relationship: "Self",
    documentType: "BAPTISMAL_CERTIFICATE",
    purpose: "Passport biometric appointment prerequisite",
    status: "PENDING",
    paymentStatus: "UNPAID",
    fee: null,
    secretaryParishId: null,
    dateRequested: new Date("2026-09-14T08:00:00.000Z"),
    dateProcessed: null,
  },
];

// Payment Transactions definition (11 rows)
const SEED_PAYMENTS = [
  {
    referenceNumber: "PRES-PAY-001",
    docTrackingNumber: "PRES-DOC-003",
    amount: "150.00",
    provider: "GCash",
    status: "VERIFIED",
    secretaryParishId: 6,
    createdAt: new Date("2026-05-23T09:00:00.000Z"),
    verifiedAt: new Date("2026-05-23T11:00:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-002",
    docTrackingNumber: "PRES-DOC-006",
    amount: "200.00",
    provider: "Maya",
    status: "VERIFIED",
    secretaryParishId: 3,
    createdAt: new Date("2026-07-26T10:30:00.000Z"),
    verifiedAt: new Date("2026-07-26T13:30:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-003",
    docTrackingNumber: "PRES-DOC-008",
    amount: "150.00",
    provider: "GCash",
    status: "VERIFIED",
    secretaryParishId: 7,
    createdAt: new Date("2026-08-13T08:45:00.000Z"),
    verifiedAt: new Date("2026-08-13T10:15:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-004",
    docTrackingNumber: "PRES-DOC-011",
    amount: "250.00",
    provider: "GCash",
    status: "VERIFIED",
    secretaryParishId: 6,
    createdAt: new Date("2026-08-26T14:00:00.000Z"),
    verifiedAt: new Date("2026-08-26T16:30:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-005",
    docTrackingNumber: "PRES-DOC-012",
    amount: "150.00",
    provider: "GCash",
    status: "REJECTED",
    secretaryParishId: 7,
    createdAt: new Date("2026-08-27T11:20:00.000Z"),
    verifiedAt: new Date("2026-08-27T14:00:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-006",
    docTrackingNumber: "PRES-DOC-014",
    amount: "150.00",
    provider: "GCash",
    status: "VERIFIED",
    secretaryParishId: 3,
    createdAt: new Date("2026-09-08T15:00:00.000Z"),
    verifiedAt: new Date("2026-09-08T16:30:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-007",
    docTrackingNumber: "PRES-DOC-015",
    amount: "300.00",
    provider: "Maya",
    status: "VERIFIED",
    secretaryParishId: 6,
    createdAt: new Date("2026-09-09T11:00:00.000Z"),
    verifiedAt: new Date("2026-09-09T13:00:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-008",
    docTrackingNumber: "PRES-DOC-016",
    amount: "150.00",
    provider: "GCash",
    status: "VERIFIED",
    secretaryParishId: 7,
    createdAt: new Date("2026-09-09T14:30:00.000Z"),
    verifiedAt: new Date("2026-09-09T15:45:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-009",
    docTrackingNumber: "PRES-DOC-019",
    amount: "200.00",
    provider: "GCash",
    status: "PENDING",
    secretaryParishId: null,
    createdAt: new Date("2026-09-11T16:00:00.000Z"),
    verifiedAt: null,
  },
  {
    referenceNumber: "PRES-PAY-010",
    docTrackingNumber: "PRES-DOC-020",
    amount: "150.00",
    provider: "Maya",
    status: "VERIFIED",
    secretaryParishId: 2,
    createdAt: new Date("2026-09-12T10:00:00.000Z"),
    verifiedAt: new Date("2026-09-12T11:30:00.000Z"),
  },
  {
    referenceNumber: "PRES-PAY-011",
    docTrackingNumber: "PRES-DOC-022",
    amount: "200.00",
    provider: "GCash",
    status: "PENDING",
    secretaryParishId: null,
    createdAt: new Date("2026-09-13T13:00:00.000Z"),
    verifiedAt: null,
  },
];

// Schedule Requests definition (17 rows)
// Dates cover different submission dates (createdAt) and distinct requestedDates across multiple weekdays
const SEED_SCHEDULES = [
  // Older months (4)
  {
    userEmail: "presentation.user01@testimonium.local",
    parishId: 2,
    eventType: "BAPTISM",
    displayTitle: "Baptism of Mateo Santos",
    requestedDate: new Date(Date.UTC(2026, 3, 12)), // 2026-04-12 (Sunday)
    startDatetime: new Date("2026-04-12T02:00:00.000Z"), // 10:00 AM Manila
    endDatetime: new Date("2026-04-12T03:00:00.000Z"),
    location: "St. Joseph Baptistery",
    status: "COMPLETED",
    assignPriestParishId: 2,
    secretaryParishId: 2,
    createdAt: new Date("2026-03-28T09:00:00.000Z"),
  },
  {
    userEmail: "presentation.user02@testimonium.local",
    parishId: 3,
    eventType: "WEDDING",
    displayTitle: "Wedding of Reyes & Santos",
    requestedDate: new Date(Date.UTC(2026, 4, 23)), // 2026-05-23 (Saturday)
    startDatetime: new Date("2026-05-23T06:00:00.000Z"), // 02:00 PM Manila
    endDatetime: new Date("2026-05-23T07:30:00.000Z"),
    location: "Miraculous Medal Main Altar",
    status: "COMPLETED",
    assignPriestParishId: 3,
    secretaryParishId: 3,
    createdAt: new Date("2026-05-10T10:00:00.000Z"),
  },
  {
    userEmail: "presentation.user03@testimonium.local",
    parishId: 6,
    eventType: "CONFIRMATION",
    displayTitle: "Confirmation for Angela Cruz",
    requestedDate: new Date(Date.UTC(2026, 6, 4)), // 2026-07-04 (Saturday)
    startDatetime: new Date("2026-07-04T01:00:00.000Z"), // 09:00 AM Manila
    endDatetime: new Date("2026-07-04T02:30:00.000Z"),
    location: "Holy Child Parish Sanctuary",
    status: "COMPLETED",
    assignPriestParishId: 6,
    secretaryParishId: 6,
    createdAt: new Date("2026-06-18T11:00:00.000Z"),
  },
  {
    userEmail: "presentation.user04@testimonium.local",
    parishId: 7,
    eventType: "MASS_INTENTION",
    displayTitle: "Thanksgiving Mass Intention for Flores Family",
    requestedDate: new Date(Date.UTC(2026, 7, 2)), // 2026-08-02 (Sunday)
    startDatetime: new Date("2026-08-02T00:00:00.000Z"), // 08:00 AM Manila
    endDatetime: new Date("2026-08-02T01:00:00.000Z"),
    location: "Guadalupe Parish Sanctuary",
    status: "COMPLETED",
    assignPriestParishId: 7,
    secretaryParishId: 7,
    createdAt: new Date("2026-07-15T14:00:00.000Z"),
  },

  // August 2026 (5)
  {
    userEmail: "presentation.user05@testimonium.local",
    parishId: 2,
    eventType: "BLESSING",
    displayTitle: "House Blessing for Dela Cruz Residence",
    requestedDate: new Date(Date.UTC(2026, 7, 20)), // 2026-08-20 (Thursday)
    startDatetime: new Date("2026-08-20T06:00:00.000Z"), // 02:00 PM Manila
    endDatetime: new Date("2026-08-20T07:00:00.000Z"),
    location: "Brgy. Poblacion, San Carlos City",
    status: "COMPLETED",
    assignPriestParishId: 2,
    secretaryParishId: 2,
    createdAt: new Date("2026-08-06T09:30:00.000Z"),
  },
  {
    userEmail: "presentation.user06@testimonium.local",
    parishId: 3,
    eventType: "FUNERAL",
    displayTitle: "Funeral Mass for Late Pedro Garcia",
    requestedDate: new Date(Date.UTC(2026, 7, 28)), // 2026-08-28 (Friday)
    startDatetime: new Date("2026-08-28T01:30:00.000Z"), // 09:30 AM Manila
    endDatetime: new Date("2026-08-28T03:00:00.000Z"),
    location: "Miraculous Medal Parish Church",
    status: "COMPLETED",
    assignPriestParishId: 3,
    secretaryParishId: 3,
    createdAt: new Date("2026-08-15T13:00:00.000Z"),
  },
  {
    userEmail: "presentation.user07@testimonium.local",
    parishId: 6,
    eventType: "PRIVATE_MASS",
    displayTitle: "Private Mass Request for Ramos Clan Reunion",
    requestedDate: new Date(Date.UTC(2026, 8, 5)), // 2026-09-05 (Saturday)
    startDatetime: new Date("2026-09-05T02:00:00.000Z"), // 10:00 AM Manila
    endDatetime: new Date("2026-09-05T03:00:00.000Z"),
    location: "Holy Child Chapel",
    status: "REJECTED",
    remarks: "Parish schedule already full due to vicariate youth conference.",
    assignPriestParishId: null,
    secretaryParishId: 6,
    createdAt: new Date("2026-08-22T10:30:00.000Z"),
  },
  {
    userEmail: "presentation.user08@testimonium.local",
    parishId: 7,
    eventType: "THANKSGIVING",
    displayTitle: "Thanksgiving Mass for Mendoza Family",
    requestedDate: new Date(Date.UTC(2026, 8, 12)), // 2026-09-12 (Saturday)
    startDatetime: new Date("2026-09-12T01:00:00.000Z"), // 09:00 AM Manila
    endDatetime: new Date("2026-09-12T02:00:00.000Z"),
    location: "Guadalupe Parish Sanctuary",
    status: "CONFIRMED",
    assignPriestParishId: 7,
    secretaryParishId: 7,
    createdAt: new Date("2026-08-26T15:00:00.000Z"),
  },
  {
    userEmail: "presentation.user01@testimonium.local",
    parishId: 2,
    eventType: "WEDDING",
    displayTitle: "Wedding of Santos & Lim",
    requestedDate: new Date(Date.UTC(2026, 8, 18)), // 2026-09-18 (Friday)
    startDatetime: new Date("2026-09-18T06:00:00.000Z"), // 02:00 PM Manila
    endDatetime: new Date("2026-09-18T07:30:00.000Z"),
    proposedDate: new Date(Date.UTC(2026, 8, 25)), // 2026-09-25
    proposedStartDatetime: new Date("2026-09-25T06:00:00.000Z"),
    proposedEndDatetime: new Date("2026-09-25T07:30:00.000Z"),
    rescheduleReason: "Main sanctuary roof restoration in progress on September 18.",
    location: "St. Joseph Main Altar",
    status: "PROPOSED_RESCHEDULE",
    assignPriestParishId: 2,
    secretaryParishId: 2,
    createdAt: new Date("2026-08-30T16:00:00.000Z"),
  },

  // Recent 7 Days (Sep 8-14, 2026 submission dates) -> 8 rows
  // Sep 8: 1
  {
    userEmail: "presentation.user09@testimonium.local",
    parishId: 2,
    eventType: "BAPTISM",
    displayTitle: "Baptism for Baby Sofia Aquino",
    requestedDate: new Date(Date.UTC(2026, 8, 22)), // 2026-09-22 (Tuesday)
    startDatetime: new Date("2026-09-22T02:00:00.000Z"), // 10:00 AM Manila
    endDatetime: new Date("2026-09-22T03:00:00.000Z"),
    location: "St. Joseph Baptistery",
    status: "REQUESTED",
    assignPriestParishId: null,
    secretaryParishId: null,
    createdAt: new Date("2026-09-08T09:00:00.000Z"),
  },

  // Sep 9: 2
  {
    userEmail: "presentation.user10@testimonium.local",
    parishId: 3,
    eventType: "WEDDING",
    displayTitle: "Nuptial Mass for Lim & Bautista",
    requestedDate: new Date(Date.UTC(2026, 9, 10)), // 2026-10-10 (Saturday)
    startDatetime: new Date("2026-10-10T06:00:00.000Z"), // 02:00 PM Manila
    endDatetime: new Date("2026-10-10T07:30:00.000Z"),
    location: "Miraculous Medal Main Altar",
    status: "CONFIRMED",
    assignPriestParishId: 3,
    secretaryParishId: 3,
    createdAt: new Date("2026-09-09T10:30:00.000Z"),
  },
  {
    userEmail: "presentation.user11@testimonium.local",
    parishId: 6,
    eventType: "CONFESSION",
    displayTitle: "Individual Confession Appointment for Marco Bautista",
    requestedDate: new Date(Date.UTC(2026, 8, 19)), // 2026-09-19 (Saturday)
    startDatetime: new Date("2026-09-19T07:00:00.000Z"), // 03:00 PM Manila
    endDatetime: new Date("2026-09-19T07:30:00.000Z"),
    location: "Holy Child Confessional Room",
    status: "REQUESTED",
    assignPriestParishId: 6,
    secretaryParishId: null,
    createdAt: new Date("2026-09-09T14:15:00.000Z"),
  },

  // Sep 10: 0 (gap)

  // Sep 11: 2
  {
    userEmail: "presentation.user12@testimonium.local",
    parishId: 7,
    eventType: "BLESSING",
    displayTitle: "Vehicle and Office Blessing for Navarro Logistics",
    requestedDate: new Date(Date.UTC(2026, 9, 3)), // 2026-10-03 (Saturday)
    startDatetime: new Date("2026-10-03T01:30:00.000Z"), // 09:30 AM Manila
    endDatetime: new Date("2026-10-03T02:30:00.000Z"),
    location: "Brgy. Nataban Commercial Center",
    status: "CONFIRMED",
    assignPriestParishId: 7,
    secretaryParishId: 7,
    createdAt: new Date("2026-09-11T11:00:00.000Z"),
  },
  {
    userEmail: "presentation.user02@testimonium.local",
    parishId: 3,
    eventType: "PRIVATE_MASS",
    displayTitle: "Family Thanksgiving Private Mass",
    requestedDate: new Date(Date.UTC(2026, 9, 4)), // 2026-10-04 (Sunday)
    startDatetime: new Date("2026-10-04T08:00:00.000Z"), // 04:00 PM Manila
    endDatetime: new Date("2026-10-04T09:00:00.000Z"),
    location: "Miraculous Medal Adoration Chapel",
    status: "PENDING",
    assignPriestParishId: null,
    secretaryParishId: null,
    createdAt: new Date("2026-09-11T15:30:00.000Z"),
  },

  // Sep 12: 1
  {
    userEmail: "presentation.user03@testimonium.local",
    parishId: 6,
    eventType: "THANKSGIVING",
    displayTitle: "Thanksgiving for Board Exam Passers",
    requestedDate: new Date(Date.UTC(2026, 9, 17)), // 2026-10-17 (Saturday)
    startDatetime: new Date("2026-10-17T02:00:00.000Z"), // 10:00 AM Manila
    endDatetime: new Date("2026-10-17T03:00:00.000Z"),
    location: "Holy Child Parish Main Church",
    status: "REQUESTED",
    assignPriestParishId: null,
    secretaryParishId: null,
    createdAt: new Date("2026-09-12T09:45:00.000Z"),
  },

  // Sep 13: 1
  {
    userEmail: "presentation.user04@testimonium.local",
    parishId: 7,
    eventType: "BAPTISM",
    displayTitle: "Baptism for Baby Joaquin Cruz",
    requestedDate: new Date(Date.UTC(2026, 9, 18)), // 2026-10-18 (Sunday)
    startDatetime: new Date("2026-10-18T03:00:00.000Z"), // 11:00 AM Manila
    endDatetime: new Date("2026-10-18T04:00:00.000Z"),
    location: "Guadalupe Parish Baptistery",
    status: "CONFIRMED",
    assignPriestParishId: 7,
    secretaryParishId: 7,
    createdAt: new Date("2026-09-13T10:00:00.000Z"),
  },

  // Sep 14: 1
  {
    userEmail: "presentation.user05@testimonium.local",
    parishId: 2,
    eventType: "MASS_INTENTION",
    displayTitle: "Mass Intention for Speedy Recovery of Maria Flores",
    requestedDate: new Date(Date.UTC(2026, 9, 24)), // 2026-10-24 (Saturday)
    startDatetime: new Date("2026-10-24T00:30:00.000Z"), // 08:30 AM Manila
    endDatetime: new Date("2026-10-24T01:30:00.000Z"),
    location: "St. Joseph Parish Main Altar",
    status: "REQUESTED",
    assignPriestParishId: null,
    secretaryParishId: null,
    createdAt: new Date("2026-09-14T08:30:00.000Z"),
  },
];

// Parish Events definition (9 rows)
const SEED_PARISH_EVENTS = [
  {
    parishId: 2,
    title: "Easter Vigil Mass and Parish Agapé",
    eventType: "OTHER",
    description: "Solemn celebration of the Resurrection of the Lord followed by a community agapé meal in the parish hall.",
    location: "St. Joseph Parish Main Sanctuary",
    eventDate: new Date(Date.UTC(2026, 3, 5)), // 2026-04-05
    startTime: "08:00 PM",
    endTime: "11:00 PM",
    visibility: "PUBLIC",
    assignPriestParishId: 2,
    creatorSecretaryParishId: 2,
    createdAt: new Date("2026-03-22T08:00:00.000Z"),
  },
  {
    parishId: 3,
    title: "Parish Pastoral Council Strategic Planning",
    eventType: "OTHER",
    description: "Quarterly review of parish pastoral initiatives, liturgy coordination, and family life ministry programs.",
    location: "Parish Pastoral Center Room 2",
    eventDate: new Date(Date.UTC(2026, 4, 15)), // 2026-05-15
    startTime: "01:30 PM",
    endTime: "05:00 PM",
    visibility: "PARISH_PRIVATE",
    assignPriestParishId: 3,
    creatorSecretaryParishId: 3,
    createdAt: new Date("2026-05-02T09:00:00.000Z"),
  },
  {
    parishId: 6,
    title: "Feast of Our Lady of Mount Carmel Novena Mass",
    eventType: "OTHER",
    description: "Nine-day novena mass and spiritual preparation for the titular feast of Our Lady of Mount Carmel.",
    location: "Holy Child Main Church",
    eventDate: new Date(Date.UTC(2026, 6, 16)), // 2026-07-16
    startTime: "05:30 PM",
    endTime: "07:00 PM",
    visibility: "PUBLIC",
    assignPriestParishId: 6,
    creatorSecretaryParishId: 6,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
  },
  {
    parishId: 7,
    title: "Solemnity of the Assumption of Mary Fiesta Mass",
    eventType: "OTHER",
    description: "Pontifical concelebrated mass and Marian floral offering by the parish youth ministry.",
    location: "Guadalupe Parish Sanctuary",
    eventDate: new Date(Date.UTC(2026, 7, 15)), // 2026-08-15
    startTime: "09:00 AM",
    endTime: "11:00 AM",
    visibility: "PUBLIC",
    assignPriestParishId: 7,
    creatorSecretaryParishId: 7,
    createdAt: new Date("2026-08-01T08:30:00.000Z"),
  },
  {
    parishId: 2,
    title: "Parish Catechists and Lay Ministers Formation",
    eventType: "OTHER",
    description: "Theological and pastoral formation workshop for sacramental catechists and Extraordinary Ministers of Holy Communion.",
    location: "St. Joseph Function Hall",
    eventDate: new Date(Date.UTC(2026, 7, 28)), // 2026-08-28
    startTime: "08:30 AM",
    endTime: "12:00 PM",
    visibility: "PARISH_PRIVATE",
    assignPriestParishId: 2,
    creatorSecretaryParishId: 2,
    createdAt: new Date("2026-08-14T09:00:00.000Z"),
  },
  {
    parishId: 3,
    title: "Nativity of the Blessed Virgin Mary Community Mass",
    eventType: "OTHER",
    description: "Feast day evening solemn mass and blessing of birthday celebrants with distribution of Marian medals.",
    location: "Miraculous Medal Parish Shrine",
    eventDate: new Date(Date.UTC(2026, 8, 8)), // 2026-09-08
    startTime: "06:00 PM",
    endTime: "07:30 PM",
    visibility: "PUBLIC",
    assignPriestParishId: 3,
    creatorSecretaryParishId: 3,
    createdAt: new Date("2026-08-25T11:00:00.000Z"),
  },
  {
    parishId: 6,
    title: "Diocesan Youth Ministry Fellowship and Praise Night",
    eventType: "OTHER",
    description: "Evening praise and worship gathering for vicariate youth delegates featuring testimonies and Eucharistic adoration.",
    location: "Holy Child Parish Gymnasium",
    eventDate: new Date(Date.UTC(2026, 8, 12)), // 2026-09-12
    startTime: "06:00 PM",
    endTime: "09:00 PM",
    visibility: "PUBLIC",
    assignPriestParishId: 6,
    creatorSecretaryParishId: 6,
    createdAt: new Date("2026-08-30T14:00:00.000Z"),
  },
  {
    parishId: 7,
    title: "Feast of the Exaltation of the Holy Cross Mass",
    eventType: "OTHER",
    description: "Feast day liturgical celebration and veneration of the relic of the True Cross.",
    location: "Guadalupe Parish Sanctuary",
    eventDate: new Date(Date.UTC(2026, 8, 14)), // 2026-09-14
    startTime: "05:30 PM",
    endTime: "07:00 PM",
    visibility: "PUBLIC",
    assignPriestParishId: 7,
    creatorSecretaryParishId: 7,
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
  },
  {
    parishId: 2,
    title: "Feast of the Archangels Annual Parish Fiesta",
    eventType: "OTHER",
    description: "Annual parochial celebration in honor of Sts. Michael, Gabriel, and Raphael Archangels.",
    location: "St. Joseph Parish Main Altar",
    eventDate: new Date(Date.UTC(2026, 8, 29)), // 2026-09-29
    startTime: "09:00 AM",
    endTime: "11:30 AM",
    visibility: "PUBLIC",
    assignPriestParishId: 2,
    creatorSecretaryParishId: 2,
    createdAt: new Date("2026-09-05T10:00:00.000Z"),
  },
];

// Daily Reports definition (9 rows)
const SEED_DAILY_REPORTS = [
  {
    reportDate: new Date(Date.UTC(2026, 2, 25)), // 2026-03-25
    scope: "DIOCESE",
    parishId: null,
    title: "Diocesan Curia Pastoral Planning Assembly",
    category: "MEETING",
    description: "Monthly coordination meeting of diocesan commissions on liturgy, catechesis, and social action.",
    useCoordinatorCreator: true,
    createdAt: new Date("2026-03-25T10:00:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 3, 20)), // 2026-04-20
    scope: "PARISH",
    parishId: 2,
    title: "St. Joseph Parish Finance Council Q1 Review",
    category: "MEETING",
    description: "Quarterly review of parish collections, facility maintenance expenditures, and documentation fees.",
    creatorSecretaryParishId: 2,
    createdAt: new Date("2026-04-20T11:30:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 4, 30)), // 2026-05-30
    scope: "PARISH",
    parishId: 3,
    title: "Flores de Mayo Children's Catechetical Culmination",
    category: "ACTIVITY",
    description: "Successful completion of the month-long daily catechism and flower offering for 180 parish youth.",
    creatorSecretaryParishId: 3,
    createdAt: new Date("2026-05-30T16:00:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 5, 25)), // 2026-06-25
    scope: "DIOCESE",
    parishId: null,
    title: "Mid-Year Diocesan Sacramental Registry Audit",
    category: "IMPORTANT_EVENT",
    description: "Diocese-wide audit of canonical registries and verification of physical log integrity across vicariates.",
    useCoordinatorCreator: true,
    createdAt: new Date("2026-06-25T14:30:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 6, 28)), // 2026-07-28
    scope: "PARISH",
    parishId: 6,
    title: "Parish Disaster Preparedness Seminar with LGU",
    category: "OTHER",
    description: "Joint contingency briefing conducted with city disaster management for church evacuation readiness.",
    creatorSecretaryParishId: 6,
    createdAt: new Date("2026-07-28T13:00:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 7, 20)), // 2026-08-20
    scope: "PARISH",
    parishId: 7,
    title: "Guadalupe Parish Pastoral Council Assembly",
    category: "MEETING",
    description: "Evaluation of pastoral programs and preparation for incoming fiesta celebrations.",
    creatorSecretaryParishId: 7,
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 8, 8)), // 2026-09-08
    scope: "PARISH",
    parishId: 2,
    title: "Marian Solemnity Liturgical and Security Operations",
    category: "ACTIVITY",
    description: "Logistical and security debrief following the high-attendance Marian solemnity dawn procession.",
    creatorSecretaryParishId: 2,
    createdAt: new Date("2026-09-08T11:00:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 8, 11)), // 2026-09-11
    scope: "DIOCESE",
    parishId: null,
    title: "Diocesan Secretariat Systems Modernization Briefing",
    category: "MEETING",
    description: "Briefing on Testimonium portal rollout progress and sacramental certificate digital workflow adoption.",
    useCoordinatorCreator: true,
    createdAt: new Date("2026-09-11T16:30:00.000Z"),
  },
  {
    reportDate: new Date(Date.UTC(2026, 8, 14)), // 2026-09-14
    scope: "PARISH",
    parishId: 3,
    title: "Weekly Sacramental Operations and Document Release Summary",
    category: "MEETING",
    description: "Weekly assessment of pending document verifications, schedule clearances, and pickup dispatches.",
    creatorSecretaryParishId: 3,
    createdAt: new Date("2026-09-14T09:30:00.000Z"),
  },
];

// ---------------------------------------------------------
// Main Seed Execution
// ---------------------------------------------------------

async function main() {
  console.log("==================================================");
  console.log("TESTIMONIUM — PRESENTATION DATA SEEDING");
  console.log("==================================================");

  // 1. Safe Preflight
  const dbUrlStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrlStr) {
    throw new Error("Missing DATABASE_URL configuration.");
  }
  const url = new URL(dbUrlStr);
  console.log("Safe DB Host:", url.host);
  console.log("Safe DB Name:", url.pathname.replace(/^\//, ""));

  const [
    activeParishes,
    roles,
    existingUsers,
    currentDocsCount,
    currentSchedulesCount,
    currentEventsCount,
    currentReportsCount,
    currentPaymentsCount,
  ] = await Promise.all([
    prisma.parish.findMany({ where: { isActive: true }, select: { id: true, parishName: true } }),
    prisma.role.findMany({ select: { id: true, roleName: true } }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        roleId: true,
        parishId: true,
        role: { select: { roleName: true } },
      },
    }),
    prisma.documentRequest.count(),
    prisma.schedule.count(),
    prisma.parishEvent.count(),
    prisma.dailyReport.count(),
    prisma.paymentTransaction.count(),
  ]);

  console.log(`Active Parishes: ${activeParishes.length}`);
  console.log(`Current Users: ${existingUsers.length}`);
  console.log(`Current Document Requests: ${currentDocsCount}`);
  console.log(`Current Schedules: ${currentSchedulesCount}`);
  console.log(`Current Parish Events: ${currentEventsCount}`);
  console.log(`Current Daily Reports: ${currentReportsCount}`);
  console.log(`Current Payment Transactions: ${currentPaymentsCount}`);

  // Parishioner role
  const parishionerRole = roles.find((r) => r.roleName === "PARISHIONER");
  if (!parishionerRole) {
    throw new Error("PARISHIONER role not found in database.");
  }

  // Lookup existing staff
  const coordinatorUser = existingUsers.find((u) => u.role?.roleName === "DIOCESE_COORDINATOR");
  if (!coordinatorUser) {
    throw new Error("DIOCESE_COORDINATOR user not found for diocese-scoped reports.");
  }

  const secretaryByParish = new Map();
  const priestByParish = new Map();
  for (const u of existingUsers) {
    if (u.role?.roleName === "SECRETARY" && u.parishId) {
      secretaryByParish.set(u.parishId, u.id);
    }
    if (u.role?.roleName === "PRIEST" && u.parishId) {
      if (!priestByParish.has(u.parishId)) {
        priestByParish.set(u.parishId, u.id);
      }
    }
  }

  const activeParishIds = new Set(activeParishes.map((p) => p.id));
  for (const pid of [2, 3, 6, 7]) {
    if (!activeParishIds.has(pid)) {
      throw new Error(`Target parish ID ${pid} is not an active parish.`);
    }
    if (!secretaryByParish.has(pid)) {
      throw new Error(`Target parish ID ${pid} does not have an existing Secretary user.`);
    }
  }

  // Capture baseline excluded table counts immediately before writes
  const excludedBefore = await getExcludedCounts();
  console.log("\nExcluded Tables Pre-Seed Baseline:");
  for (const [table, cnt] of Object.entries(excludedBefore)) {
    console.log(`- ${table}: ${cnt}`);
  }

  console.log("\nProposed Seed Counts:");
  console.log(`- Presentation Users: ${SEED_USERS.length}`);
  console.log(`- Document Requests: ${SEED_DOC_REQUESTS.length}`);
  console.log(`- Payment Transactions: ${SEED_PAYMENTS.length}`);
  console.log(`- Schedules: ${SEED_SCHEDULES.length}`);
  console.log(`- Parish Events: ${SEED_PARISH_EVENTS.length}`);
  console.log(`- Daily Reports: ${SEED_DAILY_REPORTS.length}`);

  const manifest = loadManifest();

  // -------------------------------------------------------
  // Step 1: Seed Presentation Users
  // -------------------------------------------------------
  console.log("\n[1/6] Seeding Presentation Users...");
  const userMap = new Map(); // email -> userId

  for (const item of SEED_USERS) {
    let user = await prisma.user.findUnique({
      where: { email: item.email },
    });

    if (user) {
      // Safety check: collision check on existing row
      if (user.roleId !== parishionerRole.id) {
        throw new Error(`Collision! User ${item.email} already exists but is not a PARISHIONER.`);
      }
      userMap.set(item.email, user.id);
      if (!manifest.parishionerUserIds.includes(user.id)) {
        manifest.parishionerUserIds.push(user.id);
        saveManifest(manifest);
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: item.email,
          fullName: item.fullName,
          contactNumber: item.contactNumber,
          address: item.address,
          roleId: parishionerRole.id,
          parishId: item.parishId,
          isVerified: true,
          status: "ACTIVE",
          termsAcceptedAt: item.createdAt,
          privacyAcceptedAt: item.createdAt,
          termsVersion: "1.0",
          privacyVersion: "1.0",
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
      userMap.set(item.email, user.id);
      manifest.parishionerUserIds.push(user.id);
      saveManifest(manifest);
    }
  }
  console.log(`  Users ready: ${manifest.parishionerUserIds.length}`);

  // -------------------------------------------------------
  // Step 2: Seed Document Requests
  // -------------------------------------------------------
  console.log("\n[2/6] Seeding Document Requests...");
  const docMap = new Map(); // trackingNumber -> requestId

  for (const item of SEED_DOC_REQUESTS) {
    const userId = userMap.get(item.userEmail);
    if (!userId) {
      throw new Error(`User not found for doc request ${item.trackingNumber}`);
    }

    const processedById = item.secretaryParishId ? secretaryByParish.get(item.secretaryParishId) || null : null;

    let doc = await prisma.documentRequest.findUnique({
      where: { trackingNumber: item.trackingNumber },
    });

    if (doc) {
      // Collision check
      if (!manifest.parishionerUserIds.includes(doc.userId)) {
        throw new Error(`Collision! Doc ${item.trackingNumber} exists but does not belong to a presentation user.`);
      }
      docMap.set(item.trackingNumber, doc.id);
      if (!manifest.documentRequestIds.includes(doc.id)) {
        manifest.documentRequestIds.push(doc.id);
        saveManifest(manifest);
      }
    } else {
      doc = await prisma.documentRequest.create({
        data: {
          userId,
          parishId: item.parishId,
          trackingNumber: item.trackingNumber,
          applicantName: item.applicantName,
          relationship: item.relationship,
          isDraft: false,
          documentType: item.documentType,
          purpose: item.purpose,
          status: item.status,
          paymentStatus: item.paymentStatus,
          fee: item.fee,
          processedById,
          remarks: item.remarks || null,
          correctionNote: item.correctionNote || null,
          paymentCorrectionNote: item.paymentCorrectionNote || null,
          correctionRequirementIds: item.correctionRequirementIds || [],
          dateRequested: item.dateRequested,
          dateProcessed: item.dateProcessed,
          createdAt: item.dateRequested,
          updatedAt: item.dateProcessed || item.dateRequested,
        },
      });
      docMap.set(item.trackingNumber, doc.id);
      manifest.documentRequestIds.push(doc.id);
      saveManifest(manifest);
    }
  }
  console.log(`  Document Requests ready: ${manifest.documentRequestIds.length}`);

  // -------------------------------------------------------
  // Step 3: Seed Payment Transactions
  // -------------------------------------------------------
  console.log("\n[3/6] Seeding Payment Transactions...");

  for (const item of SEED_PAYMENTS) {
    const requestId = docMap.get(item.docTrackingNumber);
    if (!requestId) {
      throw new Error(`Request not found for payment ${item.referenceNumber}`);
    }

    const verifiedById = item.secretaryParishId ? secretaryByParish.get(item.secretaryParishId) || null : null;

    let payment = await prisma.paymentTransaction.findFirst({
      where: { referenceNumber: item.referenceNumber },
    });

    if (payment) {
      // Collision check
      if (!manifest.documentRequestIds.includes(payment.requestId)) {
        throw new Error(`Collision! Payment ${item.referenceNumber} exists but is linked to non-presentation request.`);
      }
      if (!manifest.paymentTransactionIds.includes(payment.id)) {
        manifest.paymentTransactionIds.push(payment.id);
        saveManifest(manifest);
      }
    } else {
      payment = await prisma.paymentTransaction.create({
        data: {
          requestId,
          amount: item.amount,
          provider: item.provider,
          referenceNumber: item.referenceNumber,
          status: item.status,
          verifiedById: item.status === "VERIFIED" || item.status === "REJECTED" ? verifiedById : null,
          verifiedAt: item.verifiedAt,
          createdAt: item.createdAt,
        },
      });
      manifest.paymentTransactionIds.push(payment.id);
      saveManifest(manifest);
    }
  }
  console.log(`  Payment Transactions ready: ${manifest.paymentTransactionIds.length}`);

  // -------------------------------------------------------
  // Step 4: Seed Schedules
  // -------------------------------------------------------
  console.log("\n[4/6] Seeding Schedules...");

  for (const item of SEED_SCHEDULES) {
    const userId = userMap.get(item.userEmail);
    if (!userId) {
      throw new Error(`User not found for schedule ${item.displayTitle}`);
    }

    const assignedPriestId = item.assignPriestParishId ? priestByParish.get(item.assignPriestParishId) || null : null;
    const processedById = item.secretaryParishId ? secretaryByParish.get(item.secretaryParishId) || null : null;

    // Crash-safe deterministic lookup
    let schedule = await prisma.schedule.findFirst({
      where: {
        userId,
        parishId: item.parishId,
        requestedDate: item.requestedDate,
        eventType: item.eventType,
        displayTitle: item.displayTitle,
      },
    });

    if (schedule) {
      if (!manifest.scheduleIds.includes(schedule.id)) {
        manifest.scheduleIds.push(schedule.id);
        saveManifest(manifest);
      }
    } else {
      schedule = await prisma.schedule.create({
        data: {
          userId,
          parishId: item.parishId,
          assignedPriestId,
          requestedPriestId: assignedPriestId,
          eventType: item.eventType,
          requestedDate: item.requestedDate,
          startDatetime: item.startDatetime,
          endDatetime: item.endDatetime,
          location: item.location,
          proposedDate: item.proposedDate || null,
          proposedStartDatetime: item.proposedStartDatetime || null,
          proposedEndDatetime: item.proposedEndDatetime || null,
          rescheduleReason: item.rescheduleReason || null,
          status: item.status,
          conflictFlag: false,
          remarks: item.remarks || null,
          displayTitle: item.displayTitle,
          processedById,
          proposalVersion: item.proposedDate ? 1 : 0,
          version: 1,
          priestResponseStatus: item.status === "CONFIRMED" || item.status === "COMPLETED" ? "ACCEPTED" : null,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
      manifest.scheduleIds.push(schedule.id);
      saveManifest(manifest);
    }
  }
  console.log(`  Schedules ready: ${manifest.scheduleIds.length}`);

  // -------------------------------------------------------
  // Step 5: Seed Parish Events
  // -------------------------------------------------------
  console.log("\n[5/6] Seeding Parish Events...");

  for (const item of SEED_PARISH_EVENTS) {
    const assignedPriestId = item.assignPriestParishId ? priestByParish.get(item.assignPriestParishId) || null : null;
    const createdById = item.creatorSecretaryParishId ? secretaryByParish.get(item.creatorSecretaryParishId) || null : null;

    // Crash-safe deterministic lookup
    let event = await prisma.parishEvent.findFirst({
      where: {
        parishId: item.parishId,
        eventDate: item.eventDate,
        title: item.title,
      },
    });

    if (event) {
      if (!manifest.parishEventIds.includes(event.id)) {
        manifest.parishEventIds.push(event.id);
        saveManifest(manifest);
      }
    } else {
      event = await prisma.parishEvent.create({
        data: {
          parishId: item.parishId,
          createdById,
          title: item.title,
          eventType: item.eventType,
          description: item.description,
          location: item.location,
          eventDate: item.eventDate,
          startTime: item.startTime,
          endTime: item.endTime,
          assignedPriestId,
          priestResponseStatus: "ACCEPTED",
          isActive: true,
          visibility: item.visibility,
          version: 1,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
      manifest.parishEventIds.push(event.id);
      saveManifest(manifest);
    }
  }
  console.log(`  Parish Events ready: ${manifest.parishEventIds.length}`);

  // -------------------------------------------------------
  // Step 6: Seed Daily Reports
  // -------------------------------------------------------
  console.log("\n[6/6] Seeding Daily Reports...");

  for (const item of SEED_DAILY_REPORTS) {
    const createdById = item.useCoordinatorCreator
      ? coordinatorUser.id
      : secretaryByParish.get(item.creatorSecretaryParishId);

    // Crash-safe deterministic lookup
    let report = await prisma.dailyReport.findFirst({
      where: {
        reportDate: item.reportDate,
        category: item.category,
        title: item.title,
        scope: item.scope,
      },
    });

    if (report) {
      if (!manifest.dailyReportIds.includes(report.id)) {
        manifest.dailyReportIds.push(report.id);
        saveManifest(manifest);
      }
    } else {
      report = await prisma.dailyReport.create({
        data: {
          reportDate: item.reportDate,
          scope: item.scope,
          parishId: item.parishId,
          title: item.title,
          category: item.category,
          description: item.description,
          createdById,
          isArchived: false,
          version: 1,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
      manifest.dailyReportIds.push(report.id);
      saveManifest(manifest);
    }
  }
  console.log(`  Daily Reports ready: ${manifest.dailyReportIds.length}`);

  // Final Manifest save
  saveManifest(manifest);
  console.log(`\nManifest successfully updated at: ${MANIFEST_PATH}`);

  // Verify excluded tables immediately after writes
  const excludedAfter = await getExcludedCounts();
  console.log("\nExcluded Tables Post-Seed Verification:");
  let excludedChanged = false;
  for (const [table, cnt] of Object.entries(excludedAfter)) {
    const prev = excludedBefore[table];
    const diff = cnt - prev;
    if (diff !== 0) {
      excludedChanged = true;
      console.warn(`! Excluded table "${table}" changed count: was ${prev}, now ${cnt} (diff: ${diff > 0 ? "+" : ""}${diff})`);
    } else {
      console.log(`✔ ${table}: ${cnt} (UNCHANGED)`);
    }
  }

  if (excludedChanged) {
    console.warn("\nNOTICE: Concurrent external activity occurred on excluded tables during run.");
  } else {
    console.log("\n✔ ALL EXCLUDED TABLES REMAIN STRICTLY UNCHANGED.");
  }

  console.log("\nPresentation Seed completed successfully.");
}

main()
  .catch((err) => {
    console.error("FATAL: Seed execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
