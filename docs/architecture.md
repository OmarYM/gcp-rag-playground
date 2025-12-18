# System Architecture — GCP RAG Playground

This document describes the **implemented** architecture of the GCP RAG Playground across both its Google Cloud deployment target (`infra/`) and its local development mode (`docker-compose.yml`).

> **Historical Note:** [`docs/design-doc.md`](design-doc.md) and [`docs/GCP_Architecture.png`](GCP_Architecture.png) are early aspirational design artifacts (proposing AlloyDB, Cloud Functions, and Cloud Trace). This document reflects only what is actually implemented in the codebase and Terraform configuration.

![Simplified Architecture Overview](architecture-simple.jpg)

---

## 1. High-Level Component Architecture

```mermaid
flowchart TB
    subgraph Client["Client (React + Vite)"]
        UI["Chat & Upload UI"]
    end

    subgraph Backend["Backend API (Express + TypeScript)"]
        Routes["REST & SSE Endpoints"]
        Webhook["Pub/Sub Push Handler (/pubsub-webhook)"]
        Worker["Ingestion Pipeline (Parse, Chunk, Embed)"]
    end

    subgraph Cloud["Google Cloud Mode"]
        GCS[("Cloud Storage Bucket")]
        Topic["Cloud Pub/Sub Topic"]
        Sub["Pub/Sub Push Subscription (OIDC)"]
        Vertex["Vertex AI (Embeddings + Gemini)"]
        CloudSQL[("Cloud SQL PostgreSQL 15 + pgvector")]
    end

    subgraph Local["Local Development Mode"]
        Disk[("Local Disk (./uploads)")]
        Inline["In-Process Async Queue"]
        GeminiAPI["Gemini Developer API"]
        LocalPG[("Docker pgvector (pg15)")]
    end

    UI -->|"Bearer Token + API Calls"| Routes
    Routes -->|"Cloud: Signed URL"| GCS
    Routes -->|"Local: PUT /local-upload"| Disk
    Routes -->|"Cloud: Publish Event"| Topic
    Topic -->|"Push + OIDC"| Sub
    Sub --> Webhook
    Webhook --> Worker
    Routes -->|"Local: INGESTION_MODE=inline"| Inline
    Inline --> Worker

    Worker -->|"Download File"| GCS
    Worker -->|"Read File"| Disk
    Worker -->|"Embed Chunks"| Vertex
    Worker -->|"Embed Chunks"| GeminiAPI
    Worker -->|"Store Chunks & Vectors"| CloudSQL
    Worker -->|"Store Chunks & Vectors"| LocalPG

    Routes -->|"Top-5 Cosine Search"| CloudSQL
    Routes -->|"Top-5 Cosine Search"| LocalPG
    Routes -->|"Stream Answer (SSE)"| Vertex
    Routes -->|"Stream Answer (SSE)"| GeminiAPI
```

---

## 2. Asynchronous Ingestion Flow

Document upload is decoupled from parsing and embedding so HTTP upload requests do not time out on larger PDFs or DOCX files.

```mermaid
sequenceDiagram
    autonumber
    participant FE as React Frontend
    participant API as Express Backend
    participant STG as GCS / Local Disk
    participant PS as Cloud Pub/Sub
    participant DB as PostgreSQL (pgvector)
    participant AI as Gemini / Vertex AI

    FE->>API: POST /upload-url (filename, contentType, fileSize)
    API->>DB: Check per-user quota (max 50 files, 10 MB)
    API-->>FE: Return upload URL, storageUri, and user-scoped objectKey
    FE->>STG: PUT file bytes
    FE->>API: POST /documents/ingest (filename, storageUri, chunkingConfig)
    API->>DB: INSERT into documents with status = pending
    alt INGESTION_MODE = pubsub
        API->>PS: Publish ingestion payload to PROCESSING_TOPIC
        API-->>FE: 202 Accepted (mode = pubsub, messageId)
        PS->>API: POST /pubsub-webhook (OIDC Bearer token + base64 message)
    else INGESTION_MODE = inline
        API-->>FE: 202 Accepted (mode = inline)
    end
    API->>DB: Check status (skip if already completed for idempotency)
    API->>STG: Download file bytes
    API->>API: Extract text (PDF, DOCX, TXT, MD) and chunk
    API->>AI: Embed chunks (RETRIEVAL_DOCUMENT, 768-d)
    API->>DB: Transaction: replace chunks and set status = completed
```

