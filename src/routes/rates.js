import express from "express";
import db from "../db/db.js";
import { fetchAndParseRateFile } from "../utils/parseRates.js";
import { fromUnixTsToDdMmYyyy } from "../utils/dateUtils.js";

const router = express.Router();

router.post("/update", async (req, res) => {
    try {
        const url =
            "https://ptax.bcb.gov.br/ptax_internet/consultaBoletim.do?method=consultarBoletim";

        const latestRow = db
            .prepare("SELECT MAX(date) AS latest FROM rates")
            .get();

        const startDate = latestRow?.latest
            ? new Date(latestRow.latest * 1000)
            : new Date(1984, 10, 29);

        const today = new Date();
        let currentDate = new Date(startDate);

        const insertRate = db.prepare(`
            INSERT INTO rates (date, currency, buying_rate, selling_rate)
            VALUES (@date, @currency, @buying_rate, @selling_rate)
        `);

        const insertMany = db.transaction((rows) => {
            for (const rate of rows) {
                insertRate.run(rate);
            }
        });

        while (currentDate <= today) {
            const dateStr = currentDate.toLocaleDateString("pt-BR");

            const payload = new URLSearchParams({
                RadOpcao: "2",
                DATAINI: dateStr,
                DATAFIM: "",
                ChkMoeda: "61",
            });

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: payload.toString(),
                });

                const html = await response.text();
                const match = html.match(
                    /href="(\/ptax_internet\/consultaBoletim\.do[^"]*)"/
                );

                if (!match) {
                    console.warn(`No data for ${dateStr}`);
                } else {
                    const url = `https://ptax.bcb.gov.br${match[1]}`;
                    const data = await fetchAndParseRateFile(url);
                    insertMany(data);
                    console.log(`Inserted data for ${dateStr}`);
                }
            } catch (err) {
                console.error(`Failed for ${dateStr}:`, err.message);
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json({ success: true, message: "Update complete" });
    } catch (err) {
        console.error("Fatal error in /update:", err);
        res.status(500).send("Internal Server Error");
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

router.get("/currencies", (req, res) => {
    const currencies = db
        .prepare(
            "SELECT DISTINCT currency FROM rates UNION SELECT 'BRL' ORDER BY currency ASC"
        )
        .all()
        .map((row) => row.currency);

    res.json({ data: currencies });
});

router.get("/available_currencies", (req, res) => {
    try {
        const stmt = db.prepare(
            "SELECT currency FROM available_currencies ORDER BY currency ASC"
        );
        const currencies = stmt.all().map((row) => row.currency);
        res.json({ data: currencies });
    } catch (err) {
        console.error("Error fetching currencies:", err);
        res.status(500).json({ error: "Failed to fetch currencies." });
    }
});

router.post("/available_currencies", (req, res) => {
    try {
        const { currencies } = req.body;

        if (!Array.isArray(currencies) || currencies.length === 0) {
            return res
                .status(400)
                .json({ error: "Currencies must be a non-empty array." });
        }

        const insert = db.prepare(
            "INSERT OR REPLACE INTO available_currencies (currency) VALUES (?)"
        );
        const clear = db.prepare("DELETE FROM available_currencies");

        const transaction = db.transaction((newCurrencies) => {
            clear.run();
            for (const curr of newCurrencies) {
                insert.run(curr);
            }
        });

        transaction(currencies);
        res.json({ success: true });
    } catch (err) {
        console.error("Error updating currencies:", err);
        res.status(500).json({ error: "Failed to update currencies." });
    }
});

export default router;
