import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import pg from "pg";
import { AppConfig } from "./config.js";
import { AIService } from "./lib/ai.js";
import { ChunkingStrategy } from "./lib/chunking.js";
import {
  isSupportedFilename,
  PermanentIngestionError,
  processDocumentIngestion,
} from "./lib/ingestion.js";
import { IngestionMessagePayload, PubSubService } from "./lib/pubsub.js";
import { StorageService } from "./lib/storage.js";

export const MAX_FILES = 50;
export const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_QUERY_LENGTH = 2000;

export interface AppDependencies {
  config: AppConfig;
  pool: Pick<pg.Pool, "query" | "connect">;
  storage: StorageService;
  ai: AIService;
  pubsub: PubSubService;
  authMiddleware: RequestHandler;
}

export function createApp(deps: AppDependencies) {
  const { config, pool, storage, ai, pubsub, authMiddleware } = deps;
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req: Request, res: Response) => {
    res.send("Backend is running!");
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      storageMode: config.storage.mode,
      ingestionMode: config.ingestion.mode,
      aiProvider: config.ai.provider,
    });
  });

  app.get("/documents", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.sub;
      const result = await pool.query(
        "SELECT id, filename, status, error_message, created_at, updated_at, file_size FROM documents WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get(
    "/user/usage",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.sub;
        const result = await pool.query(
          "SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size FROM documents WHERE user_id = $1",
          [userId]
        );
        res.json({
          count: parseInt(result.rows[0].count || "0", 10),
          total_size: parseInt(result.rows[0].total_size || "0", 10),
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch usage" });
      }
    }
  );

  app.post(
    "/upload-url",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.sub;
        const { filename, contentType, fileSize } = req.body || {};

        if (!filename || typeof filename !== "string") {
          return res.status(400).json({ error: "filename is required" });
        }

        if (!isSupportedFilename(filename)) {
          return res.status(400).json({
            error: "Unsupported file type. Supported formats: PDF, DOCX, TXT, MD.",
          });
        }

        const incomingFileSize = fileSize ? Number(fileSize) : 0;
        if (!Number.isFinite(incomingFileSize) || incomingFileSize < 0) {
          return res.status(400).json({ error: "Invalid fileSize" });
        }

        const usageRes = await pool.query(
          "SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size FROM documents WHERE user_id = $1",
          [userId]
        );
        const count = parseInt(usageRes.rows[0].count || "0", 10);
        const totalSize = parseInt(usageRes.rows[0].total_size || "0", 10);

        if (count >= MAX_FILES) {
          return res.status(403).json({
            error: `File limit reached (${MAX_FILES} files). Please delete some files.`,
          });
        }
        if (totalSize + incomingFileSize > MAX_TOTAL_SIZE) {
          return res.status(403).json({
            error: "Storage limit reached (10MB). Cannot upload this file.",
          });
        }

        const objectKey = storage.buildObjectKey(userId, filename);
        const { url, storageUri } = await storage.generateUploadUrl(
          objectKey,
          typeof contentType === "string" && contentType
            ? contentType
            : "application/octet-stream"
        );

        return res.json({
          url,
          filename,
          objectKey,
          storageUri,
          storageMode: config.storage.mode,
        });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to generate upload URL" });
      }
    }
  );

  if (config.storage.mode === "local") {
    app.put(
      "/local-upload/:objectKey",
      authMiddleware,
      express.raw({ type: "*/*", limit: "15mb" }),
      async (req: Request, res: Response) => {
        try {
          const userId = req.user!.sub;
          const objectKey = decodeURIComponent(req.params.objectKey);
          const safeUser = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
          if (!objectKey.startsWith(`users/${safeUser}/`)) {
            return res.status(403).json({ error: "Forbidden upload target" });
          }

          const bodyBuffer = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(req.body || "");
          await storage.saveLocalFile(objectKey, bodyBuffer);
          return res.status(200).json({ ok: true, objectKey });
        } catch (err) {
          console.error(err);
          return res.status(500).json({ error: "Failed to store local file" });
        }
      }
    );
  }

  app.post(
    "/documents/ingest",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.sub;
        const {
          filename,
          storageUri,
          fileSize = 0,
          chunkingConfig,
        } = req.body || {};

        if (!filename || typeof filename !== "string") {
          return res.status(400).json({ error: "filename is required" });
        }
        if (!storageUri || typeof storageUri !== "string") {
          return res.status(400).json({ error: "storageUri is required" });
        }
        if (!isSupportedFilename(filename)) {
          return res.status(400).json({
            error: "Unsupported file type. Supported formats: PDF, DOCX, TXT, MD.",
          });
        }

        const safeUser = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
        if (
          !storageUri.includes(`/users/${safeUser}/`) &&
          !storageUri.startsWith(`local://users/${safeUser}/`)
        ) {
          return res.status(403).json({ error: "Forbidden storageUri" });
        }

        const strategy: ChunkingStrategy =
          chunkingConfig?.strategy === "fixed" ? "fixed" : "recursive";
        const chunkSize = Number(chunkingConfig?.size) || 1000;
        const chunkOverlap =
          chunkingConfig?.overlap !== undefined
            ? Number(chunkingConfig.overlap)
            : 200;
        const minChunkSize =
          chunkingConfig?.minChunkSize !== undefined
            ? Number(chunkingConfig.minChunkSize)
            : 30;

        const docRes = await pool.query(
          "INSERT INTO documents (filename, storage_uri, status, user_id, file_size) VALUES ($1, $2, 'pending', $3, $4) RETURNING id, status",
          [filename, storageUri, userId, Number(fileSize) || 0]
        );
        const documentId = docRes.rows[0].id as string;

        const payload: IngestionMessagePayload = {
          documentId,
          userId,
          filename,
          storageUri,
          strategy,
          chunkSize,
          chunkOverlap,
          minChunkSize,
        };

        if (config.ingestion.mode === "pubsub") {
          const messageId = await pubsub.publishIngestionEvent(payload);
          return res.status(202).json({
            documentId,
            status: "pending",
            mode: "pubsub",
            messageId,
          });
        }

        // Inline async mode for local development without Pub/Sub
        setImmediate(() => {
          processDocumentIngestion(payload, { pool, storage, ai }).catch(
            (err) => {
              console.error("Inline ingestion error:", err);
            }
          );
        });

        return res.status(202).json({
          documentId,
          status: "pending",
          mode: "inline",
        });
      } catch (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Failed to enqueue document ingestion" });
      }
    }
  );

  // Cloud Pub/Sub Push Subscription Webhook
  app.post("/pubsub-webhook", async (req: Request, res: Response) => {
    try {
      const authorized = await pubsub.verifyPushAuthorization(
        req.headers.authorization
      );
      if (!authorized) {
        return res.status(401).json({ error: "Unauthorized Pub/Sub push" });
      }

      const message = req.body?.message;
      if (!message || typeof message.data !== "string") {
        return res.status(400).json({ error: "Invalid Pub/Sub message format" });
      }

      let decoded: IngestionMessagePayload;
      try {
        decoded = JSON.parse(
          Buffer.from(message.data, "base64").toString("utf-8").trim()
        );
      } catch {
        return res
          .status(400)
          .json({ error: "Malformed base64 JSON in Pub/Sub message" });
      }

      if (
        !decoded.documentId ||
        !decoded.userId ||
        !decoded.filename ||
        !decoded.storageUri
      ) {
        return res.status(400).json({
          error:
            "Pub/Sub payload missing required fields (documentId, userId, filename, storageUri)",
        });
      }

      const result = await processDocumentIngestion(
        {
          ...decoded,
          pubsubMessageId: message.messageId,
        },
        { pool, storage, ai }
      );

      // Return 200 for completed, duplicate, or permanent validation failures so Pub/Sub acks the message.
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof PermanentIngestionError) {
        return res.status(200).json({ status: "failed", error: err.message });
      }
      console.error("Pub/Sub webhook transient error:", err);
      // Returning 500 signals Pub/Sub to retry with backoff.
      return res.status(500).json({ error: "Transient ingestion error" });
    }
  });

  app.post("/chat", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { query, systemInstruction, history } = req.body || {};

      if (typeof query !== "string" || query.trim().length === 0) {
        return res.status(400).json({ error: "query must be a non-empty string" });
      }

      if (query.length > MAX_QUERY_LENGTH) {
        return res.status(400).json({
          error: `Query too long. Max ${MAX_QUERY_LENGTH} characters.`,
        });
      }

      const queryEmbedding = await ai.getEmbedding(query, {
        taskType: "RETRIEVAL_QUERY",
      });

      const userId = req.user!.sub;
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
        [`[${queryEmbedding.join(",")}]`, userId]
      );

      const context = searchRes.rows
        .map(
          (r) =>
            `[Source: ${r.filename}, Chunk ${r.chunk_index}]\n${r.content}`
        )
        .join("\n\n");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`event: context\ndata: ${JSON.stringify(searchRes.rows)}\n\n`);

      const stream = ai.generateResponseStream(
        context,
        query,
        systemInstruction,
        Array.isArray(history) ? history : []
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
      }
      return res.end();
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Failed to generate answer" });
      }
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
      );
      return res.end();
    }
  });

  app.delete(
    "/documents/:id",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.sub;
        const docId = req.params.id;

        const ownerRes = await pool.query(
          "SELECT user_id, storage_uri FROM documents WHERE id = $1",
          [docId]
        );
        if (ownerRes.rowCount === 0) {
          return res.status(404).json({ error: "Document not found" });
        }
        if (ownerRes.rows[0].user_id !== userId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const storageUri = ownerRes.rows[0].storage_uri as string;
        await pool.query("DELETE FROM document_chunks WHERE document_id = $1", [
          docId,
        ]);
        await pool.query("DELETE FROM documents WHERE id = $1", [docId]);

        if (storageUri) {
          await storage.deleteFile(storageUri);
        }

        const usageRes = await pool.query(
          "SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size FROM documents WHERE user_id = $1",
          [userId]
        );
        const count = parseInt(usageRes.rows[0].count || "0", 10);
        const totalSize = parseInt(usageRes.rows[0].total_size || "0", 10);

        return res
          .status(200)
          .json({ success: true, usage: { count, total_size: totalSize } });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to delete document" });
      }
    }
  );

  return app;
}
