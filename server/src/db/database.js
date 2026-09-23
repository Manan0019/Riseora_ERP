import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDataDir = path.resolve(__dirname, "../../../data");
const configuredDbPath = String(process.env.RISEORA_DB_PATH || "").trim();
const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(defaultDataDir, "riseora_erp.db");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

console.log(`SQLite database connected: ${dbPath}`);

export default db;