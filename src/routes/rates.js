import express from "express";
import db from "../db/db.js";
import { fetchAndParseRateFile } from "../utils/parseRates.js";
import { fromUnixTsToDdMmYyyy } from "../utils/dateUtils.js";

const router = express.Router();

router.post("/update", async (req, res) => {
    try {
        const row = db.prepare("SELECT MAX(id) as maxId FROM rates").get();
        let maxId = row.maxId || 1;

        const BATCH_SIZE = 1000;
        const MAX_ID = maxId + 10000;
        const CONSECUTIVE_ERROR_LIMIT = 100;

        const insertRate = db.prepare(`
            INSERT INTO rates (id, date, currency, buying_rate, selling_rate)
            VALUES (@id, @date, @currency, @buying_rate, @selling_rate)
        `);
        const insertMany = db.transaction((rates) => {
            for (const rate of rates) {
                insertRate.run(rate);
            }
        });

        let consecutiveErrors = 0;

        for (let i = maxId; i <= MAX_ID; i += BATCH_SIZE) {
            const ids = Array.from({ length: BATCH_SIZE }, (_, j) => i + j);

            const results = await Promise.allSettled(
                ids.map((id) =>
                    fetchAndParseRateFile(id).catch((err) => {
                        console.error(
                            `Fetch failed for id ${id}:`,
                            err.message
                        );
                        return null;
                    })
                )
            );

            const allRates = [];
            for (const result of results) {
                if (result.status === "fulfilled" && result.value) {
                    allRates.push(...result.value);
                } else {
                    consecutiveErrors++;
                }
            }

            if (allRates.length > 0) {
                insertMany(allRates);
                consecutiveErrors = 0;
            }

            if (consecutiveErrors >= CONSECUTIVE_ERROR_LIMIT) {
                console.warn("Too many consecutive errors. Stopping early.");
                break;
            }
        }

        res.json({ res: "done" });
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/", (req, res) => {
    try {
        const { currencies, start, end } = req.query;

        const filters = [];
        const params = {};

        if (currencies) {
            const list = currencies
                .split(",")
                .map((c) => c.trim().toUpperCase());
            filters.push(
                `currency IN (${list.map((_, i) => `@c${i}`).join(", ")})`
            );
            list.forEach((curr, i) => {
                params[`c${i}`] = curr;
            });
        }

        if (start) {
            const startDate = new Date(start);
            if (!isNaN(startDate)) {
                filters.push(`date >= @start`);
                params.start = Math.floor(startDate.getTime() / 1000);
            }
        }

        if (end) {
            const endDate = new Date(end);
            if (!isNaN(endDate)) {
                filters.push(`date <= @end`);
                params.end = Math.floor(endDate.getTime() / 1000);
            }
        }

        const whereClause =
            filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const query = `SELECT * FROM rates ${whereClause} ORDER BY date DESC, currency ASC`;

        const rows = db.prepare(query).all(params);

        const formatted = rows.map((row) => ({
            ...row,
            date: fromUnixTsToDdMmYyyy(row.date),
        }));

        res.json({ data: formatted });
    } catch (error) {
        console.error("Failed to fetch rates:", error);
        res.status(500).json({ error: "Failed to fetch rates" });
    }
});

export default router;
