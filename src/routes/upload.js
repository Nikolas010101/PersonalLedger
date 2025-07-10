import express from "express";
import multer from "multer";
import { parseFile } from "../utils/parseFile.js";
import db from "../db/db.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), (req, res) => {
    try {
        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const insertedCount = parseFile(filePath, db, originalName);
        res.json({ success: true, inserted: insertedCount });
    } catch (err) {
        console.error("File parsing error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
