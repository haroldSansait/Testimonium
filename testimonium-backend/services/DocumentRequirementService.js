import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { CANONICAL_REQUIREMENT_IDS } from "../config/documents.js";

export { CANONICAL_REQUIREMENT_IDS };

const ENDORSEMENT_LETTER = {
  id: "endorsement_letter",
  label: "Endorsement Letter",
  category: "supporting",
  required: true,
  description: "Endorsement letter submitted as supporting documentation for a certificate request.",
};

/**
 * Configurable Sacramental Document Requirements Matrix
 * Single source of truth for document requirements across the platform.
 */
export const DOCUMENT_REQUIREMENTS_MATRIX = {
  BAPTISMAL_CERTIFICATE: {
    documentType: "BAPTISMAL_CERTIFICATE",
    title: "Baptismal Certificate",
    description: "Official copy of the Sacrament of Baptism registry entry.",
    estimatedProcessingDays: 3,
    baseFee: 100.00,
    requiredFields: [
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID", category: "primary", required: true, description: "Clear photo or scan of valid ID." },
      { ...ENDORSEMENT_LETTER },
    ],
  },

  CONFIRMATION_CERTIFICATE: {
    documentType: "CONFIRMATION_CERTIFICATE",
    title: "Confirmation Certificate",
    description: "Official record of the Sacrament of Confirmation.",
    estimatedProcessingDays: 3,
    baseFee: 100.00,
    requiredFields: [
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID", category: "primary", required: true, description: "Clear photo or scan of valid ID." },
      { ...ENDORSEMENT_LETTER },
    ],
  },

  MARRIAGE_CERTIFICATE: {
    documentType: "MARRIAGE_CERTIFICATE",
    title: "Marriage Certificate",
    description: "Official sacramental record of Holy Matrimony.",
    estimatedProcessingDays: 5,
    baseFee: 150.00,
    requiredFields: [
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID of Requester", category: "primary", required: true, description: "Clear photo of valid ID." },
      { ...ENDORSEMENT_LETTER },
    ],
  },

  FIRST_COMMUNION_CERTIFICATE: {
    documentType: "FIRST_COMMUNION_CERTIFICATE",
    title: "First Communion Certificate",
    description: "Official record of First Holy Communion.",
    estimatedProcessingDays: 3,
    baseFee: 75.00,
    requiredFields: [
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid ID of Parent / Guardian", category: "primary", required: true, description: "Clear photo of valid ID." },
      { ...ENDORSEMENT_LETTER },
    ],
  },

  MARRIAGE_BANNS: {
    documentType: "MARRIAGE_BANNS",
    title: "Marriage Banns",
    description: "Public notification of prospective marriage posted across parishes.",
    estimatedProcessingDays: 14,
    baseFee: 200.00,
    requiredFields: [
      { id: "purpose", label: "Proposed Marriage Date & Parish", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid IDs of Both Parties", category: "primary", required: true, description: "Government issued IDs of bride and groom." },
      { ...ENDORSEMENT_LETTER },
      { id: "baptismal_cert", label: "Baptismal Certificate (for Marriage Purpose)", category: "supporting", required: true, description: "Issued within the last 6 months." },
      { id: "confirmation_cert", label: "Confirmation Certificate", category: "supporting", required: true, description: "Annotated for marriage purpose." },
      { id: "marriage_license", label: "Civil Marriage License / Marriage Contract", category: "supporting", required: true, description: "From LCR or PSA." },
      { id: "precana_proof", label: "Pre-Cana Seminar Certificate", category: "supporting", required: true, description: "Proof of attendance." },
      { id: "cenomar", label: "PSA CENOMAR", category: "supporting", required: true, description: "Certificate of No Marriage Record from PSA." },
      { id: "banns_clearance", label: "Banns Clearance Form", category: "supporting", required: true, description: "From home parish." },
    ],
  },

  PERMIT_TO_MARRY: {
    documentType: "PERMIT_TO_MARRY",
    title: "Permit to Marry",
    description: "Canonical clearance granted to marry in another parish or jurisdiction.",
    estimatedProcessingDays: 7,
    baseFee: 150.00,
    requiredFields: [
      { id: "purpose", label: "Destination Parish & Wedding Date", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID", category: "primary", required: true, description: "Valid photo ID." },
      { ...ENDORSEMENT_LETTER },
      { id: "baptismal_cert", label: "Baptismal Certificate", category: "supporting", required: true, description: "Annotated for marriage." },
      { id: "confirmation_cert", label: "Confirmation Certificate", category: "supporting", required: true, description: "Annotated for marriage." },
      { id: "marriage_license", label: "Civil Marriage License", category: "supporting", required: true, description: "Copy of civil license." },
      { id: "precana_proof", label: "Pre-Cana Seminar Certificate", category: "supporting", required: true, description: "Pre-Cana completion." },
      { id: "cenomar", label: "PSA CENOMAR", category: "supporting", required: true, description: "Certificate of No Marriage." },
      { id: "canonical_interview", label: "Canonical Interview Form", category: "supporting", required: true, description: "Signed interview clearance." },
      { id: "banns_clearance", label: "Banns Clearance", category: "supporting", required: true, description: "Published banns clearance." },
    ],
  },

  STATUS_OF_LIBERTY: {
    documentType: "STATUS_OF_LIBERTY",
    title: "Status of Liberty Certificate",
    description: "Attestation of canonical freedom to marry (Status Liber).",
    estimatedProcessingDays: 5,
    baseFee: 150.00,
    requiredFields: [
      { id: "purpose", label: "Reason for Status Liber Verification", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID", category: "primary", required: true, description: "Valid photo ID." },
      { ...ENDORSEMENT_LETTER },
      { id: "baptismal_cert", label: "Baptismal Certificate", category: "supporting", required: true, description: "Recent baptismal record." },
      { id: "cenomar", label: "PSA CENOMAR", category: "supporting", required: true, description: "PSA Certificate of No Marriage Record." },
      { id: "canonical_interview", label: "Canonical Interview Document", category: "supporting", required: true, description: "Interview conducted by parish priest." },
    ],
  },
};

const allExistingRequirementDefinitions = Object.values(DOCUMENT_REQUIREMENTS_MATRIX)
  .flatMap((config) => config.requiredDocuments);

export const CANONICAL_REQUIREMENTS_CATALOG = Object.fromEntries(
  CANONICAL_REQUIREMENT_IDS.map((requirementId) => {
    const existingDefinition = allExistingRequirementDefinitions.find(
      (requirement) => requirement.id === requirementId
    );
    if (!existingDefinition) {
      throw new Error(`Missing existing definition for canonical requirement "${requirementId}".`);
    }
    return [requirementId, { ...existingDefinition }];
  })
);

export class DocumentRequirementService {
  /**
   * Returns requirements metadata for all document types or a specific document type.
   * @param {string} [documentType]
   * @param {string|number} [parishId]
   */
  static async getRequirements(documentType, parishId, prismaClient = prisma) {
    let matrix = JSON.parse(JSON.stringify(DOCUMENT_REQUIREMENTS_MATRIX));

    if (parishId) {
      const client = prismaClient || prisma;
      const parish = await client.parish.findUnique({
        where: { id: parseInt(parishId, 10) },
        select: { documentSettings: true },
      });
      if (parish && parish.documentSettings) {
        try {
          const settings = JSON.parse(parish.documentSettings);
          for (const [docType, config] of Object.entries(settings)) {
            if (matrix[docType]) {
              if (config.price !== undefined) {
                matrix[docType].baseFee =
                  config.price === null || isNaN(Number(config.price))
                    ? null
                    : parseFloat(config.price);
              }
              if (config.requirements && typeof config.requirements === "object") {
                const defaultDocs = matrix[docType].requiredDocuments;
                const defaultIds = new Set(defaultDocs.map((d) => d.id));
                const resolvedDocs = [];

                // 1. Process matrix defaults, preserving their original order & definitions
                for (const doc of defaultDocs) {
                  const override = config.requirements[doc.id];
                  if (override === false) {
                    continue; // Explicitly disabled
                  }
                  resolvedDocs.push({
                    ...doc,
                    required: true,
                  });
                }

                // 2. Process canonical requirements not in defaults, in deterministic canonical order
                for (const reqId of CANONICAL_REQUIREMENT_IDS) {
                  if (!defaultIds.has(reqId) && config.requirements[reqId] === true) {
                    resolvedDocs.push({
                      ...CANONICAL_REQUIREMENTS_CATALOG[reqId],
                      required: true,
                    });
                  }
                }

                matrix[docType].requiredDocuments = resolvedDocs;
              }
            }
          }
        } catch (e) {
          logger.error({ err: e }, "Error parsing documentSettings");
        }
      }
    }

    if (documentType) {
      const config = matrix[documentType];
      if (!config) {
        const err = new Error(`Unsupported document type: ${documentType}`);
        err.statusCode = 404;
        throw err;
      }
      return config;
    }
    return matrix;
  }
}
