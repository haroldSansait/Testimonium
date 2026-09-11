import { env } from "../config/env.js";

import { KnowledgeRepository } from "../repositories/KnowledgeRepository.js";
import { getEmbeddingProvider } from "./ai/providerFactory.js";

const CANONICAL_TERMS = [
  "baptism",
  "baptismal",
  "confirmation",
  "marriage",
  "funeral",
  "death",
  "certificate",
  "schedule",
  "appointment",
  "authorization letter",
  "sponsor",
  "godparent",
  "stipend",
  "mass intention",
  "priest",
  "parish",
  "office hours",
  "fee",
];

/**
 * Deterministic local token estimation: ceil(charCount / 4) + delimiter overhead.
 */
export function estimateChunkTokens(chunk) {
  const titleLen = (chunk.title || "").length;
  const contentLen = (chunk.content || "").length;
  return Math.ceil((titleLen + contentLen) / 4) + 8;
}

export class RetrievalService {
  constructor(knowledgeRepository = new KnowledgeRepository(), embeddingProvider = null) {
    this.knowledgeRepository = knowledgeRepository;
    this.getEmbeddingProvider = embeddingProvider ? () => embeddingProvider : getEmbeddingProvider;
  }

  /**
   * Applies a small deterministic lexical boost to rankingScore ONLY.
   * Does NOT alter raw semanticScore.
   *
   * @param {string} query
   * @param {Array<object>} candidates
   * @returns {Array<object>}
   */
  applyLexicalRerank(query, candidates) {
    const cleanQuery = query.toLowerCase();
    const queryTerms = CANONICAL_TERMS.filter((term) => cleanQuery.includes(term));

    if (queryTerms.length === 0) {
      return candidates.map((c) => ({ ...c, rankingScore: c.semanticScore }));
    }

    return candidates.map((candidate) => {
      const content = `${candidate.title} ${candidate.content}`.toLowerCase();
      let matches = 0;

      for (const term of queryTerms) {
        if (content.includes(term)) {
          matches++;
        }
      }

      // Small deterministic boost: 0.03 per matching term, clamped at 0.06
      const boost = Math.min(matches * 0.03, 0.06);

      return {
        ...candidate,
        rankingScore: Number((candidate.semanticScore + boost).toFixed(6)),
      };
    });
  }

  filterSafeCandidates(candidates, selectedParishId = null) {
    return (candidates || []).filter((c) => {
      if (selectedParishId === null) {
        return c.scope === "DIOCESE" && (c.parishId === null || c.parishId === undefined);
      }
      return c.scope === "DIOCESE" || c.parishId === selectedParishId;
    });
  }

  selectFinalContext(candidates, {
    selectedParishId = null,
    maxChunks = 4,
    maxTokens = 3500,
    minSemanticScore = 0.65,
  } = {}) {
    const safeCandidates = this.filterSafeCandidates(candidates, selectedParishId);
    if (safeCandidates.length === 0) return [];

    // Find highest raw semantic candidate meeting threshold
    const qualifying = [...safeCandidates]
      .filter((c) => c.semanticScore >= minSemanticScore)
      .sort((a, b) => b.semanticScore - a.semanticScore);
    const topQualifying = qualifying[0] || null;

    // Sort by rankingScore descending (or semanticScore if rankingScore not computed)
    const sorted = [...safeCandidates].sort(
      (a, b) => (b.rankingScore ?? b.semanticScore) - (a.rankingScore ?? a.semanticScore)
    );

    const priorityList = [];
    if (topQualifying) {
      priorityList.push(topQualifying);
    }
    for (const item of sorted) {
      const itemId = item.chunkId ?? item.id;
      if (!priorityList.some((p) => (p.chunkId ?? p.id) === itemId)) {
        priorityList.push(item);
      }
    }

    const selected = [];
    let accumulatedTokens = 0;

    for (const item of priorityList) {
      if (selected.length >= maxChunks) break;

      const itemTokens = estimateChunkTokens(item);
      if (selected.length > 0 && accumulatedTokens + itemTokens > maxTokens) {
        continue;
      }

      selected.push(item);
      accumulatedTokens += itemTokens;
    }

    return selected;
  }

  evaluateEvidenceSufficiency(selectedContext, minSimilarity = 0.65) {
    return Array.isArray(selectedContext) && selectedContext.some((c) => c.semanticScore >= minSimilarity);
  }

  /**
   * Orchestrates retrieval: embed query -> exact pgvector search -> lexical rerank -> final context selection -> evidence gate.
   *
   * @param {object} params
   * @param {string} params.normalizedQuestion
   * @param {number|null} [params.selectedParishId]
   * @returns {Promise<{
   *   candidates: Array<object>,
   *   hasSufficientEvidence: boolean,
   *   topSemanticScore: number,
   *   category: string|null,
   *   embeddingProvider: string,
   *   embeddingModel: string
   * }>}
   */
  async retrieveKnowledge({ normalizedQuestion, selectedParishId = null }) {
    const provider = this.getEmbeddingProvider();
    const minSimilarity = env.chatbot?.minSimilarity ?? 0.65;
    const topK = env.chatbot?.topK ?? 8;
    const maxContextChunks = env.chatbot?.maxContextChunks ?? 4;
    const maxContextTokens = env.chatbot?.maxContextTokens ?? 3500;

    // 1. Embed query
    const { vector, provider: pName, model: mName } = await provider.embedQuery(normalizedQuestion);

    // 2. Vector retrieval from PostgreSQL with strict SQL-level tenancy
    const rawCandidates = await this.knowledgeRepository.findSimilarChunks({
      queryVector: vector,
      selectedParishId,
      limit: topK,
      embeddingModel: mName,
    });

    if (!rawCandidates || rawCandidates.length === 0) {
      return {
        candidates: [],
        hasSufficientEvidence: false,
        topSemanticScore: 0,
        category: null,
        embeddingProvider: pName,
        embeddingModel: mName,
      };
    }

    // 3. Tenancy conflict check
    const safeCandidates = this.filterSafeCandidates(rawCandidates, selectedParishId);
    if (safeCandidates.length === 0) {
      return {
        candidates: [],
        hasSufficientEvidence: false,
        topSemanticScore: 0,
        category: null,
        embeddingProvider: pName,
        embeddingModel: mName,
      };
    }

    // 4. Separate semantic score and ranking score, apply lexical boost to rankingScore ONLY
    const reranked = this.applyLexicalRerank(normalizedQuestion, safeCandidates);

    // 5. Select bounded final context enforcing token budget and preserving top semantic chunk
    const selected = this.selectFinalContext(reranked, {
      selectedParishId,
      maxChunks: maxContextChunks,
      maxTokens: maxContextTokens,
      minSemanticScore: minSimilarity,
    });

    // 6. Evidence Gate: Evaluated STRICTLY on the actual final context passed to generation
    const hasSufficientEvidence = this.evaluateEvidenceSufficiency(selected, minSimilarity);
    const topSemanticScore = selected.length > 0 ? Math.max(...selected.map((c) => c.semanticScore)) : 0;
    const category = selected[0]?.category || null;

    return {
      candidates: selected,
      hasSufficientEvidence,
      topSemanticScore,
      category,
      embeddingProvider: pName,
      embeddingModel: mName,
    };
  }
}

