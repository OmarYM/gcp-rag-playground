import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { loadConfig, validateConfig } from "./config.js";
import { createAIService } from "./lib/ai.js";
import { processDocumentIngestion } from "./lib/ingestion.js";
import { createStorageService } from "./lib/storage.js";

interface EvalCase {
  id: string;
  category: string;
  userId: string;
  query: string;
  expectedSources: string[];
  expectedEvidenceSubstrings: string[];
  expectedAnswerSummary: string;
  expectAnswerable: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

async function main() {
  const cfg = loadConfig({
    ...process.env,
    DEV_AUTH_BYPASS: "true",
    STORAGE_MODE: "local",
    INGESTION_MODE: "inline",
  });

  const errors = validateConfig(cfg);
  if (errors.length > 0) {
    console.error("Cannot run live evaluation — missing configuration:");
    for (const err of errors) console.error(`  - ${err}`);
    console.error(
      "\nSet DB_USER, DB_NAME, DB_HOST, and GEMINI_API_KEY (or PROJECT_ID for Vertex AI) to run the evaluation."
    );
    process.exit(1);
  }

  const pool = new pg.Pool({
    user: cfg.db.user,
    password: cfg.db.password,
    host: cfg.db.host,
    port: cfg.db.port,
    database: cfg.db.database,
  });

  const storage = createStorageService(cfg);
  const ai = createAIService(cfg);

  try {
    const schema = fs.readFileSync(
      path.join(rootDir, "backend/db/schema.sql"),
      "utf-8"
    );
    await pool.query(schema);

    await pool.query(
      "DELETE FROM documents WHERE user_id IN ('eval-user-a', 'eval-user-b')"
    );

    const sampleFiles = [
      "cloud-run-notes.md",
      "pgvector-notes.md",
      "pubsub-ingestion-notes.txt",
    ];

    for (const file of sampleFiles) {
      const content = fs.readFileSync(path.join(rootDir, "samples", file));
      const objectKey = storage.buildObjectKey("eval-user-a", file);
      await storage.saveLocalFile(objectKey, content);
      const storageUri = `local://${objectKey}`;
      const docRes = await pool.query(
        "INSERT INTO documents (filename, storage_uri, status, user_id, file_size) VALUES ($1, $2, 'pending', 'eval-user-a', $3) RETURNING id",
        [file, storageUri, content.length]
      );
      await processDocumentIngestion(
        {
          documentId: docRes.rows[0].id,
          userId: "eval-user-a",
          filename: file,
          storageUri,
          strategy: "recursive",
          chunkSize: 500,
          chunkOverlap: 80,
          minChunkSize: 30,
        },
        { pool, storage, ai }
      );
    }

    const dataset: EvalCase[] = JSON.parse(
      fs.readFileSync(path.join(rootDir, "eval/dataset.json"), "utf-8")
    );

    let retrievalHits = 0;
    let retrievalTotal = 0;
    let citationValidCount = 0;
    let isolationPassed = true;

    console.log("=== RAG Evaluation Run ===");
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(
      `AI Provider: ${cfg.ai.provider} | Embedding: ${cfg.ai.embeddingModel} | Chat: ${cfg.ai.chatModel}`
    );
    console.log(`Dataset Size: ${dataset.length} cases | Top-K: 5\n`);

    for (const item of dataset) {
      const queryEmb = await ai.getEmbedding(item.query, {
        taskType: "RETRIEVAL_QUERY",
      });

      const searchRes = await pool.query(
        `SELECT document_chunks.document_id,
                document_chunks.chunk_index,
                document_chunks.content,
                documents.filename,
                1 - (document_chunks.embedding <=> $1) AS score
         FROM document_chunks
         JOIN documents ON document_chunks.document_id = documents.id
         WHERE documents.user_id = $2 AND documents.status = 'completed'
         ORDER BY document_chunks.embedding <=> $1
         LIMIT 5`,
        [`[${queryEmb.join(",")}]`, item.userId]
      );

      const retrieved = searchRes.rows;
      const retrievedFilenames = new Set(retrieved.map((r) => r.filename));
      const combinedText = retrieved.map((r) => r.content).join("\n");

      if (item.category === "user_isolation") {
        if (retrieved.length > 0) isolationPassed = false;
      } else if (item.expectAnswerable) {
        retrievalTotal += 1;
        const sourcesMatch = item.expectedSources.every((s) =>
          retrievedFilenames.has(s)
        );
        const evidenceMatch = item.expectedEvidenceSubstrings.every((sub) =>
          combinedText.toLowerCase().includes(sub.toLowerCase())
        );
        if (sourcesMatch && evidenceMatch) {
          retrievalHits += 1;
        }
      }

      const citationsResolve = retrieved.every(
        (r) =>
          typeof r.filename === "string" &&
          typeof r.chunk_index === "number" &&
          typeof r.content === "string" &&
          r.content.length > 0
      );
      if (citationsResolve) citationValidCount += 1;

      const context = retrieved
        .map((r) => `[Source: ${r.filename}, Chunk ${r.chunk_index}]\n${r.content}`)
        .join("\n\n");

      const answer = await ai.generateResponse(
        context,
        item.query,
        "Answer using only the provided Context. Cite filenames when possible. If the Context does not contain the answer, explicitly say so."
      );

      console.log(`--- [${item.id}] (${item.category}) ---`);
      console.log(`Query: ${item.query}`);
      console.log(
        `Retrieved (${retrieved.length}): ${retrieved
          .map((r) => `${r.filename}#${r.chunk_index} (${Number(r.score).toFixed(3)})`)
          .join(", ")}`
      );
      console.log(`Answer: ${answer.trim()}\n`);
    }

    console.log("=== Summary ===");
    console.log(
      `Retrieval Hit@5 (answerable cases): ${retrievalHits}/${retrievalTotal}`
    );
    console.log(
      `Citation Resolution (non-empty chunk + filename): ${citationValidCount}/${dataset.length}`
    );
    console.log(
      `User Isolation (eval-user-b = 0 chunks): ${isolationPassed ? "PASS" : "FAIL"}`
    );
    console.log(
      "Answer Correctness & Grounding: Requires manual review against expectedAnswerSummary in eval/dataset.json."
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
