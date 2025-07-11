import { fromDdMmYyyyCompactToUnixTs } from "./dateUtils.js";

export async function fetchAndParseRateFile(id) {
    const url = `https://ptax.bcb.gov.br/ptax_internet/consultaBoletim.do?method=gerarCSVTodasAsMoedas&id=${id}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const text = await response.text();

    return parseRateCsvText(id, text);
}

export function parseRateCsvText(id, text) {
    return text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
            const [date, code, type, symbol, buyRate, sellRate] =
                line.split(";");
            return {
                id,
                date: fromDdMmYyyyCompactToUnixTs(date),
                currency: symbol,
                buying_rate: buyRate.replace(",", "."),
                selling_rate: sellRate.replace(",", "."),
            };
        });
}
