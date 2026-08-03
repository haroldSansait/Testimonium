import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";

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
      { id: "applicantName", label: "Full Name of Baptized Person", type: "text", required: true },
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government / Student ID", category: "primary", required: true, description: "Clear photo or scan of valid ID." },
    ],
  },

  CONFIRMATION_CERTIFICATE: {
    documentType: "CONFIRMATION_CERTIFICATE",
    title: "Confirmation Certificate",
    description: "Official record of the Sacrament of Confirmation.",
    estimatedProcessingDays: 3,
    baseFee: 100.00,
    requiredFields: [
      { id: "applicantName", label: "Full Name of Confirmed Person", type: "text", required: true },
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government / Student ID", category: "primary", required: true, description: "Clear photo or scan of valid ID." },
    ],
  },

  MARRIAGE_CERTIFICATE: {
    documentType: "MARRIAGE_CERTIFICATE",
    title: "Marriage Certificate",
    description: "Official ecclesial record of Holy Matrimony.",
    estimatedProcessingDays: 5,
    baseFee: 150.00,
    requiredFields: [
      { id: "applicantName", label: "Names of Husband & Wife", type: "text", required: true },
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID of Requester", category: "primary", required: true, description: "Clear photo of valid ID." },
    ],
  },

  FIRST_COMMUNION_CERTIFICATE: {
    documentType: "FIRST_COMMUNION_CERTIFICATE",
    title: "First Communion Certificate",
    description: "Official record of First Holy Communion.",
    estimatedProcessingDays: 3,
    baseFee: 75.00,
    requiredFields: [
      { id: "applicantName", label: "Full Name of Communicant", type: "text", required: true },
      { id: "purpose", label: "Purpose / Reason for Request", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid ID of Parent / Guardian", category: "primary", required: true, description: "Clear photo of valid ID." },
    ],
  },

  MARRIAGE_BANNS: {
    documentType: "MARRIAGE_BANNS",
    title: "Marriage Banns",
    description: "Public notification of prospective marriage posted across parishes.",
    estimatedProcessingDays: 14,
    baseFee: 200.00,
    requiredFields: [
      { id: "applicantName", label: "Full Name of Groom & Bride", type: "text", required: true },
      { id: "purpose", label: "Proposed Marriage Date & Parish", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid IDs of Both Parties", category: "primary", required: true, description: "Government issued IDs of bride and groom." },
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
      { id: "applicantName", label: "Full Name of Applicant", type: "text", required: true },
      { id: "purpose", label: "Destination Parish & Wedding Date", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID", category: "primary", required: true, description: "Valid photo ID." },
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
      { id: "applicantName", label: "Full Name of Applicant", type: "text", required: true },
      { id: "purpose", label: "Reason for Status Liber Verification", type: "text", required: true },
    ],
    requiredDocuments: [
      { id: "valid_id", label: "Valid Government ID", category: "primary", required: true, description: "Valid photo ID." },
      { id: "baptismal_cert", label: "Baptismal Certificate", category: "supporting", required: true, description: "Recent baptismal record." },
      { id: "cenomar", label: "PSA CENOMAR", category: "supporting", required: true, description: "PSA Certificate of No Marriage Record." },
      { id: "canonical_interview", label: "Canonical Interview Document", category: "supporting", required: true, description: "Interview conducted by parish priest." },
    ],
  },
};

export class DocumentRequirementService {
  /**
   * Returns requirements metadata for all document types or a specific document type.
   * @param {string} [documentType]
   * @param {string|number} [parishId]
   */
  static async getRequirements(documentType, parishId) {
    let matrix = JSON.parse(JSON.stringify(DOCUMENT_REQUIREMENTS_MATRIX));

    if (parishId) {
      const parish = await prisma.parish.findUnique({
        where: { id: parseInt(parishId, 10) }
      });
      if (parish && parish.documentSettings) {
        try {
          const settings = JSON.parse(parish.documentSettings);
          for (const [docType, config] of Object.entries(settings)) {
            if (matrix[docType]) {
              if (config.price !== undefined) {
                matrix[docType].baseFee = parseFloat(config.price);
              }
              if (config.requirements) {
                matrix[docType].requiredDocuments = matrix[docType].requiredDocuments.map(doc => {
                  const isRequired = config.requirements[doc.id];
                  if (isRequired !== undefined) {
                    return { ...doc, required: !!isRequired };
                  }
                  return doc;
                }).filter(doc => doc.required);
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
