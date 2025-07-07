async function loadCategories() {
    const res = await fetch("/categories");
    const json = await res.json();
    const list = document.getElementById("categoryList");
    list.innerHTML = "";

    json.data.forEach((cat) => {
        const li = document.createElement("li");
        li.textContent = cat.name + " ";

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.style.marginLeft = "10px";
        delBtn.addEventListener("click", async () => {
            if (confirm(`Delete category "${cat.name}"?`)) {
                const response = await fetch(`/categories/${cat.id}`, {
                    method: "DELETE",
                });
                const result = await response.json();
                if (!response.ok) {
                    alert(result.error || "Failed to delete category.");
                }
                loadCategories();
            }
        });

        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

document
    .getElementById("addCategoryBtn")
    .addEventListener("click", async () => {
        const name = document.getElementById("newCategory").value.trim();
        if (!name) return;
        await fetch("/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        document.getElementById("newCategory").value = "";
        loadCategories();
    });

loadCategories();
