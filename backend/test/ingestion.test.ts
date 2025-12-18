import { describe, expect, it, vi } from "vitest";
import { processDocumentIngestion } from "../src/lib/ingestion.js";
import { AIService } from "../src/lib/ai.js";
import { StorageService } from "../src/lib/storage.js";

function createMockPool(initialStatus = "pending") {
  let docStatus = initialStatus;
  let errorMessage: string | null = null;
  const insertedChunks: { content: string; index: number }[] = [];

  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("DELETE FROM document_chunks")) {
        insertedChunks.length = 0;
      } else if (sql.startsWith("INSERT INTO document_chunks")) {
        insertedChunks.push({
          content: String(params?.[1]),
          index: Number(params?.[2]),
        });
      } else if (sql.startsWith("UPDATE documents SET status = 'completed'")) {
        docStatus = "completed";
        errorMessage = null;
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };

  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("SELECT status, pubsub_message_id FROM documents")) {
        return {
          rows: [{ status: docStatus, pubsub_message_id: null }],
          rowCount: 1,
        };
      }
      if (sql.startsWith("UPDATE documents SET status = 'processing'")) {
        docStatus = "processing";
      }
      if (sql.startsWith("UPDATE documents SET status = 'failed'")) {
        docStatus = "failed";
        errorMessage = String(params?.[1] || "");
      }
      return { rows: [], rowCount: 1 };
    }),
    connect: vi.fn(async () => client),
    getState: () => ({ docStatus, errorMessage, insertedChunks }),
  };

  return pool;
}

function createMockStorage(content: string): StorageService {
  return {
    buildObjectKey: (u, f) => `users/${u}/${f}`,
    generateUploadUrl: async (k) => ({
      url: `/local-upload/${k}`,
      storageUri: `local://${k}`,
    }),
    saveLocalFile: async () => {},
    downloadFile: async () => Buffer.from(content, "utf-8"),
    deleteFile: async () => {},
  };
}

function createMockAI(failEmbedding = false): AIService {
  return {
    getEmbedding: vi.fn(async () => {
      if (failEmbedding) throw new Error("Provider timeout");
      return Array(768).fill(0.1);
    }),
    generateResponseStream: async function* () {
      yield "answer";
    },
    generateResponse: async () => "answer",
  };
}

describe("processDocumentIngestion", () => {
  it("chunks, embeds, and marks supported documents as completed", async () => {
    const pool = createMockPool();
    const res = await processDocumentIngestion(
      {
        documentId: "doc-1",
        userId: "user-1",
        filename: "notes.md",
        storageUri: "local://users/user-1/notes.md",
        chunkSize: 100,
        chunkOverlap: 20,
        minChunkSize: 10,
      },
      {
        pool: pool as never,
        storage: createMockStorage(
          "Cloud Run scales containers automatically. Direct VPC Egress connects to private Cloud SQL."
        ),
        ai: createMockAI(),
      }
    );

    expect(res.status).toBe("completed");
    expect(res.chunkCount).toBe(1);
    expect(pool.getState().docStatus).toBe("completed");
    expect(pool.getState().insertedChunks).toHaveLength(1);
  });

  it("marks unsupported file types as failed without crashing", async () => {
    const pool = createMockPool();
    const res = await processDocumentIngestion(
      {
        documentId: "doc-2",
        userId: "user-1",
        filename: "malware.exe",
        storageUri: "local://users/user-1/malware.exe",
      },
      {
        pool: pool as never,
        storage: createMockStorage("binary"),
        ai: createMockAI(),
      }
    );

    expect(res.status).toBe("failed");
    expect(res.errorMessage).toContain("Unsupported file type");
    expect(pool.getState().docStatus).toBe("failed");
  });

  it("marks empty documents as failed", async () => {
    const pool = createMockPool();
    const res = await processDocumentIngestion(
      {
        documentId: "doc-3",
        userId: "user-1",
        filename: "empty.txt",
        storageUri: "local://users/user-1/empty.txt",
      },
      {
        pool: pool as never,
        storage: createMockStorage("   \n  "),
        ai: createMockAI(),
      }
    );

    expect(res.status).toBe("failed");
    expect(res.errorMessage).toContain("No extractable text");
  });

  it("skips duplicate Pub/Sub deliveries when document is already completed", async () => {
    const pool = createMockPool("completed");
    const ai = createMockAI();
    const res = await processDocumentIngestion(
      {
        documentId: "doc-1",
        userId: "user-1",
        filename: "notes.md",
        storageUri: "local://users/user-1/notes.md",
        pubsubMessageId: "msg-123",
      },
      {
        pool: pool as never,
        storage: createMockStorage("Some content"),
        ai,
      }
    );

    expect(res.status).toBe("already_completed");
    expect(ai.getEmbedding).not.toHaveBeenCalled();
  });

  it("marks failed and rethrows on transient AI provider failure", async () => {
    const pool = createMockPool();
    await expect(
      processDocumentIngestion(
        {
          documentId: "doc-4",
          userId: "user-1",
          filename: "notes.txt",
          storageUri: "local://users/user-1/notes.txt",
          minChunkSize: 5,
        },
        {
          pool: pool as never,
          storage: createMockStorage("Valid content for embedding."),
          ai: createMockAI(true),
        }
      )
    ).rejects.toThrow("Provider timeout");

    expect(pool.getState().docStatus).toBe("failed");
    expect(pool.getState().errorMessage).toContain("Provider timeout");
  });
});
