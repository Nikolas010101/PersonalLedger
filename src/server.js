import express from "express";

import fs from "fs";
import { fileURLToPath } from "url";
import path, { dirname, join } from "path";
import uploadRoutes from "./routes/upload.js";
import ledgerRoutes from "./routes/ledger.js";
import categoriesRoutes from "./routes/categories.js";
import rulesRoutes from "./routes/rules.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

app.use("/upload", uploadRoutes);
app.use("/ledger", ledgerRoutes);
app.use("/categories", categoriesRoutes);
app.use("/rules", rulesRoutes);

const htmlDir = join(__dirname, "..", "public", "html");

const htmlPages = fs
    .readdirSync(htmlDir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => path.basename(file, ".html"));

htmlPages.forEach((page) => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(join(__dirname, "..", "public", "html", `${page}.html`));
    });
});

// Root fallback
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "..", "public", "html", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
