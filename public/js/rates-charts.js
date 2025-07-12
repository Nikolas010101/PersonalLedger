document.addEventListener("DOMContentLoaded", () => {
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const currencyFilter = document.getElementById("currencyFilter");
    const loadChartsBtn = document.getElementById("loadCharts");

    const buyCtx = document.getElementById("buyChart").getContext("2d");
    const sellCtx = document.getElementById("sellChart").getContext("2d");

    let buyChart, sellChart;
    const colorMap = {};

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    startDate.value = oneYearAgo.toISOString().split("T")[0];

    async function loadAvailableCurrencies() {
        const res = await fetch("/rates/available_currencies");
        const json = await res.json();
        json.data.forEach((curr) => {
            const opt = document.createElement("option");
            opt.value = curr;
            opt.textContent = curr;
            currencyFilter.appendChild(opt);
        });
    }

    function parseDDMMYYYY(dateStr) {
        const [dd, mm, yyyy] = dateStr.split("/");
        return new Date(`${yyyy}-${mm}-${dd}`);
    }

    async function loadDataAndRenderCharts() {
        let selected = Array.from(currencyFilter.selectedOptions).map(
            (opt) => opt.value
        );
        if (selected.length === 0) {
            selected = Array.from(currencyFilter.options).map(
                (opt) => opt.value
            );
        }

        const params = new URLSearchParams();
        params.append("currencies", selected.join(","));
        if (startDate.value) params.append("start", startDate.value);
        if (endDate.value) params.append("end", endDate.value);

        const res = await fetch(`/rates?${params.toString()}`);
        const json = await res.json();
        const data = json.data;

        const ratesByCurrency = {};
        data.forEach((entry) => {
            if (!ratesByCurrency[entry.currency]) {
                ratesByCurrency[entry.currency] = [];
            }
            ratesByCurrency[entry.currency].push(entry);
        });

        const allDates = [...new Set(data.map((d) => d.date))].sort(
            (a, b) => parseDDMMYYYY(a) - parseDDMMYYYY(b)
        );

        const buyDatasets = [];
        const sellDatasets = [];

        Object.entries(ratesByCurrency).forEach(([currency, records]) => {
            const dateMap = Object.fromEntries(records.map((r) => [r.date, r]));

            if (!colorMap[currency]) {
                colorMap[currency] = getRandomColor();
            }

            const datasetColor = colorMap[currency];

            buyDatasets.push({
                label: currency,
                data: allDates.map((d) => dateMap[d]?.buying_rate ?? null),
                borderColor: datasetColor,
                backgroundColor: datasetColor,
                tension: 0.2,
            });

            sellDatasets.push({
                label: currency,
                data: allDates.map((d) => dateMap[d]?.selling_rate ?? null),
                borderColor: datasetColor,
                backgroundColor: datasetColor,
                tension: 0.2,
            });
        });

        if (buyChart) buyChart.destroy();
        if (sellChart) sellChart.destroy();

        const commonOptions = (title) => ({
            responsive: true,
            maintainAspectRatio: false,
            resize: true,
            plugins: {
                tooltip: {
                    mode: "nearest",
                    intersect: false,
                },
                title: {
                    display: true,
                    text: title,
                    font: { size: 16, weight: "bold" },
                },
                legend: {
                    display: true,
                    position: "bottom",
                },
            },
            scales: {
                x: {
                    title: { display: true, text: "Date" },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10,
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: title.includes("Buying")
                            ? "Buying Rate"
                            : "Selling Rate",
                    },
                },
            },
        });

        buyChart = new Chart(buyCtx, {
            type: "line",
            data: { labels: allDates, datasets: buyDatasets },
            options: commonOptions("Buying Rate Over Time"),
        });

        sellChart = new Chart(sellCtx, {
            type: "line",
            data: { labels: allDates, datasets: sellDatasets },
            options: commonOptions("Selling Rate Over Time"),
        });
    }

    function getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 50%)`;
    }

    loadAvailableCurrencies();
    loadChartsBtn.addEventListener("click", loadDataAndRenderCharts);
});
