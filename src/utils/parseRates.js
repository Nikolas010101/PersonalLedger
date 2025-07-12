import { fromDdMmYyyyCompactToUnixTs } from "./dateUtils.js";

export async function fetchAndParseRateFile(url) {
    const response = await fetch(url.replace("&amp;", "&"));
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const text = await response.text();

    return parseRateCsvText(text);
}

export function parseRateCsvText(text) {
    return text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
            const [
                date,
                code,
                type,
                symbol,
                buyRate,
                sellRate,
                buyParity,
                sellParity,
            ] = line.split(";");
            return {
                date: fromDdMmYyyyCompactToUnixTs(date),
                currency: symbol,
                buying_rate: buyRate.replace(",", "."),
                selling_rate: sellRate.replace(",", "."),
            };
        });
}
