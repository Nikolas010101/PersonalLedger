document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.querySelector("#ratesTable tbody");
    const pagination = document.getElementById("pagination");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const currencyFilter = document.getElementById("currencyFilter");
    const applyFiltersBtn = document.getElementById("applyFilters");

    const rowsPerPage = 20;
    let data = [];
    let currentPage = 1;

    async function fetchRates() {
        const params = new URLSearchParams();

        let selectedCurrencies = Array.from(currencyFilter.selectedOptions).map(
            (opt) => opt.value
        );

        if (selectedCurrencies.length === 0) {
            selectedCurrencies = Array.from(currencyFilter.options).map(
                (opt) => opt.value
            );
        }

        if (selectedCurrencies.length > 0) {
            params.append("currencies", selectedCurrencies.join(","));
        }

        if (startDateInput.value) params.append("start", startDateInput.value);
        if (endDateInput.value) params.append("end", endDateInput.value);

        try {
            const res = await fetch(`/rates?${params.toString()}`);
            const json = await res.json();
            data = json.data;
            currentPage = 1;
            render();
        } catch (err) {
            console.error("Fetch error:", err);
        }
    }

    applyFiltersBtn.addEventListener("click", fetchRates);

    function render() {
        renderTable();
        renderPagination();
    }

    function renderTable() {
        tableBody.innerHTML = "";
        const start = (currentPage - 1) * rowsPerPage;
        const pageData = data.slice(start, start + rowsPerPage);

        if (pageData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4">No records found.</td></tr>`;
            return;
        }

        for (const row of pageData) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="text-align:left">${row.date}</td>
                <td style="text-align:left">${row.currency}</td>
                <td>${row.buying_rate || ""}</td>
                <td>${row.selling_rate || ""}</td>
            `;
            tableBody.appendChild(tr);
        }
    }

    function renderPagination() {
        pagination.innerHTML = "";
        const totalPages = Math.ceil(data.length / rowsPerPage);
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

        // First page
        createButton("1", 1, false, currentPage === 1);

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

        if (startPage > 2) createEllipsis();

        for (let i = startPage; i <= endPage; i++) {
            createButton(i, i, false, currentPage === i);
        }

        if (endPage < totalPages - 1) createEllipsis();

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

    // Initial fetch
    fetchRates();
});
