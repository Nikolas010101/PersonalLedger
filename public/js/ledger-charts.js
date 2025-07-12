document.addEventListener("DOMContentLoaded", () => {
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const directionFilter = document.getElementById("directionFilter");
    const categoryFilter = document.getElementById("categoryFilter");
    const groupBySelect = document.getElementById("groupBy");
    const currencyFilter = document.getElementById("currencyFilter");
    const sourceFilter = document.getElementById("sourceFilter");
    const loadChartsBtn = document.getElementById("loadCharts");

    const cashflowCtx = document
        .getElementById("cashflowChart")
        .getContext("2d");
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    const balanceLineChartCtx = document
        .getElementById("balanceLineChart")
        .getContext("2d");
    const incomeExpenseChartCtx = document
        .getElementById("incomeExpenseChart")
        .getContext("2d");

    let cashflowChart, pieChart, balanceLineChart, incomeExpenseChart;

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
        const sourceSelect = document.getElementById("sourceFilter");
        sourceSelect.innerHTML = `
            <option value="">All</option>
        `;
        json.data.forEach((src) => {
            const option = document.createElement("option");
            option.value = src;
            option.textContent = src;
            sourceSelect.appendChild(option);
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
            const groupBy = groupBySelect.value;

            const parseDateKey = (key) => {
                switch (groupBy) {
                    case "day":
                        const [day, month, year] = key.split("/").map(Number);
                        return new Date(year, month - 1, day);
                    case "month":
                        return new Date(key + "-01");
                    case "year":
                        return new Date(key + "-01-01");
                    case "week":
                        const [y, w] = key.split("-W").map(Number);
                        const simple = new Date(y, 0, 1 + (w - 1) * 7);
                        const dow = simple.getDay();
                        const ISOweekStart = simple;
                        if (dow <= 4)
                            ISOweekStart.setDate(
                                simple.getDate() - simple.getDay() + 1
                            );
                        else
                            ISOweekStart.setDate(
                                simple.getDate() + 8 - simple.getDay()
                            );
                        return ISOweekStart;
                    default:
                        return new Date(key);
                }
            };

            return parseDateKey(a) - parseDateKey(b);
        });

        let cumulativeBalance = 0;
        const cumulativeValues = groupLabels.map((label) => {
            cumulativeBalance += byGroup[label];
            return cumulativeBalance;
        });

        const groupValues = groupLabels.map((label) => byGroup[label]);
        const groupCategories = groupLabels.map((label) =>
            Array.from(categoriesByGroup[label])
        );

        const byCategory = {};
        data.forEach((row) => {
            if (!byCategory[row.category]) byCategory[row.category] = 0;
            byCategory[row.category] += parseFloat(row.value_brl);
        });

        let totalIncome = 0;
        let totalExpense = 0;

        data.forEach((row) => {
            const val = parseFloat(row.value_brl);
            if (val > 0) {
                totalIncome += val;
            } else {
                totalExpense += Math.abs(val);
            }
        });

        const catLabels = Object.keys(byCategory);
        const catValues = catLabels.map((cat) => byCategory[cat]);

        if (cashflowChart) cashflowChart.destroy();
        if (pieChart) pieChart.destroy();
        if (balanceLineChart) balanceLineChart.destroy();
        if (incomeExpenseChart) incomeExpenseChart.destroy();

        cashflowChart = new Chart(cashflowCtx, {
            type: "bar",
            data: {
                labels: groupLabels,
                datasets: [
                    {
                        data: groupValues,
                        backgroundColor: groupValues.map((val) =>
                            val >= 0
                                ? "rgba(76, 175, 80, 0.7)"
                                : "rgba(244, 67, 54, 0.7)"
                        ),
                        borderColor: groupValues.map((val) =>
                            val >= 0
                                ? "rgba(76, 175, 80, 1)"
                                : "rgba(244, 67, 54, 1)"
                        ),
                        borderWidth: 1,
                        categories: groupCategories,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text:
                                groupBy.charAt(0).toUpperCase() +
                                groupBy.slice(1),
                        },
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 30,
                        },
                    },
                    y: {
                        title: { display: true, text: "Amount" },
                        beginAtZero: true,
                    },
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: "Cash Flow",
                        font: {
                            size: 16,
                            weight: "bold",
                        },
                    },
                    tooltip: {
                        mode: "nearest",
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                const formattedValue = new Intl.NumberFormat(
                                    undefined,
                                    {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    }
                                ).format(value);

                                const categories =
                                    context.dataset.categories?.[
                                        context.dataIndex
                                    ];

                                if (
                                    Array.isArray(categories) &&
                                    categories.length > 1
                                ) {
                                    return `Amount: ${formattedValue}\nCategory: Multiple categories`;
                                }

                                const category = Array.isArray(categories)
                                    ? categories[0]
                                    : categories || "No category";
                                return `Amount: ${formattedValue}\nCategory: ${category}`;
                            },
                        },
                    },
                },
            },
        });

        pieChart = new Chart(pieCtx, {
            type: "pie",
            data: {
                labels: catLabels,
                datasets: [
                    {
                        data: catValues,
                        backgroundColor: catLabels.map((cat, i) => {
                            const value = catValues[i];
                            const sat = 10 + Math.random() * 90; // 10%–100% saturation
                            const light = 10 + Math.random() * 80; // 10%–90% lightness

                            if (value < 0) {
                                return `hsl(0, ${sat}%, ${light}%)`;
                            } else {
                                return `hsl(120, ${sat}%, ${light}%)`;
                            }
                        }),
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        mode: "nearest",
                        intersect: false,
                    },
                    legend: {
                        position: "bottom",
                    },
                    title: {
                        display: true,
                        text: "Income and Expenses by Category",
                        font: {
                            size: 16,
                            weight: "bold",
                        },
                    },
                },
            },
        });

        balanceLineChart = new Chart(balanceLineChartCtx, {
            type: "line",
            data: {
                labels: groupLabels,
                datasets: [
                    {
                        data: cumulativeValues,
                        fill: false,
                        borderColor: "rgba(75, 192, 192, 1)",
                        tension: 0.2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text:
                                groupBy.charAt(0).toUpperCase() +
                                groupBy.slice(1),
                        },
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 30,
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Balance",
                        },
                        grid: {
                            lineWidth: (context) => {
                                return context.tick.value === 0 ? 3 : 1;
                            },
                            color: (context) => {
                                return context.tick.value === 0
                                    ? "#000000"
                                    : "#e0e0e0";
                            },
                        },
                    },
                },
                plugins: {
                    tooltip: {
                        mode: "nearest",
                        intersect: false,
                    },
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: "Estimated Cumulative Balance Over Time",
                        font: {
                            size: 16,
                            weight: "bold",
                        },
                    },
                },
            },
        });

        incomeExpenseChart = new Chart(incomeExpenseChartCtx, {
            type: "doughnut",
            data: {
                labels: ["Income", "Expenses"],
                datasets: [
                    {
                        data: [totalIncome, totalExpense],
                        backgroundColor: ["#4caf50", "#f44336"],
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        mode: "nearest",
                        intersect: true,
                    },
                    legend: {
                        position: "bottom",
                    },
                    title: {
                        display: true,
                        text: "Income vs. Expenses",
                        font: {
                            size: 16,
                            weight: "bold",
                        },
                    },
                },
            },
        });
    }

    loadChartsBtn.addEventListener("click", loadDataAndRenderCharts);

    loadSources();
    loadCurrencies();
    loadCategories();
});
