document
    .getElementById("uploadForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a file.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        fetch("/upload", {
            method: "POST",
            body: formData,
        });
    });

document
    .getElementById("fetchRatesBtn")
    .addEventListener("click", async (btn) => {
        const confirmed = confirm("Fetch new exchange rates from BCB?");
        if (!confirmed) return;
        btn.target.disabled = true;
        const loading = document.getElementById("loadingMessage");
        loading.style.display = "block";

        try {
            const response = await fetch("/rates/update", { method: "POST" });

            if (response.ok) {
                const result = await response.json();
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
