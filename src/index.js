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
                        date: row[0],
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
                        date: formatDate(row[0]),
                        description: row[1],
                        value: Math.round(parseFloat(row[2]) * -100),
                    };
                    const { date, description, value } = rowObj;

                    if (date.length === 10) {
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

app.get("/ledger", (req, res) => {
    try {
        const rows = db
            .prepare("SELECT * FROM ledger ORDER BY date DESC")
            .all();
        const formatted = rows.map((row) => ({
            ...row,
            value: (row.value / 100).toFixed(2), // convert cents
        }));
        res.json({ data: formatted });
    } catch (err) {
        console.error("Error fetching ledger:", err);
        res.status(500).json({ error: "Failed to fetch transactions." });
    }
});

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
