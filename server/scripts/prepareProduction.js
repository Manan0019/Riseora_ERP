import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fail(message) {
  console.error(`\nPRODUCTION PREP STOPPED: ${message}\n`);
  process.exit(1);
}

function safeTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

function tableExists(db, tableName) {
  return Boolean(
    db
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
      `)
      .get(tableName),
  );
}

function tableCount(db, tableName) {
  if (!tableExists(db, tableName)) {
    return 0;
  }

  return Number(
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM ${tableName}`,
      )
      .get()?.count || 0,
  );
}

if (!process.argv.includes("--confirm")) {
  fail(
    [
      "This command replaces the active Riseora database with a fresh production database.",
      "A backup is created first.",
      "",
      "Stop the Riseora server, then run:",
      "npm run prepare:production -- --confirm",
    ].join("\n"),
  );
}

const initialPassword = String(
  process.env.INITIAL_ADMIN_PASSWORD || "",
);

if (
  initialPassword.length < 8 ||
  !/[A-Za-z]/.test(initialPassword) ||
  !/\d/.test(initialPassword)
) {
  fail(
    "Set INITIAL_ADMIN_PASSWORD in server/.env to a strong password of at least 8 characters containing a letter and a number.",
  );
}

if (initialPassword === "1356") {
  fail(
    "INITIAL_ADMIN_PASSWORD must not be the old development password 1356.",
  );
}

const defaultDbPath = path.resolve(
  __dirname,
  "../../data/riseora_erp.db",
);

const configuredDbPath = String(
  process.env.RISEORA_DB_PATH || "",
).trim();

const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : defaultDbPath;

const dataDir = path.dirname(dbPath);

fs.mkdirSync(
  dataDir,
  {
    recursive: true,
  },
);

const backupDir = path.join(
  dataDir,
  "production-prep-backups",
);

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

let backupPath = null;

if (fs.existsSync(dbPath)) {
  const currentDb = new Database(
    dbPath,
    {
      fileMustExist: true,
      timeout: 5000,
    },
  );

  try {
    currentDb.pragma(
      "wal_checkpoint(TRUNCATE)",
    );

    backupPath = path.join(
      backupDir,
      `riseora_erp_before_production_${safeTimestamp()}.db`,
    );

    console.log(
      `Creating backup:\n${backupPath}`,
    );

    await currentDb.backup(
      backupPath,
    );
  } catch (error) {
    currentDb.close();

    fail(
      [
        "Unable to back up the current database.",
        "Make sure the Riseora server is completely stopped.",
        error.message,
      ].join("\n"),
    );
  }

  currentDb.close();

  fs.rmSync(
    dbPath,
    {
      force: true,
    },
  );

  fs.rmSync(
    `${dbPath}-wal`,
    {
      force: true,
    },
  );

  fs.rmSync(
    `${dbPath}-shm`,
    {
      force: true,
    },
  );
}

process.env.RISEORA_DB_PATH =
  dbPath;

/*
 * Load the application database only after the
 * old database has been backed up and removed.
 */
const {
  initDatabase,
} = await import(
  "../src/db/initDatabase.js"
);

await initDatabase();

const appDb = (
  await import(
    "../src/db/database.js"
  )
).default;

const ownerCatalogCount = Number(
  appDb
    .prepare(`
      SELECT COUNT(*) AS count
      FROM items
      WHERE notes LIKE
        'Default Riseora owner catalog%'
    `)
    .get()?.count || 0,
);

const nonCatalogItemCount = Number(
  appDb
    .prepare(`
      SELECT COUNT(*) AS count
      FROM items
      WHERE notes IS NULL
         OR notes NOT LIKE
           'Default Riseora owner catalog%'
    `)
    .get()?.count || 0,
);

const cleanTables = [
  "companies",
  "suppliers",
  "customers",
  "purchases",
  "stock_transactions",
  "formulas",
  "production_batches",
  "sales_invoices",
];

const dirtyTables = cleanTables
  .map((table) => ({
    table,
    count: tableCount(
      appDb,
      table,
    ),
  }))
  .filter(
    (row) => row.count !== 0,
  );

const integrity = String(
  appDb.pragma(
    "integrity_check",
    {
      simple: true,
    },
  ),
).toLowerCase();

const foreignKeyIssues =
  appDb.pragma(
    "foreign_key_check",
  );

if (ownerCatalogCount !== 210) {
  appDb.close();

  fail(
    `Expected 210 Excel/owner-catalog items, but found ${ownerCatalogCount}. Your backup has been kept at ${backupPath || "N/A"}.`,
  );
}

if (nonCatalogItemCount !== 0) {
  appDb.close();

  fail(
    `Fresh production database unexpectedly contains ${nonCatalogItemCount} non-catalog item(s).`,
  );
}

if (dirtyTables.length > 0) {
  appDb.close();

  fail(
    `Fresh production database is not empty: ${JSON.stringify(dirtyTables)}.`,
  );
}

if (
  integrity !== "ok" ||
  foreignKeyIssues.length !== 0
) {
  appDb.close();

  fail(
    "SQLite integrity or foreign-key verification failed.",
  );
}

const admin = appDb
  .prepare(`
    SELECT
      username,
      full_name,
      role,
      is_active
    FROM users
    WHERE username = ?
    LIMIT 1
  `)
  .get(
    String(
      process.env.INITIAL_ADMIN_USERNAME ||
        "ram",
    ).trim(),
  );

appDb.close();

console.log("\n==========================================");
console.log("RISEORA PRODUCTION DATABASE IS READY");
console.log("==========================================");
console.log(`Database: ${dbPath}`);
console.log(
  `Backup: ${backupPath || "No previous database existed"}`,
);
console.log(
  `Excel/owner catalog items kept: ${ownerCatalogCount}`,
);
console.log(
  `Non-catalog/test items: ${nonCatalogItemCount}`,
);
console.log(
  "Sales / purchases / stock / formulas / production / parties: 0",
);
console.log(
  `Admin: ${admin?.username || "not found"} (${admin?.role || "-"})`,
);
console.log(
  "\nNext: start the server, sign in, and enter the real Company Master details including the company email before testing Forgot Password.\n",
);
