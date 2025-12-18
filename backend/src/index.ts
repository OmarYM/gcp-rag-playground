import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { loadConfig, validateConfig } from "./config.js";
import { pool } from "./db.js";
import { createAIService } from "./lib/ai.js";
import { createPubSubService } from "./lib/pubsub.js";
import { createStorageService } from "./lib/storage.js";
import { createAuthMiddleware } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = loadConfig();
const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error("Configuration error(s):");
  for (const err of configErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

if (config.auth.devAuthBypass) {
  console.warn(
    "WARNING: DEV_AUTH_BYPASS=true is enabled. Do not use in production."
  );
}

async function initDb() {
  const schemaPath = path.join(__dirname, "../db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
  console.log("Database initialized successfully");
}

const app = createApp({
  config,
  pool,
  storage: createStorageService(config),
  ai: createAIService(config),
  pubsub: createPubSubService(config),
  authMiddleware: createAuthMiddleware(config),
});

initDb()
  .then(() => {
    app.listen(config.port, () => {
      console.log(
        `Server running on port ${config.port} (storage=${config.storage.mode}, ingestion=${config.ingestion.mode}, ai=${config.ai.provider})`
      );
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
