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
    date TEXT,
    description TEXT,
    value INTEGER,
    category TEXT,
    UNIQUE(date, description, value) ON CONFLICT IGNORE
  );
`);

export default db;
