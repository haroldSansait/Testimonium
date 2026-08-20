# TESTIMONIUM — Future RAG Knowledge Assistant

**Status:** Deferred. Do not implement into mobile v1 yet.

## 1. Why deferred

A useful RAG assistant depends more on knowledge quality and governance than on chat UI.

The current database includes:
- `faq_knowledge_base`
- `chatbot_logs`

But those models alone do not establish a production-ready retrieval corpus.

The project team has intentionally paused chatbot implementation until the correct knowledge base exists.

## 2. Product goal

Future assistant should answer parishioner questions using curated, attributable TESTIMONIUM/diocesan/parish knowledge rather than free-form model memory.

Example future topics:
- sacramental document requirements;
- parish procedures;
- office hours;
- scheduling policies;
- payment instructions;
- diocesan/parish FAQs;
- sacramental preparation guidance approved for publication.

## 3. Knowledge governance prerequisites

Before implementation, define:

### Source authority
- Which diocesan office approves content?
- Can parishes publish local knowledge?
- Which source wins when diocesan and parish guidance differ?

### Scope
- diocesan global;
- vicariate;
- parish;
- document type;
- sacrament;
- date/effective version.

### Ownership
Every source should have:
- owner/editor;
- approval state;
- effective date;
- last reviewed date;
- active/archived state.

### Update process
- who can edit;
- who approves;
- how old guidance is retired;
- how urgent corrections propagate.

## 4. Required source types

Prefer structured/approved sources:
- official FAQs;
- published requirements;
- policy documents;
- parish office instructions;
- verified schedules/configuration data.

Do not scrape arbitrary internet pages into the knowledge base.

## 5. Retrieval architecture (future)

Conceptual:

```text
User question
-> authentication/context
-> query classification
-> retrieve approved chunks
-> optional structured backend facts/tools
-> LLM grounded generation
-> citations
-> safety/policy post-processing
-> response
-> feedback/logging
```

## 6. Structured data vs RAG

Do not use embeddings for facts already available reliably through APIs.

Examples:
- current request status -> API tool/query;
- current parish office hours -> structured parish config;
- available slots -> scheduling endpoint;
- current payment amount -> request/payment API.

RAG is better for:
- explanations;
- requirements text;
- policy/guidance;
- FAQ-style content.

Future assistant may need both retrieval and tool calling.

## 7. Security/tenancy

Retrieval must enforce source visibility.

Do not allow:
- parishioner to retrieve internal staff instructions;
- one parish's private staff content to leak to another;
- prompt injection inside uploaded knowledge to override system rules.

Corpus metadata should include access scope.

## 8. Chunking

Do not decide chunk size generically before corpus analysis.

Chunking should preserve:
- heading context;
- policy section;
- parish/sacrament metadata;
- version/effective date.

Avoid chopping requirements lists into contextless fragments.

## 9. Citations

Production answers should cite the underlying knowledge source.

Citation should identify:
- source title;
- parish/diocese scope;
- relevant section;
- effective/update date where useful.

If retrieval confidence/source coverage is insufficient, assistant should say it cannot answer reliably and direct the user to official contact/workflow.

## 10. Hallucination policy

Assistant must not:
- invent sacramental requirements;
- invent fees;
- promise appointment availability;
- claim payment approval;
- interpret canon/legal matters beyond approved material;
- fabricate parish contact details.

Use structured API data for dynamic facts.

## 11. Prompt-injection defense

Treat corpus text as untrusted data.

Knowledge documents must not be allowed to change:
- system instructions;
- authorization rules;
- tool permissions;
- user identity.

Retrieval pipeline should isolate instructions from content.

## 12. PII

Do not embed private user request data into a shared vector index.

User-specific questions should use authenticated structured tools/APIs.

Chat logs need retention/privacy policy before production.

## 13. Evaluation before launch

Create a gold question set covering:
- easy FAQs;
- ambiguous questions;
- conflicting parish/diocese rules;
- outdated content;
- missing answer;
- adversarial prompt injection;
- dynamic request/payment questions;
- sensitive topics.

Measure:
- groundedness;
- citation correctness;
- refusal/uncertainty behavior;
- retrieval precision;
- stale-source rate.

## 14. Mobile integration later

Mobile chat UI should only begin after:
- backend RAG endpoint exists;
- corpus is approved;
- retrieval/citation contract is stable;
- auth/access scope is defined;
- evaluation passes.

Keep mobile client thin:
- send question/context;
- render answer;
- render citations;
- show source/open-contact actions;
- no embedding/model API keys in app.

## 15. Feature flag

When implemented:
- gate assistant behind server-controlled or environment feature flag;
- allow disabling without app-store release.

## 16. Decision gate

Do not start RAG implementation until product owner can answer:
1. What are the authoritative documents?
2. Who approves them?
3. How are they updated/versioned?
4. Which are diocese-wide vs parish-specific?
5. What should the assistant never answer?
6. What dynamic facts require tools instead of RAG?
7. What citation format is required?
8. What retention policy applies to chat logs?
