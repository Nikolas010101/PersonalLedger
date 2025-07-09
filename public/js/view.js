document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.querySelector("#dataTable tbody");
    const searchInput = document.querySelector("#searchInput");
    const pagination = document.getElementById("pagination");

    const rowsPerPage = 10;
    let data = [];
    let filtered = [];
    let currentPage = 1;

    fetch("/ledger")
        .then((res) => res.json())
        .then((json) => {
            data = json.data;
            filtered = data;
            render();
        })
        .catch((err) => console.error("Fetch error:", err));

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        filtered = data.filter((row) =>
            Object.values(row).some((val) =>
                String(val).toLowerCase().includes(query)
            )
        );
        currentPage = 1;
        render();
    });

    function render() {
        renderTable();
        renderPagination();
        populateCategories();
    }

    function renderTable() {
        tableBody.innerHTML = "";
        const start = (currentPage - 1) * rowsPerPage;
        const pageData = filtered.slice(start, start + rowsPerPage);

        if (pageData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4">No records found.</td></tr>`;
            return;
        }

        pageData.forEach((row) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.date}</td>
                <td>${row.description}</td>
                <td style="text-align: right;">${parseFloat(
                    row.value
                ).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                })}</td>
                <td>
                    <select data-id="${row.id}" class="category-select">
                        <option value="">-- Select --</option>
                    </select>
                </td>
                <td>${row.source || ""}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    async function populateCategories() {
        const res = await fetch("/categories");
        const { data: categories } = await res.json();

        document.querySelectorAll(".category-select").forEach((select) => {
            const rowId = select.getAttribute("data-id");
            const currentCategory =
                data.find((d) => d.id == rowId)?.category ?? "";

            categories.forEach((cat) => {
                const opt = document.createElement("option");
                opt.value = cat.name;
                opt.textContent = cat.name;
                if (cat.name === currentCategory) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener("change", async (e) => {
                await fetch("/set-category", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: rowId,
                        category: e.target.value,
                    }),
                });
            });
        });
    }

    function renderPagination() {
        pagination.innerHTML = "";
        const totalPages = Math.ceil(filtered.length / rowsPerPage);
        if (totalPages <= 1) return;

        const createButton = (
            label,
            page,
            isDisabled = false,
            isActive = false
        ) => {
            const btn = document.createElement("button");
            btn.textContent = label;

            btn.disabled = isDisabled || isActive;

            if (isActive) btn.classList.add("active");

            if (!btn.disabled) {
                btn.addEventListener("click", () => {
                    currentPage = page;
                    render();
                });
            }

            pagination.appendChild(btn);
        };

        const createEllipsis = () => {
            const span = document.createElement("span");
            span.textContent = "...";
            span.classList.add("ellipsis");
            pagination.appendChild(span);
        };

        const maxButtons = 5;
        const half = Math.floor(maxButtons / 2);

        // Prev
        createButton("«", currentPage - 1, currentPage === 1);

        // Page range calc
        let startPage = Math.max(2, currentPage - half);
        let endPage = Math.min(totalPages - 1, currentPage + half);

        if (currentPage <= half) {
            startPage = 2;
            endPage = Math.min(totalPages - 1, maxButtons);
        }

        if (currentPage + half >= totalPages) {
            startPage = Math.max(2, totalPages - maxButtons + 1);
            endPage = totalPages - 1;
        }

        // First
        createButton("1", 1, false, currentPage === 1);
        if (startPage > 2) createEllipsis();

        // Middle
        for (let i = startPage; i <= endPage; i++) {
            createButton(i, i, false, currentPage === i);
        }

        if (endPage < totalPages - 1) createEllipsis();

        // Last
        if (totalPages > 1) {
            createButton(
                totalPages,
                totalPages,
                false,
                currentPage === totalPages
            );
        }

        // Next
        createButton("»", currentPage + 1, currentPage === totalPages);
    }

    document.getElementById("exportBtn").addEventListener("click", async () => {
        try {
            const res = await fetch("/ledger");
            const { data } = await res.json();

            if (!data || !data.length) {
                alert("No data available to download.");
                return;
            }

            const headers = ["Date", "Description", "Value", "Category", "Source"];
            const rows = data.map((item) => [
                item.date,
                item.description || "",
                item.value,
                item.category || "",
                item.source || "",
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map((r) =>
                    r
                        .map(
                            (val) =>
                                `"${String(val).replace(/"/g, '""').trim()}"`
                        )
                        .join(",")
                ),
            ].join("\n");

            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "all-transactions.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            console.error("Failed to download CSV:", err);
            alert("An error occurred while downloading the CSV.");
        }
    });
});
