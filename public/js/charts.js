document.addEventListener("DOMContentLoaded", () => {
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const direction = document.getElementById("direction");
    const categoryFilter = document.getElementById("categoryFilter");
    const groupBySelect = document.getElementById("groupBy");
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
            const opt = document.createElement("option");
            opt.value = cat.name;
            opt.textContent = cat.name;
            categoryFilter.appendChild(opt);
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
        if (direction.value) url += `direction=${direction.value}&`;

        const selectedCats = Array.from(categoryFilter.selectedOptions).map(
            (o) => o.value
        );
        if (selectedCats.length) url += `categories=${selectedCats.join(",")}&`;

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
            byGroup[groupKey] += parseFloat(row.value);
            categoriesByGroup[groupKey].add(row.category);
        });

        const groupLabels = Object.keys(byGroup).sort();

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
            byCategory[row.category] += parseFloat(row.value);
        });

        let totalIncome = 0;
        let totalExpense = 0;

        data.forEach((row) => {
            const val = parseFloat(row.value);
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
                        backgroundColor: "rgba(54, 162, 235, 0.7)",
                        borderColor: "rgba(54, 162, 235, 1)",
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
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                const categories =
                                    context.dataset.categories?.[
                                        context.dataIndex
                                    ];

                                if (
                                    Array.isArray(categories) &&
                                    categories.length > 1
                                ) {
                                    return `Amount: ${value}\nCategories: Multiple categories`;
                                }

                                const category = Array.isArray(categories)
                                    ? categories[0]
                                    : categories || "No category";
                                return `Amount: ${value}\nCategory: ${category}`;
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
                        backgroundColor: catLabels.map(
                            () => `hsl(${Math.random() * 360}, 70%, 70%)`
                        ),
                    },
                ],
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
                    },
                },
                plugins: {
                    legend: {
                        display: false,
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
                    legend: {
                        position: "bottom",
                    },
                },
            },
        });
    }

    loadChartsBtn.addEventListener("click", loadDataAndRenderCharts);
    loadCategories();
});
