document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById("category");
    const directionSelect = document.getElementById("direction");

    async function loadCategories() {
        const res = await fetch("/categories");
        const json = await res.json();
        categorySelect.innerHTML = `<option value="">Select Category</option>`;
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
                    <div><strong>Pattern:</strong> <span>${rule.pattern}</span></div>
                    <div><strong>Category:</strong> <span>${rule.category}</span></div>
                    <div><strong>Direction:</strong> <span>${rule.direction}</span></div>
                </div>
                <div class="rule-actions">
                    <button onclick="applyRule(${rule.id})">Apply</button>
                    <button class="delete-rule" data-id="${rule.id}">Delete</button>
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
        const pattern = document.getElementById("pattern").value.trim();
        const category = document.getElementById("category").value.trim();
        const direction = document.getElementById("direction").value.trim();
        if (!pattern || !category || !direction) return;

        await fetch("/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pattern, category, direction }),
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
