import { createRequire } from "module";
import mammoth from "mammoth";
import pg from "pg";
import { AIService } from "./ai.js";
import { chunkText, ChunkingStrategy } from "./chunking.js";
import { StorageService } from "./storage.js";

const require = createRequire(import.meta.url);

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

export function isSupportedFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function extractTextFromBuffer(
  filename: string,
  buffer: Buffer
): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse(new Uint8Array(buffer));
    const pdfData = await parser.getText();
    return typeof pdfData === "string" ? pdfData : pdfData?.text || "";
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  throw new PermanentIngestionError(
    `Unsupported file type for "${filename}". Supported: PDF, DOCX, TXT, MD.`
  );
}

export class PermanentIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentIngestionError";
  }
}

export interface IngestionJobInput {
  documentId: string;
  userId: string;
  filename: string;
  storageUri: string;
  strategy?: ChunkingStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  pubsubMessageId?: string;
}

export interface IngestionResult {
  status: "completed" | "already_completed" | "failed";
  documentId: string;
  chunkCount: number;
  errorMessage?: string;
}

export interface IngestionDeps {
  pool: Pick<pg.Pool, "query" | "connect">;
  storage: StorageService;
  ai: AIService;
}

export async function processDocumentIngestion(
  input: IngestionJobInput,
  deps: IngestionDeps
): Promise<IngestionResult> {
  const {
    documentId,
    userId,
    filename,
    storageUri,
    strategy = "recursive",
    chunkSize = 1000,
    chunkOverlap = 200,
    minChunkSize = 30,
    pubsubMessageId,
  } = input;

  // Idempotency check for duplicate Pub/Sub deliveries
  const existing = await deps.pool.query(
    "SELECT status, pubsub_message_id FROM documents WHERE id = $1 AND user_id = $2",
    [documentId, userId]
  );

  if (existing.rowCount === 0) {
    throw new PermanentIngestionError(
      `Document ${documentId} not found for user`
    );
  }

  const currentRow = existing.rows[0];
  if (currentRow.status === "completed") {
    return {
      status: "already_completed",
      documentId,
      chunkCount: 0,
    };
  }

  await deps.pool.query(
    "UPDATE documents SET status = 'processing', error_message = NULL, pubsub_message_id = COALESCE($2, pubsub_message_id), updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [documentId, pubsubMessageId || null]
  );

  try {
    const buffer = await deps.storage.downloadFile(storageUri);
    const text = await extractTextFromBuffer(filename, buffer);

    if (!text || text.trim().length === 0) {
      throw new PermanentIngestionError(
        `No extractable text found in "${filename}".`
      );
    }

    const rawChunks = await chunkText(text, strategy, chunkSize, chunkOverlap);
    const chunks = rawChunks.filter((c) => c.trim().length >= minChunkSize);

    if (chunks.length === 0) {
      throw new PermanentIngestionError(
        `No chunks met minimum length (${minChunkSize} chars) in "${filename}".`
      );
    }

    const embeddings: number[][] = [];
    for (const chunk of chunks) {
      const emb = await deps.ai.getEmbedding(chunk, {
        taskType: "RETRIEVAL_DOCUMENT",
        title: filename,
      });
      embeddings.push(emb);
    }

    const client = await deps.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM document_chunks WHERE document_id = $1", [
        documentId,
      ]);

      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          "INSERT INTO document_chunks (document_id, content, chunk_index, embedding) VALUES ($1, $2, $3, $4)",
          [documentId, chunks[i], i, `[${embeddings[i].join(",")}]`]
        );
      }

      await client.query(
        "UPDATE documents SET status = 'completed', error_message = NULL, file_size = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [documentId, buffer.length]
      );
      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    return {
      status: "completed",
      documentId,
      chunkCount: chunks.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown ingestion failure";
    await deps.pool.query(
      "UPDATE documents SET status = 'failed', error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [documentId, message]
    );

    if (err instanceof PermanentIngestionError) {
      return {
        status: "failed",
        documentId,
        chunkCount: 0,
        errorMessage: message,
      };
    }

    throw err;
  }
}
