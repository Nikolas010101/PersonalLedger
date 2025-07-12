import express from "express";
import db from "../db/db.js";
import {
    fromIsoDateToUnixTs,
    fromUnixTsToDdMmYyyy,
} from "../utils/dateUtils.js";

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const { start, end, direction, categories, source } = req.query;
        let query = "SELECT * FROM ledger";
        const conditions = [];
        const params = {};

        if (start) {
            conditions.push("date >= @start");
            params.start = fromIsoDateToUnixTs(start);
        }
        if (end) {
            conditions.push("date <= @end");
            params.end = fromIsoDateToUnixTs(end);
        }
        if (direction === "debit") conditions.push("value < 0");
        if (direction === "credit") conditions.push("value > 0");

        if (categories) {
            const list = categories.split(",");
            const placeholders = list.map((_, i) => `@cat${i}`);
            list.forEach((cat, i) => (params[`cat${i}`] = cat));
            conditions.push(`category IN (${placeholders.join(",")})`);
        }

        if (source && source !== "all") {
            const list = source.split(",");
            const placeholders = list.map((_, i) => `@src${i}`);
            list.forEach((src, i) => (params[`src${i}`] = src));
            conditions.push(`source IN (${placeholders.join(",")})`);
        }

        if (conditions.length) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY date DESC";

        const rows = db.prepare(query).all(params);
        const formatted = rows.map((r) => ({
            ...r,
            value: (r.value / 100).toFixed(2),
            date: fromUnixTsToDdMmYyyy(r.date),
        }));

        res.json({ data: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch ledger." });
    }
});

router.get("/sources", (req, res) => {
    const sources = db
        .prepare(
            "SELECT DISTINCT source FROM ledger ORDER BY source ASC"
        )
        .all()
        .map((row) => row.source);

    res.json({ data: sources });
});

router.post("/set-category", (req, res) => {
    const { id, category } = req.body;

    try {
        const result = db
            .prepare("UPDATE ledger SET category = ? WHERE id = ?")
            .run(category, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Ledger entry not found." });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Failed to update category:", err);
        res.status(500).json({ error: "Failed to update category." });
    }
});

export default router;
