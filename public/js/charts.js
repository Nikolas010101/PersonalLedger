document.addEventListener("DOMContentLoaded", () => {
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const direction = document.getElementById("direction");
    const categoryFilter = document.getElementById("categoryFilter");
    const loadChartsBtn = document.getElementById("loadCharts");

    const cashflowCtx = document
        .getElementById("cashflowChart")
        .getContext("2d");
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    let cashflowChart, pieChart;

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

    async function loadDataAndRenderCharts() {
        let url = "/ledger?";
        if (startDate.value) url += `start=${startDate.value}&`;
        if (endDate.value) url += `end=${endDate.value}&`;
        if (direction.value) url += `direction=${direction.value}&`;

        const selectedCats = Array.from(categoryFilter.selectedOptions).map(
            (o) => o.value
        );
        if (selectedCats.length) url += `categories=${selectedCats.join(",")}&`;

        const res = await fetch(url);
        const json = await res.json();
        const data = json.data;

        const byDate = {};
        const categoryByDate = {};

        data.forEach((row) => {
            if (!byDate[row.date]) {
                byDate[row.date] = 0;
                categoryByDate[row.date] = new Set();
            }
            byDate[row.date] += parseFloat(row.value);
            categoryByDate[row.date].add(row.category);
        });

        const dateLabels = Object.keys(byDate).sort((a, b) => {
            const [da, ma, ya] = a.split("/");
            const [db, mb, yb] = b.split("/");
            return (
                new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`)
            );
        });

        const dateValues = dateLabels.map((date) => byDate[date]);

        const dateCategories = dateLabels.map((date) =>
            Array.from(categoryByDate[date])
        );

        const byCategory = {};
        data.forEach((row) => {
            if (!byCategory[row.category]) byCategory[row.category] = 0;
            byCategory[row.category] += parseFloat(row.value);
        });

        const catLabels = Object.keys(byCategory);
        const catValues = catLabels.map((cat) => byCategory[cat]);

        if (cashflowChart) cashflowChart.destroy();
        if (pieChart) pieChart.destroy();

        cashflowChart = new Chart(cashflowCtx, {
            type: "bar",
            data: {
                labels: dateLabels,
                datasets: [
                    {
                        data: dateValues,
                        backgroundColor: "rgba(54, 162, 235, 0.7)",
                        borderColor: "rgba(54, 162, 235, 1)",
                        borderWidth: 1,
                        categories: dateCategories,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: "Date" },
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
    }

    loadChartsBtn.addEventListener("click", loadDataAndRenderCharts);
    loadCategories();
});
