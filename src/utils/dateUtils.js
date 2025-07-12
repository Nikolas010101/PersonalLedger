// Converts dd/mm/yyyy to UNIX timestamp
export function fromDdMmYyyyToUnixTs(dateStr) {
    const [d, m, y] = dateStr.split("/");
    return Math.floor(new Date(`${y}-${m}-${d}T00:00:00Z`).getTime() / 1000);
}

// Converts yyyy-mm-dd to dd/mm/yyyy
export function fromYyyyMmDdToDdMmYyyy(dateStr) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

// Converts ddMMyyyy (e.g., '10072025') to UNIX timestamp
export function fromDdMmYyyyCompactToUnixTs(compactDateStr) {
    const formatted = `${compactDateStr.slice(0, 2)}/${compactDateStr.slice(
        2,
        4
    )}/${compactDateStr.slice(4, 8)}`;
    return fromDdMmYyyyToUnixTs(formatted);
}

// Converts ISO date string (yyyy-mm-dd) to UNIX timestamp
export function fromIsoDateToUnixTs(isoDateStr) {
    return Math.floor(new Date(isoDateStr).getTime() / 1000);
}

// Converts dd-mm-yyyy (e.g., '10-07-2025') to UNIX timestamp
export function fromDdMmYyyyDashToUnixTs(dateStr) {
    const [d, m, y] = dateStr.split("-");
    return Math.floor(new Date(`${y}-${m}-${d}T00:00:00Z`).getTime() / 1000);
}

// Converts UNIX timestamp to dd/mm/yyyy
export function fromUnixTsToDdMmYyyy(unixTs) {
    const date = new Date(unixTs * 1000);
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

// Converts excel date to UNIX timestamp
export function excelDateToUnixTs(excelSerial) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const unixMs = excelEpoch + excelSerial * 86400000;
    return Math.floor(unixMs / 1000);
}
