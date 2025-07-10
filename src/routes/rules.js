import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", (req, res) => {
    const rules = db.prepare("SELECT * FROM rules").all();
    res.json({ rules });
});

router.post("/", (req, res) => {
    const { pattern, category, direction } = req.body;
    if (!pattern || !category || !direction) {
        return res.status(400).json({ error: "Missing fields." });
    }
    db.prepare(
        "INSERT INTO rules (pattern, category, direction) VALUES (?, ?, ?)"
    ).run(pattern, category, direction);
    res.json({ success: true });
});

router.post("/:id/apply", (req, res) => {
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

    const info = db.prepare(query).run(...params);
    res.json({ updated: info.changes });
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
