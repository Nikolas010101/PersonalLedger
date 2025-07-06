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
                <td>${row.category ?? ""}</td>
            `;
            tableBody.appendChild(tr);
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
});
