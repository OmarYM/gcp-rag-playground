# RAG Evaluation

This directory contains a small, reproducible evaluation over the public-safe sample documents in `samples/`.

## Dataset (`eval/dataset.json`)

- **Size**: 8 questions across 3 sample documents (`cloud-run-notes.md`, `pgvector-notes.md`, `pubsub-ingestion-notes.txt`).
- **Categories**:
  - `single_passage` (2): Direct facts contained in a single document passage.
  - `multi_passage` (1): Requires combining evidence from two documents.
  - `similar_wording` (2): Questions with overlapping terminology (`min-instances`, Pub/Sub `200` vs `500` handling).
  - `unanswerable` (2): Questions whose answers are not in `samples/`.
  - `user_isolation` (1): Queries run as `eval-user-b` while documents are owned by `eval-user-a`.

## Metrics & Scoring

1. **Retrieval Hit@5** (automated): For answerable cases, checks whether all `expectedSources` and `expectedEvidenceSubstrings` appear in the top-5 `pgvector` cosine-similarity results.
2. **Citation Resolution** (automated): Verifies that every returned source reference (`filename`, `chunk_index`) resolves to a non-empty chunk actually supplied in the prompt context. Note: citation resolution verifies provenance to retrieved chunks, not factual correctness of the generated answer.
3. **User Isolation** (automated): Verifies `eval-user-b` receives 0 chunks from `eval-user-a`.
4. **Answer Quality** (manual review): Generated answers are printed alongside `expectedAnswerSummary` so a human reviewer can check correctness, grounding in retrieved evidence, and refusal on unanswerable questions.

## Limitations

- `N = 8` is a sanity-check dataset, not a statistically significant benchmark.
- No LLM-as-a-judge is used; answer correctness requires manual inspection.

## Running the Evaluation

Requires a running PostgreSQL + `pgvector` instance and either `GEMINI_API_KEY` or Vertex AI credentials:

```bash
cd backend
npm run eval
```

## Results

Run against local PostgreSQL (`pgvector`) and Gemini Developer API (`AI_PROVIDER=gemini`):

- **Models & Settings**: `gemini-embedding-001` (768-d), `gemini-3.8-flash`, `chunkSize=500`, `chunkOverlap=80`, `k=5`, `N=8` cases.
- **Retrieval Hit@5 (answerable cases)**: `5/5`
- **Citation Resolution**: `8/8` (every returned source resolved to a non-empty chunk + filename from the prompt context)
- **User Isolation (`eval-user-b`)**: `PASS` (`0` chunks retrieved from `eval-user-a`)
- **Manual Answer Review**: All 5 answerable cases (`single-1`, `single-2`, `multi-1`, `confusable-1`, `confusable-2`) were grounded in the retrieved passages and cited source filenames; both unanswerable cases (`unanswerable-1`, `unanswerable-2`) explicitly stated the information was not present in the context. Note: `N=8` is a small sanity check over 3 sample documents, not a statistical benchmark.
