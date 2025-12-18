import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Storage } from "@google-cloud/storage";
import { AppConfig } from "../config.js";

export interface StorageService {
  buildObjectKey(userId: string, filename: string): string;
  generateUploadUrl(
    objectKey: string,
    contentType: string
  ): Promise<{ url: string; storageUri: string }>;
  saveLocalFile(objectKey: string, buffer: Buffer): Promise<void>;
  downloadFile(storageUri: string): Promise<Buffer>;
  deleteFile(storageUri: string): Promise<void>;
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "document";
}

export function createStorageService(cfg: AppConfig): StorageService {
  const gcsClient =
    cfg.storage.mode === "gcs"
      ? new Storage({ projectId: cfg.ai.projectId })
      : null;

  const resolveLocalPath = (objectKey: string): string => {
    const root = path.resolve(cfg.storage.localUploadDir);
    const cleaned = objectKey.replace(/^\/+/, "");
    const target = path.resolve(root, cleaned);
    if (!target.startsWith(root + path.sep) && target !== root) {
      throw new Error("Invalid object key path");
    }
    return target;
  };

  return {
    buildObjectKey(userId: string, filename: string): string {
      const safeUser = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const safeName = sanitizeFilename(filename);
      const id = crypto.randomUUID();
      return `users/${safeUser}/${id}-${safeName}`;
    },

    async generateUploadUrl(objectKey: string, contentType: string) {
      if (cfg.storage.mode === "local") {
        const encodedKey = encodeURIComponent(objectKey);
        return {
          url: `/local-upload/${encodedKey}`,
          storageUri: `local://${objectKey}`,
        };
      }

      const bucketName = cfg.storage.uploadBucket;
      if (!bucketName || !gcsClient) {
        throw new Error("UPLOAD_BUCKET is not configured for GCS storage");
      }

      const [url] = await gcsClient
        .bucket(bucketName)
        .file(objectKey)
        .getSignedUrl({
          version: "v4",
          action: "write",
          expires: Date.now() + 15 * 60 * 1000,
          contentType,
        });

      return {
        url,
        storageUri: `gs://${bucketName}/${objectKey}`,
      };
    },

    async saveLocalFile(objectKey: string, buffer: Buffer): Promise<void> {
      const filePath = resolveLocalPath(objectKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);
    },

    async downloadFile(storageUri: string): Promise<Buffer> {
      if (storageUri.startsWith("local://")) {
        const objectKey = storageUri.slice("local://".length);
        const filePath = resolveLocalPath(objectKey);
        return fs.readFile(filePath);
      }

      if (storageUri.startsWith("gs://")) {
        const withoutScheme = storageUri.slice("gs://".length);
        const slashIdx = withoutScheme.indexOf("/");
        if (slashIdx === -1) {
          throw new Error(`Invalid GCS URI: ${storageUri}`);
        }
        const bucketName = withoutScheme.slice(0, slashIdx);
        const objectKey = withoutScheme.slice(slashIdx + 1);
        const client =
          gcsClient || new Storage({ projectId: cfg.ai.projectId });
        const [buffer] = await client.bucket(bucketName).file(objectKey).download();
        return buffer;
      }

      throw new Error(`Unsupported storage URI scheme: ${storageUri}`);
    },

    async deleteFile(storageUri: string): Promise<void> {
      if (storageUri.startsWith("local://")) {
        const objectKey = storageUri.slice("local://".length);
        const filePath = resolveLocalPath(objectKey);
        await fs.rm(filePath, { force: true });
        return;
      }

      if (storageUri.startsWith("gs://")) {
        const withoutScheme = storageUri.slice("gs://".length);
        const slashIdx = withoutScheme.indexOf("/");
        if (slashIdx === -1) return;
        const bucketName = withoutScheme.slice(0, slashIdx);
        const objectKey = withoutScheme.slice(slashIdx + 1);
        const client =
          gcsClient || new Storage({ projectId: cfg.ai.projectId });
        await client
          .bucket(bucketName)
          .file(objectKey)
          .delete({ ignoreNotFound: true });
      }
    },
  };
}