### Failure & Retry Semantics
- **Idempotency:** Cloud Pub/Sub guarantees at-least-once delivery. If `/pubsub-webhook` receives a duplicate delivery for a document already marked `completed`, it returns `200 OK` without duplicating chunks.
- **Permanent validation errors** (unsupported extension, empty/unextractable text, 0 chunks above `minChunkSize`): Recorded in `documents.status = 'failed'` with `error_message` and acknowledged with `200 OK` so Pub/Sub does not retry indefinitely.
- **Transient provider/DB errors:** Recorded in `documents.status = 'failed'` and returned as `500 Internal Server Error` so Pub/Sub retries with exponential backoff.

---

## 3. Query & Citation Flow (`POST /chat`)

```mermaid
sequenceDiagram
    autonumber
    participant FE as React Frontend
    participant API as Express Backend
    participant AI as Gemini / Vertex AI
    participant DB as PostgreSQL (pgvector)

    FE->>API: POST /chat (query, systemInstruction, history)
    API->>API: Validate query (non-empty, max 2000 chars)
    API->>AI: Embed query (RETRIEVAL_QUERY, 768-d)
    API->>DB: SELECT top-5 chunks filtered by user_id and status = completed
    API-->>FE: SSE event context (document_id, chunk_index, filename, content, score)
    loop Token Stream
        AI-->>API: Generated text chunk
        API-->>FE: SSE data token
    end
```

---

## 4. Database Schema (`backend/db/schema.sql`)

```mermaid
erDiagram
    DOCUMENTS {
        uuid id PK
        text filename
        text storage_uri
        text mime_type
        text status
        text error_message
        text pubsub_message_id
        text user_id
        bigint file_size
        timestamptz created_at
        timestamptz updated_at
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        text content
        integer chunk_index
        vector embedding
    }

    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : contains
```

---

## 5. Multi-Tenant Isolation Boundaries

1. **Authentication:** Requests to `/documents`, `/upload-url`, `/documents/ingest`, `/chat`, and `DELETE /documents/:id` require a verified Google Sign-In ID token (`google-auth-library`) unless `DEV_AUTH_BYPASS=true` is explicitly enabled in non-production local development.
2. **Storage Scoping:** Upload keys are generated server-side as `users/<userId>/<uuid>-<sanitizedFilename>`, preventing filename collisions and cross-user overwrites.
3. **Database Query Filtering:** All document reads, vector similarity searches (`JOIN documents ... WHERE documents.user_id = $2`), and deletes verify `user_id` at the SQL boundary.
4. **Pub/Sub Webhook Auth:** `/pubsub-webhook` verifies the Google-signed OIDC Bearer token (`PUBSUB_PUSH_SERVICE_ACCOUNT` / `PUBSUB_VERIFICATION_AUDIENCE`) in cloud mode.

---

## 6. GCP Infrastructure Topology (`infra/modules/rag-stack/`)

Terraform provisions the following resources per environment:
- **Networking:** Custom VPC, subnetwork (`10.0.0.0/20`), and Private Services Access VPC peering for Cloud SQL.
- **Cloud SQL (`POSTGRES_15`):** Private IP only (`ipv4_enabled = false`), `db-f1-micro` default tier.
- **Cloud Run v2:** Separate backend API (`${prefix}-api`) and frontend (`${prefix}-frontend`) services; backend uses Direct VPC Egress (`PRIVATE_RANGES_ONLY`) to reach Cloud SQL over its private IP without a separate Serverless VPC Access connector.
- **Storage & Messaging:** GCS bucket (`uniform_bucket_level_access = true`, CORS enabled) + Pub/Sub topic and push subscription targeting `${rag_api.uri}/pubsub-webhook` with the Cloud Run service account OIDC token.
- **IAM:** Dedicated service account (`cloud_run_sa`) granted `roles/cloudsql.client`, `roles/pubsub.publisher`, `roles/pubsub.subscriber`, `roles/storage.objectAdmin`, `roles/iam.serviceAccountTokenCreator` (for v4 signed URLs), and `roles/aiplatform.user`.

---

## 7. Key Tradeoffs & Known Limitations

| Area | Choice Made | Tradeoff / Limitation |
| --- | --- | --- |
| **Vector Store** | PostgreSQL + `pgvector` (HNSW) | Keeps relational metadata, user ownership, and vectors in one transactional DB; less specialized than dedicated vector DBs at large scale. |
| **Ingestion Queue** | Cloud Pub/Sub Push + inline local fallback | Decouples slow parsing/embedding from HTTP uploads; requires idempotent webhook handling for at-least-once delivery. |
| **Retrieval** | Top-5 cosine similarity (`<=>`) | Simple and fast, but no hybrid BM25 keyword search or cross-encoder reranking. |
| **Parsing** | `pdf-parse`, `mammoth`, UTF-8 | No OCR for scanned/image-only PDFs. |
