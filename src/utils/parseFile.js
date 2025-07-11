import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { extname } from "path";
import {
    fromDdMmYyyyToUnixTs,
    fromYyyyMmDdToDdMmYyyy,
    fromDdMmYyyyDashToUnixTs,
    excelDateToUnixTs,
} from "./dateUtils.js";
import { parse } from "csv-parse/sync";

function parseXLS(filePath, db) {
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const insert = db.prepare(`
        INSERT INTO ledger (date, description, value, category, source, currency)
        VALUES (?, ?, ?, NULL, ?, ?)
        `);

    let insertedCount = 0;

    // Itaú checking account statement format
    if (
        rows?.[0]?.length === 1 &&
        rows?.[1]?.[0] === "Atualização:" &&
        rows?.[2]?.[0] === "Nome:" &&
        rows?.[3]?.[0] === "Agência:" &&
        rows?.[4]?.[0] === "Conta:"
    ) {
        console.log("itau");
        const dataRows = rows.slice(9);
        for (const row of dataRows) {
            if (row[3] !== "") {
                const rowObj = {
                    date: fromDdMmYyyyToUnixTs(row[0]),
                    description: row[1],
                    value: Math.round(row[3] * 100),
                    source: "Conta corrente - Itaú",
                    currency: "BRL",
                };
                const { date, description, value, source, currency } = rowObj;
                const result = insert.run(
                    date,
                    description,
                    value,
                    source,
                    currency
                );
                if (result.changes > 0) insertedCount++;
            }
        }
    }
    // Wise checking account statement format
    else if (rows?.[0]?.length === 21) {
        const dataRows = rows.slice(1);
        for (const row of dataRows) {
            const rowObj = {
                date: excelDateToUnixTs(row[1]),
                description: row[5],
                value: Math.round(parseFloat(row[3]) * 100),
                source: "Conta corrente - Wise",
                currency: row[4],
            };
            const { date, description, value, source, currency } = rowObj;
            if (!isNaN(date)) {
                const result = insert.run(
                    date,
                    description,
                    value,
                    source,
                    currency
                );
                if (result.changes > 0) insertedCount++;
            }
        }
    }
    return insertedCount;
}

function parseCSV(filePath, db) {
    const fileBuffer = readFileSync(filePath);
    const csvData = fileBuffer.toString();

    const rows = parse(csvData, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
    });
    const dataRows = rows.slice(1);

    const insert = db.prepare(`
        INSERT INTO ledger (date, description, value, category, source, currency)
        VALUES (?, ?, ?, NULL, ?, ?)
        `);

    let insertedCount = 0;
    // Itaú credit card statement format
    if (
        rows?.[0]?.length === 3 &&
        rows?.[0]?.[0].trim() === "data" &&
        rows?.[0]?.[1].trim() === "lançamento" &&
        rows?.[0]?.[2].trim() === "valor"
    ) {
        for (const row of dataRows) {
            if (row[2] !== "" && row[1] !== "PAGAMENTO EFETUADO") {
                const rowObj = {
                    date: fromDdMmYyyyToUnixTs(fromYyyyMmDdToDdMmYyyy(row[0])),
                    description: row[1],
                    value: Math.round(parseFloat(row[2]) * -100),
                    source: "Cartão de crédito - Itaú",
                    currency: "BRL",
                };
                const { date, description, value, source, currency } = rowObj;
                if (!isNaN(date)) {
                    const result = insert.run(
                        date,
                        description,
                        value,
                        source,
                        currency
                    );
                    if (result.changes > 0) insertedCount++;
                }
            }
        }
    }
    // Wise checking account statement format
    else if (rows?.[0]?.length === 21) {
        for (const row of dataRows) {
            const rowObj = {
                date: fromDdMmYyyyDashToUnixTs(row[1]),
                description: row[5],
                value: Math.round(parseFloat(row[3]) * 100),
                source: "Conta corrente - Wise",
                currency: row[4],
            };
            const { date, description, value, source, currency } = rowObj;
            if (!isNaN(date)) {
                const result = insert.run(
                    date,
                    description,
                    value,
                    source,
                    currency
                );
                if (result.changes > 0) insertedCount++;
            }
        }
    }
    return insertedCount;
}

export function parseFile(filePath, db, originalName) {
    const fileExt = extname(originalName).toLowerCase();
    if (fileExt === ".xls" || fileExt === ".xlsx") {
        return parseXLS(filePath, db);
    } else if (fileExt === ".csv") {
        return parseCSV(filePath, db);
    } else {
        throw new Error("Unsupported file type.");
    }
}
