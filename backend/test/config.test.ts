import { describe, expect, it } from "vitest";
import { loadConfig, validateConfig } from "../src/config.js";

describe("config validation", () => {
  it("reports missing required database and provider fields", () => {
    const cfg = loadConfig({
      NODE_ENV: "production",
      AI_PROVIDER: "vertex",
      STORAGE_MODE: "gcs",
      INGESTION_MODE: "pubsub",
    });
    const errors = validateConfig(cfg);
    expect(errors).toContain("DB_USER is required");
    expect(errors).toContain("DB_NAME is required");
    expect(errors).toContain("PROJECT_ID is required when AI_PROVIDER=vertex");
    expect(errors).toContain(
      "UPLOAD_BUCKET is required when STORAGE_MODE=gcs"
    );
    expect(errors).toContain(
      "PROCESSING_TOPIC is required when INGESTION_MODE=pubsub"
    );
    expect(errors).toContain(
      "GOOGLE_CLIENT_ID is required unless DEV_AUTH_BYPASS=true in non-production"
    );
  });

  it("accepts a valid local gemini configuration", () => {
    const cfg = loadConfig({
      NODE_ENV: "development",
      DB_USER: "user",
      DB_NAME: "rag_playground",
      DB_HOST: "localhost",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "fake-key",
      STORAGE_MODE: "local",
      INGESTION_MODE: "inline",
      DEV_AUTH_BYPASS: "true",
    });
    expect(validateConfig(cfg)).toEqual([]);
  });
});
