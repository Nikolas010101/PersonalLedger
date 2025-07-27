import express from "express";
import multer from "multer";
import { parseFile } from "../utils/parseFile.js";
import db from "../db/db.js";
import { fromIsoDateToUnixTs } from "../utils/dateUtils.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
    try {
        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const result = await parseFile(filePath, db, originalName);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error("File parsing error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post("/manual", async (req, res) => {
    const { date, description, value, category, source, currency } = req.body;
    if (!date || !description || !value || !source || !currency) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    const dbCategory = category === "" ? null : category;
    db.prepare(
        `
        INSERT INTO ledger (date, description, value, category, source, currency)
        VALUES (?, ?, ?, ?, ?, ?)
        `
    ).run(
        fromIsoDateToUnixTs(date),
        description,
        Math.round(parseFloat(value) * 100),
        dbCategory,
        source,
        currency
    );
    res.json({ success: true });
});

export default router;
