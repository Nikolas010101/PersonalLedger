document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById("category");
    const directionSelect = document.getElementById("direction");

    async function loadCategories() {
        const res = await fetch("/categories");
        const json = await res.json();
        categorySelect.innerHTML = `<option value="">Select Category to Apply</option>`;
        json.data.forEach((cat) => {
            const option = document.createElement("option");
            option.value = cat.name;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }

    const form = document.getElementById("ruleForm");
    const rulesList = document.getElementById("rulesList");

    async function loadRules() {
        const res = await fetch("/rules");
        const json = await res.json();
        rulesList.innerHTML = "";

        json.rules.forEach((rule) => {
            const li = document.createElement("li");
            li.style.marginBottom = "10px";

            li.innerHTML = `
                <div class="rule-content">
                    <div><strong>LIKE Pattern:</strong> <span>${
                        rule.like_pattern || "-"
                    }</span></div>
                    <div><strong>NOT LIKE Pattern:</strong> <span>${
                        rule.not_like_pattern || "-"
                    }</span></div>
                    <div><strong>Category:</strong> <span>${
                        rule.category
                    }</span></div>
                    <div><strong>Direction:</strong> <span>${
                        rule.direction
                    }</span></div>
                    <div><strong>Lower Bound:</strong> <span>${
                        rule.lower_bound || "-"
                    }</span></div>
                    <div><strong>Upper Bound:</strong> <span>${
                        rule.upper_bound || "-"
                    }</span></div>
                    <div><strong>Update Mode:</strong> <span>${
                        rule.update_mode
                    }</span></div>
                    <div><strong>Source:</strong> <span>${
                        rule.source
                    }</span></div>
                </div>
                <div class="rule-actions">
                    <button onclick="applyRule(${rule.id})">Apply</button>
                    <button class="delete-rule" data-id="${
                        rule.id
                    }">Delete</button>
                </div>
            `;

            rulesList.appendChild(li);
        });

        document.querySelectorAll(".delete-rule").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this rule?")) {
                    const res = await fetch(`/rules/${id}`, {
                        method: "DELETE",
                    });
                    const json = await res.json();
                    if (json.success) {
                        loadRules();
                    } else {
                        alert("Failed to delete rule.");
                    }
                }
            });
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const like_pattern = document
            .getElementById("like_pattern")
            .value.trim();
        const not_like_pattern = document
            .getElementById("not_like_pattern")
            .value.trim();
        const category = categorySelect.value.trim();
        const direction = directionSelect.value.trim();
        const update_mode = document.getElementById("update_mode").value.trim();
        const source = document.getElementById("source").value.trim();
        const lower_bound =
            parseFloat(document.getElementById("lower_bound").value) || null;
        const upper_bound =
            parseFloat(document.getElementById("upper_bound").value) || null;

        if (!like_pattern && !not_like_pattern) {
            alert("Please provide at least one pattern.");
            return;
        }

        if (!category || !direction || !update_mode || !source) return;

        await fetch("/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                like_pattern: like_pattern || null,
                not_like_pattern: not_like_pattern || null,
                category,
                direction,
                update_mode,
                source,
                lower_bound,
                upper_bound,
            }),
        });

        form.reset();
        loadRules();
    });

    window.applyRule = async (id) => {
        const res = await fetch(`/rules/${id}/apply`, { method: "POST" });
        const json = await res.json();
        alert(`Updated ${json.updated} transaction(s).`);
    };

    loadCategories();
    loadRules();
});
