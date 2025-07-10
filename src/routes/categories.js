import express from "express";
import db from "../db/db.js";

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM categories").all();
        res.json({ data: rows });
    } catch {
        res.status(500).json({ error: "Failed to fetch categories." });
    }
});

router.post("/", (req, res) => {
    try {
        const { name } = req.body;
        const result = db
            .prepare("INSERT INTO categories (name) VALUES (?)")
            .run(name);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch {
        res.status(500).json({ error: "Category might already exist." });
    }
});

router.delete("/:id", (req, res) => {
    const id = req.params.id;
    try {
        const result = db
            .prepare("DELETE FROM categories WHERE id = ?")
            .run(id);
        if (result.changes === 0) {
            res.status(404).json({ error: "Category not found." });
        } else {
            res.json({ success: true });
        }
    } catch {
        res.status(500).json({ error: "Failed to delete category." });
    }
});

export default router;
