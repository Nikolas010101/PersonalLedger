import db from "./db/db.js";

import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import { writeFileSync, readFileSync } from "fs";
import { dirname, join, extname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(join(__dirname, "..", "public")));

app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "..", "public", "html", "main.html"));
});

app.get("/view", (req, res) => {
    res.sendFile(join(__dirname, "..", "public", "html", "view.html"));
});

app.get("/category-manager", (req, res) => {
    res.sendFile(
        join(__dirname, "..", "public", "html", "category-manager.html")
    );
});

app.get("/rule-manager", (req, res) => {
    res.sendFile(join(__dirname, "..", "public", "html", "rule-manager.html"));
});

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
    try {
        let insertedCount = 0;
        const filePath = req.file.path;
        const fileBuffer = readFileSync(filePath);
        const fileExt = extname(req.file.originalname).toLowerCase();

        if (fileExt === ".xls") {
            const workbook = XLSX.read(fileBuffer, { type: "buffer" });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const dataRows = rows.slice(9);
            const insert = db.prepare(`
        INSERT INTO ledger (date, description, value, category)
        VALUES (?, ?, ?, NULL)
        `);

            for (const row of dataRows) {
                if (row[3] !== "") {
                    // Assuming the 4th column is the value column
                    const rowObj = {
                        date: toUnixTs(row[0]),
                        description: row[1],
                        value: Math.round(row[3] * 100),
                    };
                    const { date, description, value } = rowObj;

                    const result = insert.run(date, description, value);
                    if (result.changes > 0) {
                        insertedCount++;
                    }
                }
            }
        } else if (fileExt === ".csv") {
            const csvData = fileBuffer.toString();
            const rows = csvData.split("\n").map((row) => row.split(","));
            const dataRows = rows.slice(1);
            const insert = db.prepare(`
                INSERT INTO ledger (date, description, value, category)
                VALUES (?, ?, ?, NULL)
            `);

            for (const row of dataRows) {
                if (row[2] !== "") {
                    const rowObj = {
                        date: toUnixTs(formatDate(row[0])),
                        description: row[1],
                        value: Math.round(parseFloat(row[2]) * -100),
                    };
                    const { date, description, value } = rowObj;

                    if (!isNaN(date)) {
                        const result = insert.run(date, description, value);
                        if (result.changes > 0) {
                            insertedCount++;
                        }
                    }
                }
            }
        }
        res.json({ success: true, inserted: insertedCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Failed to process and store data.",
        });
    }
});

app.post("/categories", express.json(), (req, res) => {
    const { name } = req.body;
    try {
        const result = db
            .prepare("INSERT INTO categories (name) VALUES (?)")
            .run(name);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: "Category might already exist." });
    }
});

app.post("/set-category", express.json(), (req, res) => {
    const { id, category } = req.body;
    try {
        db.prepare("UPDATE ledger SET category = ? WHERE id = ?").run(
            category,
            id
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update category." });
    }
});

app.post("/rules", express.json(), (req, res) => {
    const { pattern, category, direction } = req.body;
    if (!pattern || !category || !direction) {
        return res
            .status(400)
            .json({ error: "Pattern, category, and direction required." });
    }
    db.prepare("INSERT INTO rules (pattern, category, direction) VALUES (?, ?, ?)").run(
        pattern,
        category,
        direction
    );
    res.json({ success: true });
});

app.post("/rules/:id/apply", (req, res) => {
    const rule = db
        .prepare("SELECT * FROM rules WHERE id = ?")
        .get(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    let query = `UPDATE ledger SET category = ? WHERE category IS NULL AND description LIKE ?`;
    const params = [rule.category, `%${rule.pattern}%`];

    if (rule.direction === "debit") {
        query += " AND value < 0";
    } else if (rule.direction === "credit") {
        query += " AND value > 0";
    }

    const stmt = db.prepare(query);
    const info = stmt.run(...params);
    res.json({ updated: info.changes });
});

app.delete("/categories/:id", (req, res) => {
    const id = req.params.id;
    try {
        const result = db
            .prepare("DELETE FROM categories WHERE id = ?")
            .run(id);
        if (result.changes === 0) {
            return res.status(404).json({ error: "Category not found." });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete category." });
    }
});

app.delete("/rules/:id", (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const stmt = db.prepare("DELETE FROM rules WHERE id = ?");
        const result = stmt.run(id);
        res.json({ success: result.changes > 0 });
    } catch (err) {
        console.error("Error deleting rule:", err);
        res.status(500).json({ error: "Failed to delete rule." });
    }
});

app.get("/ledger", (req, res) => {
    try {
        const rows = db
            .prepare("SELECT * FROM ledger ORDER BY date DESC")
            .all();

        const formatted = rows.map((row) => {
            const date = new Date(row.date * 1000); // Convert from seconds to ms
            const day = String(date.getUTCDate()).padStart(2, "0");
            const month = String(date.getUTCMonth() + 1).padStart(2, "0");
            const year = date.getUTCFullYear();
            const formattedDate = `${day}/${month}/${year}`;

            return {
                ...row,
                date: formattedDate,
                value: (row.value / 100).toFixed(2), // convert cents
            };
        });

        res.json({ data: formatted });
    } catch (err) {
        console.error("Error fetching ledger:", err);
        res.status(500).json({ error: "Failed to fetch transactions." });
    }
});

app.get("/categories", (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM categories").all();
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch categories." });
    }
});

app.get("/rules", (req, res) => {
    const rules = db.prepare("SELECT * FROM rules").all();
    res.json({ rules });
});

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

function toUnixTs(dateStr) {
    const [d, m, y] = dateStr.split("/");
    return Math.floor(new Date(`${y}-${m}-${d}T00:00:00Z`).getTime() / 1000);
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
