document.addEventListener("DOMContentLoaded", () => {
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const directionFilter = document.getElementById("directionFilter");
    const categoryFilter = document.getElementById("categoryFilter");
    const groupBySelect = document.getElementById("groupBy");
    const currencyFilter = document.getElementById("currencyFilter");
    const sourceFilter = document.getElementById("sourceFilter");
    const loadChartsBtn = document.getElementById("loadCharts");

    const cashflowDiv = document.getElementById("cashflowChart");
    const pieDiv = document.getElementById("pieChart");
    const balanceLineDiv = document.getElementById("balanceLineChart");
    const incomeExpenseDiv = document.getElementById("incomeExpenseChart");

    async function loadCategories() {
        const res = await fetch("/categories");
        const json = await res.json();
        json.data.forEach((cat) => {
            const option = document.createElement("option");
            option.value = cat.name;
            option.textContent = cat.name;
            categoryFilter.appendChild(option);
        });
    }

    async function loadSources() {
        const res = await fetch("/ledger/sources");
        const json = await res.json();
        sourceFilter.innerHTML = `<option value="">All</option>`;
        json.data.forEach((src) => {
            const option = document.createElement("option");
            option.value = src;
            option.textContent = src;
            sourceFilter.appendChild(option);
        });
    }

    async function loadCurrencies() {
        const res = await fetch("/ledger/currencies");
        const json = await res.json();
        json.data.forEach((src) => {
            const option = document.createElement("option");
            option.value = src;
            option.textContent = src;
            currencyFilter.appendChild(option);
        });
    }

    function getGroupKey(dateStr, groupBy) {
        const [day, month, year] = dateStr.split("/").map(Number);
        const date = new Date(year, month - 1, day);

        switch (groupBy) {
            case "week":
                return getISOWeekYearKey(date);
            case "month":
                return `${year}-${String(month).padStart(2, "0")}`;
            case "year":
                return `${year}`;
            case "day":
            default:
                return dateStr;
        }
    }

    function getISOWeekYearKey(date) {
        const target = new Date(date.valueOf());
        const dayNr = (date.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
        }
        const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
        const year = date.getFullYear();
        return `${year}-W${String(weekNumber).padStart(2, "0")}`;
    }

    async function loadDataAndRenderCharts() {
        let url = "/ledger?";
        if (startDate.value) url += `start=${startDate.value}&`;
        if (endDate.value) url += `end=${endDate.value}&`;
        if (directionFilter.value) url += `direction=${directionFilter.value}&`;

        if (sourceFilter.value)
            url += `source=${encodeURIComponent(sourceFilter.value)}&`;

        const selectedCats = Array.from(categoryFilter.selectedOptions).map(
            (o) => o.value
        );
        if (selectedCats.length) url += `categories=${selectedCats.join(",")}&`;

        const selectedCurrencies = Array.from(
            currencyFilter.selectedOptions
        ).map((o) => o.value);
        if (selectedCurrencies.length)
            url += `currency=${selectedCurrencies.join(",")}&`;

        const groupBy = groupBySelect.value;

        const res = await fetch(url);
        const json = await res.json();
        const data = json.data;

        const byGroup = {};
        const categoriesByGroup = {};

        data.forEach((row) => {
            const groupKey = getGroupKey(row.date, groupBy);
            if (!byGroup[groupKey]) {
                byGroup[groupKey] = 0;
                categoriesByGroup[groupKey] = new Set();
            }
            byGroup[groupKey] += parseFloat(row.value_brl);
            categoriesByGroup[groupKey].add(row.category);
        });

        const groupLabels = Object.keys(byGroup).sort((a, b) => {
            const parseDateKey = (key) => {
                switch (groupBy) {
                    case "day": {
                        const [day, month, year] = key.split("/").map(Number);
                        return new Date(year, month - 1, day);
                    }
                    case "month":
                        return new Date(key + "-01");
                    case "year":
                        return new Date(key + "-01-01");
                    case "week": {
                        const [y, w] = key.split("-W").map(Number);
                        const simple = new Date(y, 0, 1 + (w - 1) * 7);
                        const dow = simple.getDay();
                        if (dow <= 4)
                            simple.setDate(
                                simple.getDate() - simple.getDay() + 1
                            );
                        else
                            simple.setDate(
                                simple.getDate() + 8 - simple.getDay()
                            );
                        return simple;
                    }
                    default:
                        return new Date(key);
                }
            };
            return parseDateKey(a) - parseDateKey(b);
        });

        const groupValues = groupLabels.map((label) => byGroup[label]);
        const groupCategories = groupLabels.map((label) =>
            Array.from(categoriesByGroup[label])
        );

        let cumulativeBalance = 0;
        const cumulativeValues = groupLabels.map((label) => {
            cumulativeBalance += byGroup[label];
            return cumulativeBalance;
        });

        const byCategory = {};
        data.forEach((row) => {
            if (!byCategory[row.category]) byCategory[row.category] = 0;
            byCategory[row.category] += parseFloat(row.value_brl);
        });

        let totalIncome = 0;
        let totalExpense = 0;

        data.forEach((row) => {
            const val = parseFloat(row.value_brl);
            if (val > 0) totalIncome += val;
            else totalExpense += Math.abs(val);
        });

        const cashflowColors = groupValues.map((val) =>
            val >= 0 ? "rgba(76, 175, 80, 0.7)" : "rgba(244, 67, 54, 0.7)"
        );

        const cashflowBorderColors = groupValues.map((val) =>
            val >= 0 ? "rgba(76, 175, 80, 1)" : "rgba(244, 67, 54, 1)"
        );

        const cashflowText = groupValues.map((val, idx) => {
            const categories = groupCategories[idx];
            let catText = "No category";
            if (categories.length === 1) catText = categories[0];
            else if (categories.length > 1) catText = "Multiple categories";
            return `Amount: ${val.toFixed(2)}<br>Category: ${catText}`;
        });

        const cashflowTrace = {
            x: groupLabels,
            y: groupValues,
            type: "bar",
            marker: {
                color: cashflowColors,
                line: {
                    color: cashflowBorderColors,
                    width: 1,
                },
            },
            hovertemplate:
                "%{x}<br>Amount: %{y:,.2f}<br>%{customdata}<extra></extra>",
            customdata: groupCategories.map((cats) => {
                if (cats.length === 1) return cats[0];
                if (cats.length > 1) return "Multiple categories";
                return "No category";
            }),
        };

        const cashflowLayout = {
            title: {
                text: "Cash Flow",
                font: { size: 16, family: "Arial, sans-serif" },
            },
            xaxis: {
                title: groupBy.charAt(0).toUpperCase() + groupBy.slice(1),
                tickangle: -45,
                tickmode: "auto",
                nticks: 10,
            },
            yaxis: {
                title: "Amount",
                zeroline: true,
            },
            margin: { t: 40, b: 80 },
            showlegend: false,
            autosize: true,
        };

        Plotly.newPlot(cashflowDiv, [cashflowTrace], cashflowLayout, {
            responsive: true,
            displayModeBar: false,
        });

        const adjustedByCategory = {};
        const isIncomeMap = {};

        data.forEach((row) => {
            const val = parseFloat(row.value_brl);
            const absVal = Math.abs(val);
            if (!adjustedByCategory[row.category])
                adjustedByCategory[row.category] = 0;
            adjustedByCategory[row.category] += absVal;

            if (!(row.category in isIncomeMap)) isIncomeMap[row.category] = 0;
            isIncomeMap[row.category] += val;
        });

        const unifiedCatLabels = Object.keys(adjustedByCategory);
        const unifiedCatValues = unifiedCatLabels.map(
            (cat) => adjustedByCategory[cat]
        );

        const unifiedColors = unifiedCatLabels.map((cat) => {
            const net = isIncomeMap[cat];
            const hue = net >= 0 ? 120 : 0;
            const sat = 40 + Math.random() * 40;
            const light = 40 + Math.random() * 40;
            return `hsl(${hue}, ${sat}%, ${light}%)`;
        });

        const unifiedPieTrace = {
            labels: unifiedCatLabels,
            values: unifiedCatValues,
            type: "pie",
            marker: { colors: unifiedColors },
            textinfo: "label+percent",
            hoverinfo: "label+value+percent",
        };

        const unifiedPieLayout = {
            title: {
                text: "Income and Expenses by Category (Combined)",
                font: { size: 16, family: "Arial, sans-serif" },
            },
            legend: {
                orientation: "h",
                y: -0.6,
                yanchor: "top",
                x: 0.5,
                xanchor: "center",
            },
            margin: { t: 40, b: 40 },
            autosize: true,
        };

        Plotly.newPlot(pieDiv, [unifiedPieTrace], unifiedPieLayout, {
            responsive: true,
            displayModeBar: false,
        });

        const balanceTrace = {
            x: groupLabels,
            y: cumulativeValues,
            type: "scatter",
            mode: "lines+markers",
            line: {
                color: "rgba(75, 192, 192, 1)",
                shape: "spline",
                smoothing: 0.2,
            },
            marker: { size: 6 },
            hovertemplate: "%{x}<br>Balance: %{y:,.2f}<extra></extra>",
        };

        const balanceLayout = {
            title: {
                text: "Estimated Cumulative Balance Over Time",
                font: { size: 16, family: "Arial, sans-serif" },
            },
            xaxis: {
                title: groupBy.charAt(0).toUpperCase() + groupBy.slice(1),
                tickangle: -45,
                nticks: 10,
            },
            yaxis: {
                title: "Balance",
                zeroline: true,
                zerolinewidth: 3,
                zerolinecolor: "#000",
            },
            margin: { t: 40, b: 80 },
            showlegend: false,
            autosize: true,
        };

        Plotly.newPlot(balanceLineDiv, [balanceTrace], balanceLayout, {
            responsive: true,
            displayModeBar: false,
        });

        const doughnutTrace = {
            labels: ["Income", "Expenses"],
            values: [totalIncome, totalExpense],
            type: "pie",
            hole: 0.5,
            marker: { colors: ["#4caf50", "#f44336"] },
            textinfo: "label+value",
            hoverinfo: "label+value+percent",
        };

        const doughnutLayout = {
            title: {
                text: "Income vs. Expenses",
                font: { size: 16, family: "Arial, sans-serif" },
            },
            legend: { orientation: "h", y: -0.2, x: 0.5, xanchor: "center" },
            margin: { t: 40, b: 40 },
            autosize: true,
        };

        Plotly.newPlot(incomeExpenseDiv, [doughnutTrace], doughnutLayout, {
            responsive: true,
            displayModeBar: false,
        });
    }

    loadChartsBtn.addEventListener("click", loadDataAndRenderCharts);

    loadSources();
    loadCurrencies();
    loadCategories();
});
