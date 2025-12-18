import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createAuthMiddleware } from "../src/middleware/auth.js";

function createTestHarness() {
  const docs = new Map<
    string,
    {
      id: string;
      filename: string;
      storage_uri: string;
      status: string;
      error_message: string | null;
      user_id: string;
      file_size: number;
    }
  >();
  const chunks: {
    document_id: string;
    chunk_index: number;
    content: string;
  }[] = [];

  docs.set("doc-user-a", {
    id: "doc-user-a",
    filename: "secret-a.txt",
    storage_uri: "gs://bucket/users/user-a/secret-a.txt",
    status: "completed",
    error_message: null,
    user_id: "user-a",
    file_size: 120,
  });
  chunks.push({
    document_id: "doc-user-a",
    chunk_index: 0,
    content: "Confidential user A fact.",
  });

  const deletedFiles: string[] = [];
  const publishedEvents: unknown[] = [];

  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM documents WHERE user_id = $1 ORDER BY")) {
        const userId = String(params?.[0]);
        return {
          rows: Array.from(docs.values()).filter((d) => d.user_id === userId),
          rowCount: 1,
        };
      }
      if (sql.includes("COUNT(*) as count")) {
        const userId = String(params?.[0]);
        const userDocs = Array.from(docs.values()).filter(
          (d) => d.user_id === userId
        );
        return {
          rows: [
            {
              count: String(userDocs.length),
              total_size: String(
                userDocs.reduce((acc, d) => acc + d.file_size, 0)
              ),
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.startsWith("INSERT INTO documents")) {
        const id = "doc-new-1";
        docs.set(id, {
          id,
          filename: String(params?.[0]),
          storage_uri: String(params?.[1]),
          status: "pending",
          error_message: null,
          user_id: String(params?.[2]),
          file_size: Number(params?.[3] || 0),
        });
        return { rows: [{ id, status: "pending" }], rowCount: 1 };
      }
      if (sql.includes("FROM document_chunks") && sql.includes("documents.user_id = $2")) {
        const userId = String(params?.[1]);
        const matching = chunks
          .map((c) => {
            const doc = docs.get(c.document_id);
            if (!doc || doc.user_id !== userId || doc.status !== "completed") {
              return null;
            }
            return {
              document_id: c.document_id,
              chunk_index: c.chunk_index,
              content: c.content,
              filename: doc.filename,
              score: 0.91,
            };
          })
          .filter(Boolean);
        return { rows: matching, rowCount: matching.length };
      }
      if (sql.startsWith("SELECT user_id, storage_uri FROM documents WHERE id = $1")) {
        const doc = docs.get(String(params?.[0]));
        return { rows: doc ? [doc] : [], rowCount: doc ? 1 : 0 };
      }
      if (sql.startsWith("DELETE FROM document_chunks")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("DELETE FROM documents WHERE id = $1")) {
        docs.delete(String(params?.[0]));
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(),
  };

  const config = loadConfig({
    NODE_ENV: "development",
    DEV_AUTH_BYPASS: "true",
    STORAGE_MODE: "gcs",
    UPLOAD_BUCKET: "test-bucket",
    INGESTION_MODE: "pubsub",
    PROCESSING_TOPIC: "test-topic",
    AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "test-key",
    DB_USER: "user",
    DB_NAME: "rag",
  });

  const app = createApp({
    config,
    pool: pool as never,
    storage: {
      buildObjectKey: (u, f) => `users/${u}/uuid-${f}`,
      generateUploadUrl: async (k) => ({
        url: `https://signed.example/${k}`,
        storageUri: `gs://test-bucket/${k}`,
      }),
      saveLocalFile: async () => {},
      downloadFile: async () => Buffer.from("sample"),
      deleteFile: async (uri) => {
        deletedFiles.push(uri);
      },
    },
    ai: {
      getEmbedding: async () => Array(768).fill(0.25),
      generateResponseStream: async function* () {
        yield "Grounded ";
        yield "answer.";
      },
      generateResponse: async () => "Grounded answer.",
    },
    pubsub: {
      publishIngestionEvent: async (payload) => {
        publishedEvents.push(payload);
        return "pubsub-msg-1";
      },
      verifyPushAuthorization: async (authHeader) =>
        authHeader === "Bearer valid-pubsub-oidc",
    },
    authMiddleware: createAuthMiddleware(config),
  });

  return { app, publishedEvents, deletedFiles };
}

describe("API integration & user isolation", () => {
  it("scopes upload keys by user and rejects unsupported extensions", async () => {
    const { app } = createTestHarness();

    const bad = await request(app)
      .post("/upload-url")
      .set("x-dev-user-id", "user-b")
      .send({ filename: "archive.zip", fileSize: 100 });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post("/upload-url")
      .set("x-dev-user-id", "user-b")
      .send({ filename: "notes.md", contentType: "text/markdown", fileSize: 100 });
    expect(ok.status).toBe(200);
    expect(ok.body.objectKey).toContain("users/user-b/");
  });

  it("publishes ingestion events to Pub/Sub on /documents/ingest", async () => {
    const { app, publishedEvents } = createTestHarness();

    const res = await request(app)
      .post("/documents/ingest")
      .set("x-dev-user-id", "user-b")
      .send({
        filename: "notes.md",
        storageUri: "gs://test-bucket/users/user-b/uuid-notes.md",
        fileSize: 256,
      });

    expect(res.status).toBe(202);
    expect(res.body.mode).toBe("pubsub");
    expect(res.body.messageId).toBe("pubsub-msg-1");
    expect(publishedEvents).toHaveLength(1);
  });

  it("enforces Pub/Sub webhook authorization", async () => {
    const { app } = createTestHarness();
    const unauth = await request(app).post("/pubsub-webhook").send({});
    expect(unauth.status).toBe(401);

    const badPayload = await request(app)
      .post("/pubsub-webhook")
      .set("Authorization", "Bearer valid-pubsub-oidc")
      .send({ message: { data: "not-valid-base64-json" } });
    expect(badPayload.status).toBe(400);
  });

  it("enforces cross-user document isolation on list, delete, and chat", async () => {
    const { app, deletedFiles } = createTestHarness();

    const listB = await request(app)
      .get("/documents")
      .set("x-dev-user-id", "user-b");
    expect(listB.status).toBe(200);
    expect(listB.body).toEqual([]);

    const delB = await request(app)
      .delete("/documents/doc-user-a")
      .set("x-dev-user-id", "user-b");
    expect(delB.status).toBe(403);

    const chatB = await request(app)
      .post("/chat")
      .set("x-dev-user-id", "user-b")
      .send({ query: "What is the confidential fact?" });
    expect(chatB.status).toBe(200);
    expect(chatB.text).not.toContain("Confidential user A fact.");

    const chatA = await request(app)
      .post("/chat")
      .set("x-dev-user-id", "user-a")
      .send({ query: "What is the confidential fact?" });
    expect(chatA.status).toBe(200);
    expect(chatA.text).toContain("Confidential user A fact.");
    expect(chatA.text).toContain("Grounded ");

    const delA = await request(app)
      .delete("/documents/doc-user-a")
      .set("x-dev-user-id", "user-a");
    expect(delA.status).toBe(200);
    expect(deletedFiles).toContain("gs://bucket/users/user-a/secret-a.txt");
  });
});
