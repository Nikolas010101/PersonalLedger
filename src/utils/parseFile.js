import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { extname } from "path";
import {
    fromDdMmmToUnixTs,
    fromDdMmYyyyToUnixTs,
    fromYyyyMmDdToDdMmYyyy,
    fromDdMmYyyyDashToUnixTs,
    excelDateToUnixTs,
    isDdMmmDate,
} from "./dateUtils.js";
import { parse } from "csv-parse/sync";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

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
                    value: -Math.round(parseFloat(row[2]) * 100),
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

async function parsePDF(filePath, db) {
    const fileBuffer = readFileSync(filePath);
    const uint8Array = new Uint8Array(fileBuffer);

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;

    const insert = db.prepare(`
        INSERT INTO ledger (date, description, value, category, source, currency)
        VALUES (?, ?, ?, NULL, ?, ?)
        `);

    const response = {
            totalCount: 0,
            insertedCount: 0,
            statementType: "Cartão de crédito - Itaú",
        },
        STATE_ENUM = { date: 0, description: 1 };

    let currState,
        rowObj,
        year,
        hasEnded = false;

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        if (hasEnded) break;
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();

        const lines = textContent.items
            .map((item) => item.str)
            .filter((item) => item.trim() && item !== "-");

        for (const [index, line] of lines.entries()) {
            // Itaú credit card statement format
            if (line === "venc. da fatura") {
                const [d, m, y] = lines?.[index + 1].split("/");
                const date = new Date(y, m, d);
                date.setMonth(date.getMonth() - 1);
                year = date.getFullYear();
            }
            if (line.includes("total nacional do cartão")) {
                hasEnded = true;
                break;
            }
            if (isDdMmmDate(line)) {
                currState = STATE_ENUM.date;

                rowObj = {};
                rowObj.date = fromDdMmmToUnixTs(line, year);
            }
            if (
                !line.includes("R$") &&
                !isDdMmmDate(line) &&
                !["PAGAMENTO EFETUADO", "total da fatura anterior"].includes(
                    line
                ) &&
                currState === STATE_ENUM.date
            ) {
                currState = STATE_ENUM.description;
                rowObj.description = line.toUpperCase();
            }
            if (line.includes("R$") && currState === STATE_ENUM.description) {
                rowObj.value = -Math.round(
                    parseFloat(line.replace("R$", "").replace(",", ".")) * 100
                );
                rowObj.source = "Cartão de crédito - Itaú";
                rowObj.currency = "BRL";

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
    return response;
}

export async function parseFile(filePath, db, originalName) {
    const fileExt = extname(originalName).toLowerCase();
    if (fileExt === ".xls" || fileExt === ".xlsx") {
        return parseXLS(filePath, db);
    } else if (fileExt === ".csv") {
        return parseCSV(filePath, db);
    } else if (fileExt === ".pdf") {
        return await parsePDF(filePath, db);
    } else {
        throw new Error("Unsupported file type.");
    }
}
