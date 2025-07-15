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

        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            window.alert(
                `Statement source: ${result.data.statementType}\nTotal number of transactions in file: ${result.data.totalCount}\nNumber of transactions inserted: ${result.data.insertedCount}`
            );
        } catch (err) {
            console.error("Error uploading file:", err);
        }
    });
