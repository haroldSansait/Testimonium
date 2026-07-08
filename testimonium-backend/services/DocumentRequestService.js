import { DocumentRequestRepository } from "../repositories/DocumentRequestRepository.js";

export class DocumentRequestService {
  constructor(documentRequestRepository = new DocumentRequestRepository()) {
    this.documentRequestRepository = documentRequestRepository;
  }

  /**
   * Returns a paginated list of document requests with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.search
   * @param {string|undefined} opts.status
   * @param {string|undefined} opts.documentType
   */
  async list({ page = 1, limit = 10, search, status, documentType, parishId } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return this.documentRequestRepository.findMany({
      page: parsedPage,
      limit: parsedLimit,
      search,
      status,
      documentType,
      parishId,
    });
  }
}
