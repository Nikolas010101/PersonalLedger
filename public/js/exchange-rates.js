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

    document
        .getElementById("fetchRatesBtn")
        .addEventListener("click", async (btn) => {
            const confirmed = confirm("Fetch new exchange rates from BCB?");
            if (!confirmed) return;
            btn.target.disabled = true;
            const loading = document.getElementById("loadingMessage");
            loading.style.display = "block";

            try {
                const response = await fetch("/rates/update", {
                    method: "POST",
                });

                if (response.ok) {
                    await response.json();
                    fetchRates()
                    alert("Exchange rates fetched successfully!");
                } else {
                    const err = await response.json();
                    alert(
                        "Failed to fetch exchange rates: " +
                            (err.error || "Unknown error")
                    );
                }
            } catch (error) {
                console.error("Fetch error:", error);
                alert("An error occurred while fetching exchange rates.");
            } finally {
                loading.style.display = "none";
                btn.target.disabled = false;
            }
        });

    const manageBtn = document.getElementById("manageCurrenciesBtn");
    const modal = document.getElementById("currencyModal");
    const currencyCheckboxes = document.getElementById("currencyCheckboxes");
    const currencyForm = document.getElementById("currencyForm");
    const cancelBtn = document.getElementById("cancelCurrencyBtn");

    async function fetchAllCurrencies() {
        try {
            const res = await fetch("/rates/currencies");
            if (!res.ok) throw new Error("Failed to fetch unique currencies");
            const json = await res.json();
            return json.data.filter((curr) => curr !== "BRL");
        } catch (e) {
            alert("Error loading unique currencies.");
            return [];
        }
    }

    async function fetchAvailableCurrencies() {
        try {
            const res = await fetch("/rates/available_currencies");
            if (!res.ok)
                throw new Error("Failed to fetch available currencies");
            const json = await res.json();
            return json.data;
        } catch (e) {
            alert("Error loading available currencies.");
            return [];
        }
    }

    manageBtn.addEventListener("click", async () => {
        const uniqueCurrencies = await fetchAllCurrencies();
        const availableCurrencies = await fetchAvailableCurrencies();

        currencyCheckboxes.innerHTML = "";

        uniqueCurrencies.forEach((curr) => {
            const id = `chk_${curr}`;
            const isChecked = availableCurrencies.includes(curr);
            const label = document.createElement("label");
            label.htmlFor = id;
            label.textContent = curr;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "currencies";
            checkbox.value = curr;
            checkbox.id = id;
            checkbox.checked = isChecked;

            label.prepend(checkbox);
            currencyCheckboxes.appendChild(label);
        });

        modal.style.display = "flex";

        const inputs = currencyCheckboxes.querySelectorAll(
            "input[type=checkbox]"
        );
        function updateCheckboxState() {
            const checked = [...inputs].filter((i) => i.checked);
            inputs.forEach((input) => {
                input.disabled = checked.length === 1 && input.checked;
            });
        }
        inputs.forEach((input) =>
            input.addEventListener("change", updateCheckboxState)
        );
        updateCheckboxState();
    });

    function updateCurrencyFilterOptions(currencies) {
        currencyFilter.innerHTML = "";
        currencies.forEach((curr) => {
            const opt = document.createElement("option");
            opt.value = curr;
            opt.textContent = curr;
            currencyFilter.appendChild(opt);
        });
    }

    cancelBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    currencyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const checkedCurrencies = Array.from(
            currencyCheckboxes.querySelectorAll("input[type=checkbox]:checked")
        ).map((input) => input.value);

        if (checkedCurrencies.length === 0) {
            alert("You must select at least one currency.");
            return;
        }

        try {
            const res = await fetch("/rates/available_currencies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currencies: checkedCurrencies }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save currencies.");
            }

            alert("Available currencies updated successfully!");
            modal.style.display = "none";

            updateCurrencyFilterOptions(checkedCurrencies);

            fetchRates();
        } catch (error) {
            alert("Error saving currencies: " + error.message);
        }
    });

    function updateCurrencyFilterOptions(currencies) {
        currencyFilter.innerHTML = "";
        currencies.forEach((curr) => {
            const opt = document.createElement("option");
            opt.value = curr;
            opt.textContent = curr;
            currencyFilter.appendChild(opt);
        });
    }

    async function initCurrencyFilter() {
        try {
            const availableCurrencies = await fetchAvailableCurrencies();
            if (availableCurrencies.length === 0) {
                const uniqueCurrencies = await fetchAllCurrencies();
                updateCurrencyFilterOptions(uniqueCurrencies);
            } else {
                updateCurrencyFilterOptions(availableCurrencies);
            }
        } catch (e) {
            alert("Error initializing currency filter.");
        }
    }

    initCurrencyFilter().then(() => fetchRates());
});
