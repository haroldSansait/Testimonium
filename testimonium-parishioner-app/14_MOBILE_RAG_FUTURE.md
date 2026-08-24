# TESTIMONIUM — Future RAG Knowledge Assistant

**Status:** Deferred. Do not implement into mobile v1 yet.
**Last reconciled:** 24 August 2026

## 1. Why deferred

A production-ready RAG (Retrieval-Augmented Generation) assistant requires authoritative, curated knowledge governance rather than simply a chat UI.

While the database includes foundational models (`faq_knowledge_base`, `chatbot_logs`), these alone do not constitute a verified, diocesan-approved retrieval corpus. The project team has intentionally paused AI assistant implementation until diocesan knowledge governance is established.

## 2. Product objective

The future assistant will answer parishioner questions using curated, attributable TESTIMONIUM knowledge (canonical requirements, parish office hours, scheduling guidelines, and preparation policies) rather than unconstrained model memory.

## 3. Knowledge governance prerequisites

Prior to any implementation:
1. **Source Authority:** Clear hierarchy between diocesan policies and parish-specific guidelines.
2. **Document Ownership:** Designated diocesan editors and formal approval states for all knowledge items.
3. **Version Control:** Structured tracking of effective dates and retirement of outdated requirements.
4. **Structured APIs vs RAG:** Dynamic facts (e.g. current request status, available appointment slots, payment fee snapshots) must be resolved via authenticated backend tools/APIs, while RAG is reserved for policy and explanatory text.

## 4. Guardrails and safety rules

- **Hallucination Prevention:** The assistant must never invent fees, requirements, or appointment slots, nor claim payment verification.
- **Tenancy and Privacy:** Private parishioner request data must never be indexed into shared vector stores.
- **Citations:** Every generated answer must provide attributable citations to official diocesan documents.
- **Client Implementation:** When approved, the mobile app will act purely as a thin client rendering structured responses and citations received from a secure backend RAG endpoint.
