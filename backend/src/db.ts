import pg from "pg";
import { loadConfig } from "./config.js";

const cfg = loadConfig();

export const pool = new pg.Pool({
  user: cfg.db.user,
  password: cfg.db.password,
  host: cfg.db.host,
  port: cfg.db.port,
  database: cfg.db.database,
});
