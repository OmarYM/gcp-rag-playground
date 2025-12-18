import dotenv from "dotenv";

dotenv.config();

export type StorageMode = "local" | "gcs";
export type IngestionMode = "inline" | "pubsub";
export type AIProvider = "gemini" | "vertex";

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  db: {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
  };
  auth: {
    googleClientId?: string;
    googleRedirectUri?: string;
    devAuthBypass: boolean;
  };
  ai: {
    provider: AIProvider;
    geminiApiKey?: string;
    projectId?: string;
    region: string;
    embeddingModel: string;
    chatModel: string;
  };
  storage: {
    mode: StorageMode;
    localUploadDir: string;
    uploadBucket?: string;
  };
  ingestion: {
    mode: IngestionMode;
    processingTopic?: string;
    pubsubEmulatorHost?: string;
    pubsubPushServiceAccount?: string;
    pubsubVerificationAudience?: string;
    allowUnauthenticatedLocalPubsub: boolean;
  };
}

function parseMode<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  name: string
): T {
  if (!value) return fallback;
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(
    `Invalid ${name}="${value}". Expected one of: ${allowed.join(", ")}.`
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV || "development";
  const storageMode = parseMode(
    env.STORAGE_MODE,
    ["local", "gcs"] as const,
    env.UPLOAD_BUCKET ? "gcs" : "local",
    "STORAGE_MODE"
  );
  const ingestionMode = parseMode(
    env.INGESTION_MODE,
    ["inline", "pubsub"] as const,
    env.PROCESSING_TOPIC ? "pubsub" : "inline",
    "INGESTION_MODE"
  );
  const aiProvider = parseMode(
    env.AI_PROVIDER,
    ["gemini", "vertex"] as const,
    env.GEMINI_API_KEY ? "gemini" : "vertex",
    "AI_PROVIDER"
  );

  return {
    port: parseInt(env.PORT || "8080", 10),
    nodeEnv,
    corsOrigin: env.CORS_ORIGIN || "*",
    db: {
      user: env.DB_USER || "",
      password: env.DB_PASSWORD || "",
      host: env.DB_HOST || "localhost",
      port: parseInt(env.DB_PORT || "5432", 10),
      database: env.DB_NAME || "",
    },
    auth: {
      googleClientId: env.GOOGLE_CLIENT_ID || undefined,
      googleRedirectUri: env.GOOGLE_REDIRECT_URI || undefined,
      devAuthBypass:
        nodeEnv !== "production" && env.DEV_AUTH_BYPASS === "true",
    },
    ai: {
      provider: aiProvider,
      geminiApiKey: env.GEMINI_API_KEY || undefined,
      projectId: env.PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || undefined,
      region: env.REGION || "us-central1",
      embeddingModel:
        env.EMBEDDING_MODEL ||
        (aiProvider === "gemini" ? "gemini-embedding-001" : "text-embedding-005"),
      chatModel:
        env.CHAT_MODEL ||
        (aiProvider === "gemini"
          ? "gemini-3.8-flash"
          : "gemini-2.0-flash-lite-001"),
    },
    storage: {
      mode: storageMode,
      localUploadDir: env.LOCAL_UPLOAD_DIR || "./uploads",
      uploadBucket: env.UPLOAD_BUCKET || undefined,
    },
    ingestion: {
      mode: ingestionMode,
      processingTopic: env.PROCESSING_TOPIC || undefined,
      pubsubEmulatorHost: env.PUBSUB_EMULATOR_HOST || undefined,
      pubsubPushServiceAccount: env.PUBSUB_PUSH_SERVICE_ACCOUNT || undefined,
      pubsubVerificationAudience:
        env.PUBSUB_VERIFICATION_AUDIENCE || undefined,
      allowUnauthenticatedLocalPubsub:
        nodeEnv !== "production" &&
        env.ALLOW_UNAUTHENTICATED_LOCAL_PUBSUB === "true",
    },
  };
}

export function validateConfig(cfg: AppConfig): string[] {
  const errors: string[] = [];

  if (!cfg.db.user) errors.push("DB_USER is required");
  if (!cfg.db.database) errors.push("DB_NAME is required");
  if (!cfg.db.host) errors.push("DB_HOST is required");

  if (!cfg.auth.devAuthBypass && !cfg.auth.googleClientId) {
    errors.push(
      "GOOGLE_CLIENT_ID is required unless DEV_AUTH_BYPASS=true in non-production"
    );
  }

  if (cfg.storage.mode === "gcs" && !cfg.storage.uploadBucket) {
    errors.push("UPLOAD_BUCKET is required when STORAGE_MODE=gcs");
  }

  if (cfg.ingestion.mode === "pubsub" && !cfg.ingestion.processingTopic) {
    errors.push("PROCESSING_TOPIC is required when INGESTION_MODE=pubsub");
  }

  if (cfg.ai.provider === "gemini" && !cfg.ai.geminiApiKey) {
    errors.push("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
  }

  if (cfg.ai.provider === "vertex" && !cfg.ai.projectId) {
    errors.push("PROJECT_ID is required when AI_PROVIDER=vertex");
  }

  return errors;
}
