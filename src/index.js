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

app.get("/charts", (req, res) => {
    res.sendFile(join(__dirname, "..", "public", "html", "charts.html"));
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
        INSERT INTO ledger (date, description, value, category, source)
        VALUES (?, ?, ?, NULL, ?)
        `);

            for (const row of dataRows) {
                if (row[3] !== "") {
                    // Assuming the 4th column is the value column
                    const rowObj = {
                        date: toUnixTs(row[0]),
                        description: row[1],
                        value: Math.round(row[3] * 100),
                        source: "Conta corrente",
                    };
                    const { date, description, value, source } = rowObj;

                    const result = insert.run(date, description, value, source);
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
                INSERT INTO ledger (date, description, value, category, source)
                VALUES (?, ?, ?, NULL, ?)
            `);

            for (const row of dataRows) {
                if (row[2] !== "") {
                    const rowObj = {
                        date: toUnixTs(formatDate(row[0])),
                        description: row[1],
                        value: Math.round(parseFloat(row[2]) * -100),
                        source: "Cartão de crédito",
                    };
                    const { date, description, value, source } = rowObj;

                    if (!isNaN(date)) {
                        const result = insert.run(
                            date,
                            description,
                            value,
                            source
                        );
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
    db.prepare(
        "INSERT INTO rules (pattern, category, direction) VALUES (?, ?, ?)"
    ).run(pattern, category, direction);
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
        const { start, end, direction, categories, source } = req.query;
        let query = "SELECT * FROM ledger";
        const conditions = [];
        const params = {};

        // Convert and filter by date range
        if (start) {
            conditions.push("date >= @start");
            params.start = Math.floor(new Date(start).getTime() / 1000);
        }
        if (end) {
            conditions.push("date <= @end");
            params.end = Math.floor(new Date(end).getTime() / 1000);
        }

        // Filter by direction
        if (direction === "debit") {
            conditions.push("value < 0");
        } else if (direction === "credit") {
            conditions.push("value > 0");
        }

        // Filter by categories
        if (categories) {
            const list = categories.split(",");
            const placeholders = list.map((_, i) => `@cat${i}`);
            list.forEach((cat, i) => (params[`cat${i}`] = cat));
            conditions.push(`category IN (${placeholders.join(",")})`);
        }

        // Filter by source
        if (source) {
            const sources = source.split(","); // allow multiple sources if comma separated
            const sourcePlaceholders = sources.map((_, i) => `@source${i}`);
            sources.forEach((src, i) => (params[`source${i}`] = src));
            conditions.push(`source IN (${sourcePlaceholders.join(",")})`);
        }

        if (conditions.length) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY date DESC";

        const rows = db.prepare(query).all(params);

        const formatted = rows.map((row) => ({
            ...row,
            value: (row.value / 100).toFixed(2),
            date: new Date(row.date * 1000).toLocaleDateString("en-GB"),
        }));

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
