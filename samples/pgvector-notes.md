# pgvector Indexing Notes (Sample Document)

The `pgvector` extension adds vector similarity search to PostgreSQL.

## Distance Operators
- `<->`: Euclidean (L2) distance
- `<=>`: Cosine distance (`1 - cosine_similarity`)
- `<#>`: Negative inner product

For normalized text embeddings such as `text-embedding-005`, cosine distance (`<=>`) is commonly used to rank semantically similar chunks.

## HNSW vs IVFFlat
An HNSW (Hierarchical Navigable Small World) index builds a multi-layer graph that provides fast approximate nearest-neighbor queries without requiring a separate training step on existing rows. By contrast, IVFFlat partitions vectors into lists and requires choosing `lists` and running `CREATE INDEX` after data is loaded. HNSW generally uses more memory and takes longer to build, but offers better query recall at a given latency.
