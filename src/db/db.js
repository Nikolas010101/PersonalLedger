import Database from "better-sqlite3";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date INTEGER NOT NULL,
    description TEXT,
    value INTEGER,
    category TEXT,
    source TEXT,
    currency TEXT NOT NULL,
    UNIQUE(date, description, value, source, currency) ON CONFLICT IGNORE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS rates (
    date INTEGER NOT NULL,
    currency TEXT NOT NULL,
    buying_rate INTEGER,
    selling_rate INTEGER,
    UNIQUE(date, currency) ON CONFLICT REPLACE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    like_pattern TEXT,
    not_like_pattern TEXT,
    lower_bound INTEGER,
    upper_bound INTEGER,
    direction TEXT DEFAULT 'all',
    update_mode TEXT DEFAULT 'empty_only',
    source TEXT DEFAULT 'all',
    currency TEXT DEFAULT 'all',
    category TEXT NOT NULL
);
`);

export default db;
