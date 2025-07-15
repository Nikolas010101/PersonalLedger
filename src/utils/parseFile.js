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

    const response = { totalCount: 0, insertedCount: 0, statementType: "" };

    // Itaú checking account statement format
    if (
        rows?.[0]?.length === 1 &&
        rows?.[1]?.[0] === "Atualização:" &&
        rows?.[2]?.[0] === "Nome:" &&
        rows?.[3]?.[0] === "Agência:" &&
        rows?.[4]?.[0] === "Conta:" &&
        rows?.[6]?.[0] === "Lançamentos"
    ) {
        response.statementType = "Conta corrente - Itaú";
        const dataRows = rows.slice(9);
        for (const row of dataRows) {
            if (row[3] !== "") {
                const rowObj = {
                    date: fromDdMmYyyyToUnixTs(row[0]),
                    description: row[1].toUpperCase(),
                    value: Math.round(row[3] * 100),
                    source: response.statementType,
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
                response.totalCount++;
                if (result.changes > 0) response.insertedCount++;
            }
        }
    } // Itaú credit card statement format
    else if (
        rows?.[0]?.length === 1 &&
        rows?.[1]?.[0] === "Atualização:" &&
        rows?.[2]?.[0] === "Nome:" &&
        rows?.[3]?.[0] === "Agência:" &&
        rows?.[4]?.[0] === "Conta:" &&
        rows?.[6]?.[0]?.includes("fatura")
    ) {
        response.statementType = "Cartão de crédito - Itaú";
        const dataRows = rows.slice(9);
        for (const row of dataRows) {
            if (
                row[0] &&
                row[0] !== "data" &&
                row[1] &&
                row[1] !== "PAGAMENTO EFETUADO" &&
                row[3]
            ) {
                const rowObj = {
                    date: fromDdMmYyyyToUnixTs(row[0]),
                    description: row[1].toUpperCase(),
                    value: -Math.round(row[3] * 100),
                    source: response.statementType,
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
                response.totalCount++;
                if (result.changes > 0) response.insertedCount++;
            }
        }
    }
    // Wise checking account statement format
    else if (rows?.[0]?.length === 21) {
        response.statementType = "Conta corrente - Wise";
        const dataRows = rows.slice(1);
        for (const row of dataRows) {
            const rowObj = {
                date: excelDateToUnixTs(row[1]),
                description: row[5].toUpperCase(),
                value: Math.round(parseFloat(row[3]) * 100),
                source: response.statementType,
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
                response.totalCount++;
                if (result.changes > 0) response.insertedCount++;
            }
        }
    }
    return response;
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

    const response = { totalCount: 0, insertedCount: 0, statementType: "" };
    // Itaú credit card statement format
    if (
        rows?.[0]?.length === 3 &&
        rows?.[0]?.[0].trim() === "data" &&
        rows?.[0]?.[1].trim() === "lançamento" &&
        rows?.[0]?.[2].trim() === "valor"
    ) {
        response.statementType = "Cartão de crédito - Itaú";
        for (const row of dataRows) {
            if (row[2] !== "" && row[1] !== "PAGAMENTO EFETUADO") {
                const rowObj = {
                    date: fromDdMmYyyyToUnixTs(fromYyyyMmDdToDdMmYyyy(row[0])),
                    description: row[1].toUpperCase(),
                    value: Math.round(parseFloat(row[2]) * -100),
                    source: response.statementType,
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
                    response.totalCount++;
                    if (result.changes > 0) response.insertedCount++;
                }
            }
        }
    }
    // Wise checking account statement format
    else if (rows?.[0]?.length === 21) {
        response.statementType = "Conta corrente - Wise";
        for (const row of dataRows) {
            const rowObj = {
                date: fromDdMmYyyyDashToUnixTs(row[1]),
                description: row[5].toUpperCase(),
                value: Math.round(parseFloat(row[3]) * 100),
                source: response.statementType,
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
                response.totalCount++;
                if (result.changes > 0) response.insertedCount++;
            }
        }
    }
    return response;
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
