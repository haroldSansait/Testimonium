# TESTIMONIUM Knowledge Corpus Specification

## Overview
This directory contains schema definitions and reviewed corpus source files for the TESTIMONIUM RAG Knowledge Base.

## Safety and Governance Rules
1. **Never Automatically Ingest Source Code or Documentation:**
   - Raw markdown files, source comments, or technical architecture documents must not be bulk-ingested into the knowledge base.
   - All knowledge entries must be human-curated and validated against canonical diocesan and parish procedures.

2. **Strict Import Lifecycle:**
   - Every imported `KnowledgeSource` is created with:
     - `status = DRAFT`
     - `authority = PROVISIONAL`
     - `version = 1`
   - Chunks are created with:
     - `embeddingStatus = PENDING`
   - **Imports NEVER confirm, embed, publish, or activate knowledge.**
   - A Diocese Coordinator must explicitly review and confirm the entry via the Admin Governance Portal.
   - The Embedding Worker will only embed confirmed sources (`DRAFT + CONFIRMED`).
   - The source can only be published (`ACTIVE + CONFIRMED`) once all current-version chunks are `READY`.

3. **Tenancy Constraints:**
   - `scope: "DIOCESE"` → `parishId` MUST be `null` or omitted.
   - `scope: "PARISH"` → `parishId` MUST be an active integer parish ID.
   - Cross-parish leakage is prevented both at import validation and at query time in PostgreSQL.

4. **Corpus File Format:**
   - Files follow `initial_corpus.schema.json`.
   - See `initial_corpus.sample.json` for a structural example.
