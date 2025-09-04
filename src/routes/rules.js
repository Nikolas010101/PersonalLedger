import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", (req, res) => {
    const rules = db.prepare("SELECT * FROM rules").all();

    const formattedRules = rules.map((rule) => ({
        ...rule,
        lower_bound: rule.lower_bound != null ? rule.lower_bound / 100 : null,
        upper_bound: rule.upper_bound != null ? rule.upper_bound / 100 : null,
    }));

    res.json({ rules: formattedRules });
});

router.post("/", (req, res) => {
    const {
        like_pattern,
        not_like_pattern,
        lower_bound,
        upper_bound,
        category,
        direction,
        update_mode,
        currency,
        source,
    } = req.body;
    if (!category || !direction || (!like_pattern && !not_like_pattern)) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    db.prepare(
        `
        INSERT INTO rules (like_pattern, not_like_pattern, lower_bound, upper_bound, category, direction, currency, source, update_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
        like_pattern,
        not_like_pattern,
        lower_bound != null ? Math.round(lower_bound * 100) : null,
        upper_bound != null ? Math.round(upper_bound * 100) : null,
        category,
        direction,
        currency,
        source,
        update_mode
    );

    res.json({ success: true });
});

router.post("/:id/apply", (req, res) => {
    const rule = db
        .prepare("SELECT * FROM rules WHERE id = ?")
        .get(req.params.id);

    if (!rule) return res.status(404).json({ error: "Rule not found" });

    let query;
    switch (rule.update_mode) {
        case "empty_only":
            query = `UPDATE ledger SET category = ? WHERE category IS NULL`;
            break;
        case "filled_only":
            query = `UPDATE ledger SET category = ? WHERE category IS NOT NULL`;
            break;
        case "all":
            query = `UPDATE ledger SET category = ? WHERE 1=1`;
            break;
        default:
            return res.status(400).json({ error: "Invalid update type." });
    }

    const params = [rule.category];

    if (rule.lower_bound !== null && rule.upper_bound !== null) {
        query += ` AND value BETWEEN ? AND ?`;
        params.push(rule.lower_bound, rule.upper_bound);
    } else if (rule.lower_bound !== null) {
        query += ` AND value >= ?`;
        params.push(rule.lower_bound);
    } else if (rule.upper_bound !== null) {
        query += ` AND value <= ?`;
        params.push(rule.upper_bound);
    }

    if (rule.like_pattern) {
        query += ` AND description LIKE ?`;
        params.push(`%${rule.like_pattern}%`);
    }

    if (rule.not_like_pattern) {
        query += ` AND description NOT LIKE ?`;
        params.push(`%${rule.not_like_pattern}%`);
    }

    if (rule.direction === "debit") {
        query += ` AND value < 0`;
    } else if (rule.direction === "credit") {
        query += ` AND value > 0`;
    }

    if (rule.currency !== "all") {
        query += ` AND currency = ?`;
        params.push(rule.currency);
    }

    if (rule.source !== "all") {
        query += ` AND source = ?`;
        params.push(rule.source);
    }

    const result = db.prepare(query).run(...params);
    res.json({ updated: result.changes });
});

router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const result = db.prepare("DELETE FROM rules WHERE id = ?").run(id);
        res.json({ success: result.changes > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete rule." });
    }
});

export default router;
