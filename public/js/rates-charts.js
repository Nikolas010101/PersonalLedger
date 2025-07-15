document.addEventListener("DOMContentLoaded", () => {
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const currencyFilter = document.getElementById("currencyFilter");
    const loadChartsBtn = document.getElementById("loadCharts");

    const buyChartDiv = document.getElementById("buyChart");
    const sellChartDiv = document.getElementById("sellChart");

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

    function getTickVals(dates) {
        const maxTicks = 10;
        if (dates.length <= maxTicks) return dates;
        const step = Math.ceil(dates.length / maxTicks);
        return dates.filter((_, i) => i % step === 0);
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

        const buyTraces = [];
        const sellTraces = [];

        Object.entries(ratesByCurrency).forEach(([currency, records]) => {
            const dateMap = Object.fromEntries(records.map((r) => [r.date, r]));

            if (!colorMap[currency]) {
                colorMap[currency] = getRandomColor();
            }

            const datasetColor = colorMap[currency];

            const buyData = allDates.map(
                (d) => dateMap[d]?.buying_rate ?? null
            );
            const sellData = allDates.map(
                (d) => dateMap[d]?.selling_rate ?? null
            );

            buyTraces.push({
                x: allDates,
                y: buyData,
                mode: "lines+markers",
                name: currency,
                line: { color: datasetColor },
                connectgaps: false,
            });

            sellTraces.push({
                x: allDates,
                y: sellData,
                mode: "lines+markers",
                name: currency,
                line: { color: datasetColor },
                connectgaps: false,
            });
        });

        const layoutTemplate = (title, yTitle) => ({
            title,
            autosize: true,
            xaxis: {
                title: "Date",
                tickmode: "array",
                tickvals: getTickVals(allDates),
                ticktext: getTickVals(allDates),
                tickangle: -45,
            },
            yaxis: {
                title: yTitle,
            },
            legend: {
                orientation: "h",
                x: 0,
                y: -0.3,
            },
            margin: {
                t: 50,
                r: 30,
                b: 80,
                l: 60,
            },
        });

        Plotly.newPlot(
            buyChartDiv,
            buyTraces,
            layoutTemplate("Buying Rate Over Time", "Buying Rate"),
            { responsive: true }
        );
        Plotly.newPlot(
            sellChartDiv,
            sellTraces,
            layoutTemplate("Selling Rate Over Time", "Selling Rate"),
            { responsive: true }
        );
    }

    function getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 50%)`;
    }

    loadAvailableCurrencies();
    loadChartsBtn.addEventListener("click", loadDataAndRenderCharts);
});
