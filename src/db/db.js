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
    UNIQUE(date, description, value, source) ON CONFLICT IGNORE
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
    pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    direction TEXT DEFAULT 'all'
);
`);

export default db;
