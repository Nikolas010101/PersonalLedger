import express from "express";
import db from "../db/db.js";
import {
    fromIsoDateToUnixTs,
    fromUnixTsToDdMmYyyy,
} from "../utils/dateUtils.js";

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const { start, end, direction, categories, source, currency } =
            req.query;
        let query = `SELECT
                        l.id,
                        l.date,
                        l.description,
                        l.value AS value_fx,
                        l.category,
                        l.source,
                        l.currency,
                        CASE
                            WHEN l.currency = 'BRL' THEN l.value
                            ELSE l.value * (
                                SELECT r.buying_rate
                                FROM rates r
                                WHERE r.currency = l.currency
                                AND r.date <= l.date
                                ORDER BY r.date DESC
                                LIMIT 1
                            )
                        END AS value_brl
                    FROM ledger l
        `;
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

        if (currency && currency !== "all") {
            const list = currency.split(",");
            const placeholders = list.map((_, i) => `@crncy${i}`);
            list.forEach((crncy, i) => (params[`crncy${i}`] = crncy));
            conditions.push(`currency IN (${placeholders.join(",")})`);
        }

        if (conditions.length) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY date DESC, value ASC";

        const rows = db.prepare(query).all(params);
        const formatted = rows.map((r) => ({
            ...r,
            value_brl: (r.value_brl / 100).toFixed(2),
            value_fx: (r.value_fx / 100).toFixed(2),
            date: fromUnixTsToDdMmYyyy(r.date),
        }));

        res.json({ data: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch ledger." });
    }
});

router.get("/currencies", (req, res) => {
    try {
        const stmt = db.prepare(
            "SELECT DISTINCT currency FROM ledger ORDER BY currency ASC"
        );
        const currencies = stmt.all().map((row) => row.currency);
        res.json({ data: currencies });
    } catch (err) {
        console.error("Error fetching currencies:", err);
        res.status(500).json({ error: "Failed to fetch currencies." });
    }
});

router.get("/sources", (req, res) => {
    const sources = db
        .prepare("SELECT DISTINCT source FROM ledger ORDER BY source ASC")
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
